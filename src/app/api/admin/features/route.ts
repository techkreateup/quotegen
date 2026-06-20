import { withApi } from "@/lib/with-api";
import { NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";
import { resolveFeatures, FEATURES, type FeatureMap } from "@/lib/features";

// Matrix data: every company with its resolved feature map, plus per-feature
// adoption counts. The matrix toggles call PATCH /api/admin/companies/[id].
async function GET_handler() {
  const companies = await prismaUnscoped.company.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, plan: true, isActive: true, featureOverrides: true },
  });

  const rows = companies.map((c) => ({
    id: c.id,
    name: c.name,
    plan: c.plan,
    isActive: c.isActive,
    features: resolveFeatures(c.featureOverrides as FeatureMap),
  }));

  // How many active companies have each feature enabled.
  const counts: Record<string, number> = {};
  for (const f of FEATURES) {
    counts[f.key] = rows.filter((r) => r.features[f.key] !== false).length;
  }

  return NextResponse.json({
    companies: rows,
    features: FEATURES,
    counts,
    total: rows.length,
  });
}

export const GET = withApi(GET_handler, { allowPlatform: true });
