CREATE TABLE IF NOT EXISTS "StoragePool" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "label" TEXT NOT NULL DEFAULT '',
  "tokenEnc" TEXT NOT NULL,
  "capacityMb" INTEGER NOT NULL DEFAULT 2048,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoragePool_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "StoragePool_name_key" ON "StoragePool"("name");
