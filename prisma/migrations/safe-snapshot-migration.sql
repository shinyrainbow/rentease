-- Safe migration: Make FKs nullable, change onDelete to SET NULL, add snapshot columns
-- This preserves ALL existing data

-- ============ MeterReading ============
-- Make unitId nullable
ALTER TABLE "MeterReading" ALTER COLUMN "unitId" DROP NOT NULL;

-- Change unit FK from CASCADE to SET NULL
ALTER TABLE "MeterReading" DROP CONSTRAINT IF EXISTS "MeterReading_unitId_fkey";
ALTER TABLE "MeterReading" ADD CONSTRAINT "MeterReading_unitId_fkey"
  FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add snapshot columns
ALTER TABLE "MeterReading" ADD COLUMN IF NOT EXISTS "projectName" TEXT;
ALTER TABLE "MeterReading" ADD COLUMN IF NOT EXISTS "unitNumber" TEXT;

-- ============ Invoice ============
-- Make unitId and tenantId nullable
ALTER TABLE "Invoice" ALTER COLUMN "unitId" DROP NOT NULL;
ALTER TABLE "Invoice" ALTER COLUMN "tenantId" DROP NOT NULL;

-- Change unit FK from CASCADE to SET NULL
ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_unitId_fkey";
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_unitId_fkey"
  FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Change tenant FK from CASCADE to SET NULL
ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_tenantId_fkey";
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add snapshot columns
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "projectName" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "unitNumber" TEXT;

-- ============ Payment ============
-- Make invoiceId and tenantId nullable
ALTER TABLE "Payment" ALTER COLUMN "invoiceId" DROP NOT NULL;
ALTER TABLE "Payment" ALTER COLUMN "tenantId" DROP NOT NULL;

-- Change invoice FK from CASCADE to SET NULL
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_invoiceId_fkey";
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Change tenant FK from CASCADE to SET NULL
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_tenantId_fkey";
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add snapshot columns
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "projectName" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "unitNumber" TEXT;

-- ============ Receipt ============
-- Make invoiceId nullable
ALTER TABLE "Receipt" ALTER COLUMN "invoiceId" DROP NOT NULL;

-- Change invoice FK from CASCADE to SET NULL
ALTER TABLE "Receipt" DROP CONSTRAINT IF EXISTS "Receipt_invoiceId_fkey";
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add snapshot columns
ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "projectName" TEXT;
ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "unitNumber" TEXT;
