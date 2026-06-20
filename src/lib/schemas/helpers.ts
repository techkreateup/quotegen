import { z } from "zod";
import { NextResponse } from "next/server";

// Shared field validators (Indian formats), mirroring src/lib/validation.ts.
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export const PHONE_REGEX = /^[6-9]\d{9}$/;

/** Optional string that treats "" as undefined (forms send empty strings). */
export const optionalString = (max = 500) =>
  z.string().max(max).optional().or(z.literal("")).transform((v) => v || undefined);

export const emailField = z
  .string()
  .regex(EMAIL_REGEX, "Invalid email address")
  .optional()
  .or(z.literal(""))
  .transform((v) => v || undefined);

export const gstinField = z
  .string()
  .regex(GSTIN_REGEX, "Invalid GSTIN (expected e.g. 22AAAAA0000A1Z5)")
  .optional()
  .or(z.literal(""))
  .transform((v) => v || undefined);

export const phoneField = z
  .string()
  .transform((v) => v.replace(/[\s\-+]/g, "").replace(/^91/, ""))
  .pipe(z.string().regex(PHONE_REGEX, "Invalid Indian phone number"))
  .optional()
  .or(z.literal(""))
  .transform((v) => v || undefined);

export interface ParseResult<T> {
  ok: boolean;
  data?: T;
  response?: NextResponse;
}

/**
 * Validates `body` against `schema`. On failure returns a ready-to-send 400
 * response with field-level messages; on success returns the parsed data.
 */
export function parse<T>(schema: z.ZodType<T>, body: unknown): ParseResult<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join(".") || "_";
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Validation failed", fieldErrors },
        { status: 400 }
      ),
    };
  }
  return { ok: true, data: result.data };
}
