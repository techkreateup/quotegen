ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "code" TEXT;
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt", id) AS rn FROM "Company"
)
UPDATE "Company" c SET code = 'CMP-' || LPAD(o.rn::text, 4, '0')
FROM ordered o WHERE c.id = o.id AND (c.code IS NULL OR c.code = '');
CREATE UNIQUE INDEX IF NOT EXISTS "Company_code_key" ON "Company"("code");
