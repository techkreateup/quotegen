import { createRouteHandler } from "uploadthing/next";
import { appFileRouter } from "@/lib/uploadthing";

// GET (presign / dev info) + POST (upload + signed callback) for UploadThing.
// Token is read from UPLOADTHING_TOKEN in the environment.
export const { GET, POST } = createRouteHandler({
  router: appFileRouter,
});
