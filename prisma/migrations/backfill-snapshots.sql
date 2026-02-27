-- Backfill snapshot data for existing records
-- This copies current relation data into snapshot columns so records survive deletion

-- ============ MeterReading: backfill projectName and unitNumber ============
UPDATE "MeterReading" mr
SET
  "projectName" = p."name",
  "unitNumber" = u."unitNumber"
FROM "Project" p, "Unit" u
WHERE mr."projectId" = p."id"
  AND mr."unitId" = u."id"
  AND (mr."projectName" IS NULL OR mr."unitNumber" IS NULL);

-- ============ Invoice: backfill projectName and unitNumber ============
UPDATE "Invoice" i
SET
  "projectName" = p."name",
  "unitNumber" = u."unitNumber"
FROM "Project" p, "Unit" u
WHERE i."projectId" = p."id"
  AND i."unitId" = u."id"
  AND (i."projectName" IS NULL OR i."unitNumber" IS NULL);

-- ============ Payment: backfill projectName and unitNumber from Invoice ============
UPDATE "Payment" pay
SET
  "projectName" = COALESCE(inv."projectName", p."name"),
  "unitNumber" = COALESCE(inv."unitNumber", u."unitNumber")
FROM "Invoice" inv
LEFT JOIN "Project" p ON inv."projectId" = p."id"
LEFT JOIN "Unit" u ON inv."unitId" = u."id"
WHERE pay."invoiceId" = inv."id"
  AND (pay."projectName" IS NULL OR pay."unitNumber" IS NULL);

-- ============ Receipt: backfill projectName and unitNumber from Invoice ============
UPDATE "Receipt" r
SET
  "projectName" = COALESCE(inv."projectName", p."name"),
  "unitNumber" = COALESCE(inv."unitNumber", u."unitNumber")
FROM "Invoice" inv
LEFT JOIN "Project" p ON inv."projectId" = p."id"
LEFT JOIN "Unit" u ON inv."unitId" = u."id"
WHERE r."invoiceId" = inv."id"
  AND (r."projectName" IS NULL OR r."unitNumber" IS NULL);
