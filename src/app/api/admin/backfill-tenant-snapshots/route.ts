import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export async function POST() {
  try {
    const session = await auth();

    // Only allow authenticated admins/owners
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Starting backfill of invoice tenant snapshots...");

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
    }

    console.log("Backfill complete!");
    console.log(`Updated: ${updated} invoices`);
    console.log(`Skipped: ${skipped} invoices`);

    return NextResponse.json({
      success: true,
      updated,
      skipped,
      total: invoices.length,
    });
  } catch (error) {
    console.error("Error during backfill:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
