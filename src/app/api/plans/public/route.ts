import { NextResponse } from "next/server";
import { getPlanDefinitions, getPremiumFeatureKeys } from "@/lib/plans-db";
import { FEATURES, LAUNCH } from "@/lib/features";
import { getPlatformGst } from "@/lib/platform-gst";

// Public (no auth): plan catalogue for the landing page, signup picker, and the
// in-app plans page. Reflects super-admin edits to PlanDefinition.
export async function GET() {
  const [plans, premium, gst] = await Promise.all([
    getPlanDefinitions(),
    getPremiumFeatureKeys(),
    getPlatformGst(),
  ]);
  return NextResponse.json({
    plans,
    premium,
    launch: LAUNCH,
    features: FEATURES.map((f) => ({ key: f.key, label: f.label, category: f.category })),
    // Only rate + mode are public; provider state/GSTIN are admin-only.
    gst: { rate: gst.rate, mode: gst.mode },
  });
}
