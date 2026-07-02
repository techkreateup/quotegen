import { NextResponse } from "next/server";

// Shared error mapper for the doc-family CRUD routes. Every doc has a composite
// unique index on (companyId, docNo). Prisma throws P2002 with the offending
// column names in meta.target when a user picks a number that already exists —
// we translate that into a 409 with a human-readable message the editor can
// display inline instead of a generic 500.
export function handleDocError(err: unknown, docLabel: string): NextResponse {
  if (err && typeof err === "object" && (err as { code?: string }).code === "P2002") {
    return NextResponse.json({ error: `That ${docLabel} is already in use. Pick another.` }, { status: 409 });
  }
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
