-- Re-generate document codes with a category prefix (HR-0001, LEG-0001, …).
WITH ordered AS (
  SELECT id, category, ROW_NUMBER() OVER (PARTITION BY "companyId", category ORDER BY "createdAt", id) AS rn
  FROM "Document"
)
UPDATE "Document" d SET code =
  (CASE o.category
    WHEN 'Onboarding' THEN 'ONB' WHEN 'HR' THEN 'HR' WHEN 'Legal' THEN 'LEG'
    WHEN 'Finance' THEN 'FIN' WHEN 'Payroll' THEN 'PAY' WHEN 'Compliance' THEN 'CMP'
    WHEN 'Tax' THEN 'TAX' WHEN 'Personal' THEN 'PER' ELSE 'DOC' END)
  || '-' || LPAD(o.rn::text, 4, '0')
FROM ordered o WHERE d.id = o.id;
