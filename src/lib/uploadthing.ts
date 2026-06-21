import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { cookies } from "next/headers";
import { verifyJwt, type JwtPayload } from "@/lib/auth";
import { prismaUnscoped } from "@/lib/db";

const f = createUploadthing();

/**
 * Identify the caller from the JWT cookie directly.
 *
 * `/api/uploadthing` is a PUBLIC path in the edge proxy (so UploadThing's signed
 * server→server callback isn't blocked for lacking a session cookie). That means
 * the proxy does NOT inject the `x-user-*` identity headers here, so we read and
 * verify the `qg_token` cookie ourselves. This runs during the browser's presign
 * request (which carries the cookie); the metadata we return is then handed back
 * to `onUploadComplete`, so the callback doesn't need the cookie.
 */
async function requireUser(): Promise<JwtPayload> {
  const cookieStore = await cookies();
  const token = cookieStore.get("qg_token")?.value;
  const payload = token ? await verifyJwt(token) : null;
  if (!payload) throw new UploadThingError("Not authenticated");
  return payload;
}

const IMAGE = { image: { maxFileSize: "4MB", maxFileCount: 1 } } as const;

export const appFileRouter = {
  // User profile photo → User.avatarUrl
  avatar: f(IMAGE)
    .middleware(async () => {
      const user = await requireUser();
      return { userId: user.userId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      await prismaUnscoped.user.update({
        where: { id: metadata.userId },
        data: { avatarUrl: file.ufsUrl },
      });
      return { url: file.ufsUrl };
    }),

  // Company logo → CompanySettings.logoUrl (company admins only)
  companyLogo: f(IMAGE)
    .middleware(async () => {
      const user = await requireUser();
      if (!user.companyId) throw new UploadThingError("A company account is required");
      // Only company admins manage branding.
      if (!user.isSystemAdmin && user.platformRole !== "COMPANY_ADMIN") {
        throw new UploadThingError("Admin access required");
      }
      return { companyId: user.companyId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      await prismaUnscoped.companySettings.update({
        where: { companyId: metadata.companyId },
        data: { logoUrl: file.ufsUrl },
      });
      return { url: file.ufsUrl };
    }),
} satisfies FileRouter;

export type AppFileRouter = typeof appFileRouter;
