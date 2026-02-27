import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { requireMutationAccess } from "@/lib/auth-guard";
import prisma from "@/lib/prisma";
import { getPresignedUrl } from "@/lib/s3";
import { generateReceiptNo } from "@/lib/utils";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const payments = await prisma.payment.findMany({
      where: {
        invoice: { project: { ownerId: session.user.id } },
        ...(status && { status: status as "PENDING" | "VERIFIED" | "REJECTED" }),
      },
      include: {
        invoice: {
          select: {
            invoiceNo: true,
            dueDate: true,
            project: { select: { name: true, nameTh: true } },
            unit: { select: { unitNumber: true } },
            receipt: { select: { id: true } },
          },
        },
        tenant: { select: { name: true, nameTh: true } },
        slips: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Add presigned URLs for slips + snapshot fallbacks for nullable relations
    const paymentsWithUrls = await Promise.all(
      payments.map(async (payment) => {
        const slipsWithUrls = await Promise.all(
          payment.slips.map(async (slip) => ({
            ...slip,
            presignedUrl: await getPresignedUrl(slip.s3Key),
          }))
        );
        return {
          ...payment,
          // Use snapshot fallback when invoice/tenant relations are null
          invoice: payment.invoice || {
            invoiceNo: payment.invoiceNo || "-",
            dueDate: payment.invoiceDate,
            project: { name: payment.projectName || "Unknown", nameTh: null },
            unit: { unitNumber: payment.unitNumber || "-" },
            receipt: null,
          },
          tenant: payment.tenant || {
            name: payment.tenantName || "Unknown",
            nameTh: payment.tenantNameTh,
          },
          slips: slipsWithUrls,
        };
      })
    );

    return NextResponse.json(paymentsWithUrls);
  } catch (error) {
    console.error("Error fetching payments:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireMutationAccess();
    if (error) return error;

    const data = await request.json();

    const invoice = await prisma.invoice.findFirst({
      where: { id: data.invoiceId, project: { ownerId: session.user.id } },
      include: { tenant: true, project: true, unit: true },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Determine if we should auto-verify (for cash/check payments from admin)
    const shouldAutoVerify = data.autoVerify === true;
    const paymentStatus = shouldAutoVerify ? "VERIFIED" : "PENDING";

    const payment = await prisma.payment.create({
      data: {
        invoiceId: data.invoiceId,
        tenantId: invoice.tenantId,
        amount: data.amount,
        method: data.method,
        status: paymentStatus,
        slipUrl: data.slipUrl,
        slipVerified: shouldAutoVerify,
        verifiedAt: shouldAutoVerify ? new Date() : null,
        verifiedBy: shouldAutoVerify ? session.user.id : null,
        transferRef: data.transferRef,
        transferBank: data.transferBank,
        checkNo: data.checkNo,
        checkBank: data.checkBank,
        checkDate: data.checkDate ? new Date(data.checkDate) : null,
        notes: data.notes,
        paidAt: new Date(),
        // Project/Unit snapshot (preserve data at time of payment)
        projectName: invoice.projectName || invoice.project.name,
        unitNumber: invoice.unitNumber || invoice.unit?.unitNumber,
        // Invoice snapshot (preserve data at time of payment)
        invoiceNo: invoice.invoiceNo,
        invoiceDate: invoice.invoiceDate,
        invoiceTotalAmount: invoice.totalAmount,
        // Tenant snapshot (preserve data at time of payment)
        tenantName: invoice.tenantName || invoice.tenant?.name,
        tenantNameTh: invoice.tenantNameTh || invoice.tenant?.nameTh,
        tenantType: invoice.tenantType || invoice.tenant?.tenantType,
      },
      include: {
        invoice: {
          select: {
            invoiceNo: true,
            project: { select: { name: true, nameTh: true } },
            unit: { select: { unitNumber: true } },
          },
        },
        tenant: { select: { name: true, nameTh: true } },
      },
    });

    // If auto-verify is enabled, also update invoice and create receipt if needed
    if (shouldAutoVerify) {
      const newPaidAmount = invoice.paidAmount + data.amount;
      const newStatus = newPaidAmount >= invoice.totalAmount ? "PAID" : "PARTIAL";

      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: newPaidAmount,
          status: newStatus,
        },
      });

      // Create receipt if fully paid
      if (newStatus === "PAID") {
        const receiptNo = generateReceiptNo(
          invoice.project.name.substring(0, 3).toUpperCase(),
          new Date(),
          invoice.unit?.unitNumber
        );

        await prisma.receipt.create({
          data: {
            receiptNo,
            invoiceId: invoice.id,
            amount: invoice.totalAmount,
            // Snapshot fields
            projectName: invoice.projectName || invoice.project.name,
            unitNumber: invoice.unitNumber || invoice.unit?.unitNumber,
            invoiceNo: invoice.invoiceNo,
            invoiceDate: invoice.invoiceDate,
            invoiceTotalAmount: invoice.totalAmount,
            tenantName: invoice.tenantName || invoice.tenant?.name,
            tenantNameTh: invoice.tenantNameTh || invoice.tenant?.nameTh,
            tenantType: invoice.tenantType || invoice.tenant?.tenantType,
            tenantTaxId: invoice.tenantTaxId || invoice.tenant?.taxId,
          },
        });
      }
    }

    return NextResponse.json(payment);
  } catch (error) {
    console.error("Error creating payment:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
