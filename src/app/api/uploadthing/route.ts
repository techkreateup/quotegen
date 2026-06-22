import type { NextRequest } from "next/server";
import { createRouteHandler } from "uploadthing/next";
import { appFileRouter } from "@/lib/uploadthing";
import { resolveUploadPool, poolToken } from "@/lib/storage";

// GET (presign) + POST (upload + signed callback) for UploadThing.
//
// Multi-pool: the token is resolved per request from the active storage pool, so
// new uploads land in a pool that has space. The token is read from stored state
// (active-pool setting + pool usage), so the upload and its signed callback agree
// on the same pool/account. With a single pool this is simply UPLOADTHING_TOKEN.
async function handler(method: "GET" | "POST", req: NextRequest): Promise<Response> {
  const pool = await resolveUploadPool();
  const token = await poolToken(pool);
  const { GET, POST } = createRouteHandler({
    router: appFileRouter,
    config: token ? { token } : undefined,
  });
  return method === "GET" ? GET(req) : POST(req);
}

export const GET = (req: NextRequest) => handler("GET", req);
export const POST = (req: NextRequest) => handler("POST", req);
