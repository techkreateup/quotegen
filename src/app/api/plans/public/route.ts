import { NextResponse } from "next/server";
import { getPlanDefinitions, getPremiumFeatureKeys } from "@/lib/plans-db";
import { FEATURES, LAUNCH } from "@/lib/features";

// Public (no auth): plan catalogue for the landing page, signup picker, and the
// in-app plans page. Reflects super-admin edits to PlanDefinition.
export async function GET() {
  const [plans, premium] = await Promise.all([getPlanDefinitions(), getPremiumFeatureKeys()]);
  return NextResponse.json({
    plans,
    premium,
    launch: LAUNCH,
    features: FEATURES.map((f) => ({ key: f.key, label: f.label, category: f.category })),
  });
}
