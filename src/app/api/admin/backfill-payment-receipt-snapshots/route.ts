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

    console.log("Starting backfill of payment and receipt snapshots...");

    // Backfill payments
    const payments = await prisma.payment.findMany({
      where: {
        invoiceNo: null,  // Only backfill payments without snapshot data
      },
      include: {
        invoice: { include: { tenant: true } },
      },
    });

    console.log(`Found ${payments.length} payments to backfill`);

    let paymentsUpdated = 0;

    for (const payment of payments) {
      if (!payment.invoice) {
        console.log(`Skipping payment ${payment.id} - invoice not found`);
        continue;
      }

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          invoiceNo: payment.invoice.invoiceNo,
          invoiceDate: payment.invoice.invoiceDate,
          invoiceTotalAmount: payment.invoice.totalAmount,
          tenantName: payment.invoice.tenantName || payment.invoice.tenant?.name,
          tenantNameTh: payment.invoice.tenantNameTh || payment.invoice.tenant?.nameTh,
          tenantType: payment.invoice.tenantType || payment.invoice.tenant?.tenantType,
        },
      });

      paymentsUpdated++;
    }

    // Backfill receipts
    const receipts = await prisma.receipt.findMany({
      where: {
        invoiceNo: null,  // Only backfill receipts without snapshot data
      },
      include: {
        invoice: { include: { tenant: true } },
      },
    });

    console.log(`Found ${receipts.length} receipts to backfill`);

    let receiptsUpdated = 0;

    for (const receipt of receipts) {
      if (!receipt.invoice) {
        console.log(`Skipping receipt ${receipt.id} - invoice not found`);
        continue;
      }

      await prisma.receipt.update({
        where: { id: receipt.id },
        data: {
          invoiceNo: receipt.invoice.invoiceNo,
          invoiceDate: receipt.invoice.invoiceDate,
          invoiceTotalAmount: receipt.invoice.totalAmount,
          tenantName: receipt.invoice.tenantName || receipt.invoice.tenant?.name,
          tenantNameTh: receipt.invoice.tenantNameTh || receipt.invoice.tenant?.nameTh,
          tenantType: receipt.invoice.tenantType || receipt.invoice.tenant?.tenantType,
          tenantTaxId: receipt.invoice.tenantTaxId || receipt.invoice.tenant?.taxId,
        },
      });

      receiptsUpdated++;
    }

    console.log("Backfill complete!");
    console.log(`Payments updated: ${paymentsUpdated}`);
    console.log(`Receipts updated: ${receiptsUpdated}`);

    return NextResponse.json({
      success: true,
      paymentsUpdated,
      receiptsUpdated,
      totalPayments: payments.length,
      totalReceipts: receipts.length,
    });
  } catch (error) {
    console.error("Error during backfill:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
