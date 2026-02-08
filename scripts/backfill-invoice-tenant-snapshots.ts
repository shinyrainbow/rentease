import "dotenv/config";
import prisma from "../src/lib/prisma";

async function backfillInvoiceTenantSnapshots() {
  console.log("Starting backfill of invoice tenant snapshots...");

  try {
    // Get all invoices with their related tenant data
    const invoices = await prisma.invoice.findMany({
      where: {
        // Only backfill invoices that don't have tenant snapshot data yet
        tenantName: null,
      },
      include: {
        tenant: true,
      },
    });

    console.log(`Found ${invoices.length} invoices to backfill`);

    let updated = 0;
    let skipped = 0;

    for (const invoice of invoices) {
      if (!invoice.tenant) {
        console.log(`Skipping invoice ${invoice.invoiceNo} - tenant not found`);
        skipped++;
        continue;
      }

      // Update invoice with tenant snapshot data
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          tenantName: invoice.tenant.name,
          tenantNameTh: invoice.tenant.nameTh,
          tenantType: invoice.tenant.tenantType,
          tenantTaxId: invoice.tenant.taxId,
          tenantIdCard: invoice.tenant.idCard,
          tenantPhone: invoice.tenant.phone,
          tenantEmail: invoice.tenant.email,
        },
      });

      updated++;

      if (updated % 10 === 0) {
        console.log(`Progress: ${updated}/${invoices.length} invoices updated`);
      }
    }

    console.log("\nBackfill complete!");
    console.log(`Updated: ${updated} invoices`);
    console.log(`Skipped: ${skipped} invoices`);
  } catch (error) {
    console.error("Error during backfill:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the backfill
backfillInvoiceTenantSnapshots()
  .then(() => {
    console.log("Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });
