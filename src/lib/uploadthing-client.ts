import {
  generateUploadButton,
  generateUploadDropzone,
  generateReactHelpers,
} from "@uploadthing/react";
import type { AppFileRouter } from "@/lib/uploadthing";

// Typed UploadThing client bound to our file router.
export const UploadButton = generateUploadButton<AppFileRouter>();
export const UploadDropzone = generateUploadDropzone<AppFileRouter>();
export const { useUploadThing, uploadFiles } = generateReactHelpers<AppFileRouter>();
