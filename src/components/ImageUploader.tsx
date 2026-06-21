"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useUploadThing } from "@/lib/uploadthing-client";

type Endpoint = "avatar" | "companyLogo";

interface Props {
  endpoint: Endpoint;
  /** Current image URL (empty = none). */
  value: string;
  /** Called with the new URL after a successful upload (or "" on remove). */
  onChange: (url: string) => void;
  /** "circle" for avatars, "rect" for logos. */
  shape?: "circle" | "rect";
  label?: string;
  hint?: string;
}

/**
 * Image upload control backed by UploadThing. The server route already persists
 * the URL to the DB on upload completion; `onChange` lets the parent reflect it
 * in local state immediately. Uses the hook + a custom button so we don't depend
 * on UploadThing's bundled CSS (keeps styling consistent with the app).
 */
export default function ImageUploader({ endpoint, value, onChange, shape = "rect", label, hint }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  const { startUpload, isUploading } = useUploadThing(endpoint, {
    onClientUploadComplete: (res) => {
      const url = (res?.[0]?.serverData as { url?: string } | undefined)?.url ?? res?.[0]?.ufsUrl;
      if (url) onChange(url);
      setError("");
    },
    onUploadError: (e) => setError(e.message || "Upload failed"),
  });

  const round = shape === "circle";
  const box = round ? 80 : 64;

  return (
    <div>
      {label && <label className="lbl">{label}</label>}
      <div className="flex items-center gap-4 mt-1">
        <div
          className="flex items-center justify-center overflow-hidden border border-slate-200 bg-slate-50 shrink-0"
          style={{ width: box, height: box, borderRadius: round ? "50%" : 12 }}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt={label || "image"} className="w-full h-full object-contain" />
          ) : (
            <ImagePlus size={22} className="text-slate-300" />
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={isUploading}
              className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600 text-[13px] font-semibold hover:bg-indigo-100 disabled:opacity-50"
            >
              {isUploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
              {isUploading ? "Uploading…" : value ? "Change" : "Upload"}
            </button>
            {value && !isUploading && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="inline-flex items-center gap-1.5 px-2.5 h-9 rounded-lg border border-slate-200 text-slate-500 text-[13px] hover:bg-slate-50"
              >
                <Trash2 size={14} /> Remove
              </button>
            )}
          </div>
          {hint && <span className="text-[11.5px] text-slate-400">{hint}</span>}
          {error && <span className="text-[11.5px] text-red-600">{error}</span>}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) startUpload([file]);
            e.target.value = ""; // allow re-selecting the same file
          }}
        />
      </div>
    </div>
  );
}
