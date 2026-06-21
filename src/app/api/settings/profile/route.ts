import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";
import {
  verifyJwt, signJwt, type JwtPayload, TOKEN_COOKIE_NAME, TOKEN_COOKIE_MAX_AGE,
} from "@/lib/auth";

// Return the current user's editable profile fields.
async function GET_handler(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const user = await prismaUnscoped.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, phone: true, bio: true, avatarUrl: true, emailVerified: true },
  });
  return NextResponse.json({ profile: user });
}

// Update the current user's own profile. Avatar is set by the UploadThing
// callback; this handles name/phone/bio edits and avatar removal. A user can
// only edit their own record.
async function PUT_handler(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (typeof body.avatarUrl === "string") {
    const v = body.avatarUrl.trim();
    if (v === "" || /^https:\/\/[a-z0-9.-]*ufs\.sh\//i.test(v) || /^https:\/\/utfs\.io\//i.test(v)) {
      data.avatarUrl = v;
    } else {
      return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
    }
  }
  if (typeof body.name === "string") {
    const v = body.name.trim();
    if (v.length < 1 || v.length > 80) return NextResponse.json({ error: "Name must be 1–80 characters" }, { status: 400 });
    data.name = v;
  }
  if (typeof body.phone === "string") data.phone = body.phone.trim().slice(0, 30);
  if (typeof body.bio === "string") data.bio = body.bio.slice(0, 300);

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updated = await prismaUnscoped.user.update({
    where: { id: userId },
    data,
    select: { id: true, name: true, phone: true, bio: true, avatarUrl: true },
  });

  const response = NextResponse.json({ profile: updated });

  // The display name lives in the JWT — re-issue the cookie so it updates app-wide
  // without forcing a re-login.
  if (typeof data.name === "string") {
    const token = request.cookies.get(TOKEN_COOKIE_NAME)?.value;
    const payload = token ? await verifyJwt(token) : null;
    if (payload) {
      const next: JwtPayload = { ...payload, name: data.name as string };
      const fresh = await signJwt(next);
      response.cookies.set(TOKEN_COOKIE_NAME, fresh, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: TOKEN_COOKIE_MAX_AGE,
      });
    }
  }

  return response;
}

export const GET = withApi(GET_handler, { allowPlatform: true });
export const PUT = withApi(PUT_handler, { allowPlatform: true });
