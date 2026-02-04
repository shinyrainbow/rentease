import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { getPresignedUrl } from "@/lib/s3";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const data = await request.json();

    // Check if payment exists and belongs to user
    const existingPayment = await prisma.payment.findFirst({
      where: {
        id,
        invoice: { project: { ownerId: session.user.id } },
      },
      include: {
        invoice: true,
      },
    });

    if (!existingPayment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // Only allow editing PENDING payments
    if (existingPayment.status !== "PENDING") {
      return NextResponse.json(
        { error: "Cannot edit verified or rejected payments" },
        { status: 400 }
      );
    }

    const payment = await prisma.payment.update({
      where: { id },
      data: {
        amount: data.amount,
        method: data.method,
        transferRef: data.method === "TRANSFER" ? data.transferRef : null,
        transferBank: data.method === "TRANSFER" ? data.transferBank : null,
        checkNo: data.method === "CHECK" ? data.checkNo : null,
        checkBank: data.method === "CHECK" ? data.checkBank : null,
        checkDate: data.method === "CHECK" && data.checkDate ? new Date(data.checkDate) : null,
        notes: data.notes || null,
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

    return NextResponse.json(payment);
  } catch (error) {
    console.error("Error updating payment:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check if payment exists and belongs to user
    const existingPayment = await prisma.payment.findFirst({
      where: {
        id,
        invoice: { project: { ownerId: session.user.id } },
      },
      include: {
        invoice: true,
      },
    });

    if (!existingPayment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // Only allow deleting PENDING payments
    if (existingPayment.status !== "PENDING") {
      return NextResponse.json(
        { error: "Cannot delete verified or rejected payments" },
        { status: 400 }
      );
    }

    // Delete associated slips first
    await prisma.paymentSlip.deleteMany({
      where: { paymentId: id },
    });

    // Delete the payment
    await prisma.payment.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting payment:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
