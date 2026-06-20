-- Sprint 1.2 — Subscription lifecycle fields on Company

DO $$ BEGIN
  CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'FREE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "Company"
  ADD COLUMN IF NOT EXISTS "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'FREE',
  ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "currentPlanId" TEXT,
  ADD COLUMN IF NOT EXISTS "razorpaySubscriptionId" TEXT;
