import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";

// Update the current user's own profile fields. Today: avatarUrl (set by the
// UploadThing callback on upload; this handles removal / clearing). Always scoped
// to the authenticated user — a user can only edit their own profile.
async function PUT_handler(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (typeof body.avatarUrl === "string") {
    // Only accept an UploadThing URL or an empty string (removal). Block arbitrary
    // values so this can't be used to point the avatar at an external resource.
    const v = body.avatarUrl.trim();
    if (v === "" || /^https:\/\/[a-z0-9.-]*ufs\.sh\//i.test(v) || /^https:\/\/utfs\.io\//i.test(v)) {
      data.avatarUrl = v;
    } else {
      return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updated = await prismaUnscoped.user.update({
    where: { id: userId },
    data,
    select: { id: true, avatarUrl: true },
  });
  return NextResponse.json({ user: updated });
}

export const PUT = withApi(PUT_handler, { allowPlatform: true });
