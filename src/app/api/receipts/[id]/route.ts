import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง (Unauthorized)" }, { status: 401 });
    }

    const { id } = await params;

    const receipt = await prisma.receipt.findFirst({
      where: { id, invoice: { project: { ownerId: session.user.id } } },
      include: {
        invoice: {
          include: {
            project: true,
            unit: true,
            tenant: true,
          },
        },
      },
    });

    if (!receipt) {
      return NextResponse.json({ error: "ไม่พบใบเสร็จ (Receipt not found)" }, { status: 404 });
    }

    return NextResponse.json(receipt);
  } catch (error) {
    console.error("Error fetching receipt:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดภายในระบบ (Internal server error)" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง (Unauthorized)" }, { status: 401 });
    }

    const { id } = await params;
    const data = await request.json();

    // Check if receipt exists and belongs to user
    const existingReceipt = await prisma.receipt.findFirst({
      where: {
        id,
        invoice: { project: { ownerId: session.user.id } },
      },
    });

    if (!existingReceipt) {
      return NextResponse.json({ error: "ไม่พบใบเสร็จ (Receipt not found)" }, { status: 404 });
    }

    const receipt = await prisma.receipt.update({
      where: { id },
      data: {
        receiptNo: data.receiptNo,
        amount: data.amount,
        issuedAt: data.issuedAt ? new Date(data.issuedAt) : undefined,
      },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNo: true,
            totalAmount: true,
            project: { select: { name: true, nameTh: true } },
            unit: { select: { unitNumber: true } },
            tenant: { select: { name: true, nameTh: true } },
          },
        },
      },
    });

    return NextResponse.json(receipt);
  } catch (error) {
    console.error("Error updating receipt:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดภายในระบบ (Internal server error)" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "ไม่มีสิทธิ์เข้าถึง (Unauthorized)" }, { status: 401 });
    }

    const { id } = await params;

    // Check if receipt exists and belongs to user
    const existingReceipt = await prisma.receipt.findFirst({
      where: {
        id,
        invoice: { project: { ownerId: session.user.id } },
      },
      include: {
        invoice: true,
      },
    });

    if (!existingReceipt) {
      return NextResponse.json({ error: "ไม่พบใบเสร็จ (Receipt not found)" }, { status: 404 });
    }

    // Store invoice info before deletion
    const invoiceId = existingReceipt.invoice.id;
    const totalAmount = existingReceipt.invoice.totalAmount;

    // Delete the receipt
    await prisma.receipt.delete({
      where: { id },
    });

    // Recalculate invoice's paidAmount and status
    const verifiedPayments = await prisma.payment.findMany({
      where: {
        invoiceId: invoiceId,
        status: "VERIFIED",
      },
    });

    const paidAmount = verifiedPayments.reduce((sum, p) => sum + p.amount, 0);

    let newStatus: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" = "PENDING";
    if (paidAmount >= totalAmount) {
      newStatus = "PAID";
    } else if (paidAmount > 0) {
      newStatus = "PARTIAL";
    }

    // Update invoice with new status and paidAmount
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: newStatus,
        paidAmount: paidAmount,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting receipt:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดภายในระบบ (Internal server error)" }, { status: 500 });
  }
}
