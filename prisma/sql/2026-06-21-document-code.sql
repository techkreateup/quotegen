ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "code" TEXT NOT NULL DEFAULT '';
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "companyId" ORDER BY "createdAt", id) AS rn FROM "Document"
)
UPDATE "Document" d SET code = 'DOC-' || LPAD(o.rn::text, 4, '0')
FROM ordered o WHERE d.id = o.id AND (d.code IS NULL OR d.code = '');
