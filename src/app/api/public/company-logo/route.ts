import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";

// Public, no-auth image endpoint that serves a company's logo as a real hosted
// image. Email clients (Gmail/Outlook) BLOCK data: URIs in <img>, so for emails
// we point the logo at this URL instead. Logos are already public-facing (they
// appear on invoices sent to clients), so serving them unauthenticated is fine.
//
//   GET /api/public/company-logo?c=<companyId>
export async function GET(request: NextRequest) {
  try {
    const companyId = request.nextUrl.searchParams.get("c");
    if (!companyId) return new NextResponse("Missing company", { status: 400 });

    const s = await prismaUnscoped.companySettings.findFirst({
      where: { companyId },
      select: { logoUrl: true },
    });
    const logo = s?.logoUrl || "";

    // Hosted URL already — just redirect to it.
    if (/^https?:\/\//i.test(logo)) return NextResponse.redirect(logo);

    // data:URI — decode and serve the bytes.
    const m = logo.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
    if (!m) return new NextResponse("No logo", { status: 404 });

    const contentType = m[1];
    const bytes = Buffer.from(m[2], "base64");
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        // Cache for a day at the edge / in Gmail's image proxy.
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch {
    return new NextResponse("Error", { status: 500 });
  }
}
