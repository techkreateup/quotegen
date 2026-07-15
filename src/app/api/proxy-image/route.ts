import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";

// Same-origin proxy for UploadThing images so html2canvas can render them into a
// PDF without tainting the canvas (cross-origin images block toDataURL). Locked
// to UploadThing hosts to prevent SSRF.
async function GET_handler(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url") || "";
  if (!/^https:\/\/[a-z0-9.-]*(ufs\.sh|utfs\.io)\/[^\s]+$/i.test(url)) {
    return NextResponse.json({ error: "URL not allowed" }, { status: 400 });
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return NextResponse.json({ error: "Upstream fetch failed" }, { status: 502 });
  const buf = await res.arrayBuffer();
  return new NextResponse(buf, {
    headers: {
      "Content-Type": res.headers.get("content-type") || "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

// public: true — needed by unauthenticated /p/[type]/[id] share pages to render
// the company logo into a PDF. Safe: read-only GET, URL is regex-locked to
// UploadThing's own CDN hosts above (no SSRF, no tenant data ever touches this
// route — it only re-serves an already-public image byte stream).
export const GET = withApi(GET_handler, { public: true });
