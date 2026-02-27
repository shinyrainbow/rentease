SELECT 'MeterReading' as "table", COUNT(*) as total, COUNT("projectName") as with_snapshot FROM "MeterReading"
UNION ALL
SELECT 'Invoice', COUNT(*), COUNT("projectName") FROM "Invoice"
UNION ALL
SELECT 'Payment', COUNT(*), COUNT("projectName") FROM "Payment"
UNION ALL
SELECT 'Receipt', COUNT(*), COUNT("projectName") FROM "Receipt";
