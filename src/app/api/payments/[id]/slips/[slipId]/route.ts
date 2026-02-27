import { NextRequest, NextResponse } from "next/server";
import { requireMutationAccess } from "@/lib/auth-guard";
import prisma from "@/lib/prisma";
import { deleteFile } from "@/lib/s3";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; slipId: string }> }
) {
  try {
    const { session, error } = await requireMutationAccess();
    if (error) return error;

    const { id: paymentId, slipId } = await params;

    // Verify user owns this payment
    const payment = await prisma.payment.findFirst({
      where: {
        id: paymentId,
        invoice: { project: { ownerId: session.user.id } },
      },
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // Find the slip
    const slip = await prisma.paymentSlip.findFirst({
      where: {
        id: slipId,
        paymentId: paymentId,
      },
    });

    if (!slip) {
      return NextResponse.json({ error: "Slip not found" }, { status: 404 });
    }

    // Delete from S3
    try {
      await deleteFile(slip.s3Key);
    } catch (error) {
      console.error("Error deleting from S3:", error);
      // Continue to delete from database even if S3 fails
    }

    // Delete from database
    await prisma.paymentSlip.delete({
      where: { id: slipId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting slip:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
