-- CreateTable
CREATE TABLE "PlanDefinition" (
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "features" JSONB NOT NULL DEFAULT '[]',
    "maxUsers" INTEGER,
    "comingSoon" BOOLEAN NOT NULL DEFAULT false,
    "price" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanDefinition_pkey" PRIMARY KEY ("name")
);

