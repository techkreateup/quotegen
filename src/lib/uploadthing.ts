import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { verifyJwt, type JwtPayload } from "@/lib/auth";
import { prismaUnscoped } from "@/lib/db";
import { assertStorageAvailable, resolveUploadPool } from "@/lib/storage";

const DOC_CATEGORIES = [
  "Onboarding", "HR", "Legal", "Finance", "Payroll", "Compliance", "Tax", "Personal", "Other",
] as const;

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

  // Document Vault file → creates a Document row. Accepts PDFs, images, and any
  // office/blob file. Enforces the shared storage quota against the real incoming
  // size, and stamps category/description/expiry/links passed from the client.
  document: f({
    pdf: { maxFileSize: "16MB", maxFileCount: 1 },
    image: { maxFileSize: "8MB", maxFileCount: 1 },
    blob: { maxFileSize: "16MB", maxFileCount: 1 },
  })
    .input(
      z.object({
        category: z.enum(DOC_CATEGORIES).default("Other"),
        description: z.string().max(500).optional(),
        expiresAt: z.string().optional(),
        employeeId: z.string().optional(),
        clientId: z.string().optional(),
        projectId: z.string().optional(),
      })
    )
    .middleware(async ({ files, input }) => {
      const user = await requireUser();
      if (!user.companyId) throw new UploadThingError("A company account is required");
      const incoming = files.reduce((sum, f) => sum + (f.size ?? 0), 0);
      try {
        await assertStorageAvailable(user.companyId, incoming);
      } catch (e) {
        throw new UploadThingError((e as Error).message);
      }
      return {
        companyId: user.companyId,
        userId: user.userId,
        userName: user.name,
        storagePool: await resolveUploadPool(),
        ...input,
      };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const ext = (file.name.split(".").pop() || "").toLowerCase();
      const seq = (await prismaUnscoped.document.count({ where: { companyId: metadata.companyId } })) + 1;
      const doc = await prismaUnscoped.document.create({
        data: {
          companyId: metadata.companyId,
          code: `DOC-${String(seq).padStart(4, "0")}`,
          name: file.name,
          fileUrl: file.ufsUrl,
          fileKey: file.key,
          storagePool: metadata.storagePool,
          mimeType: file.type ?? "",
          format: ext,
          sizeBytes: file.size ?? 0,
          category: metadata.category,
          description: metadata.description ?? "",
          expiresAt: metadata.expiresAt ? new Date(metadata.expiresAt) : null,
          employeeId: metadata.employeeId || null,
          clientId: metadata.clientId || null,
          projectId: metadata.projectId || null,
          uploadedById: metadata.userId,
          uploadedByName: metadata.userName,
        },
      });
      return { documentId: doc.id, url: file.ufsUrl };
    }),
} satisfies FileRouter;

export type AppFileRouter = typeof appFileRouter;
