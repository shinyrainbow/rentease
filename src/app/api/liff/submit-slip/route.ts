import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { uploadFile } from "@/lib/s3";

export async function POST(request: NextRequest) {
  try {
    const { lineUserId, invoiceId, base64Image } = await request.json();

    if (!lineUserId || !invoiceId || !base64Image) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Find LINE contact and linked tenant
    const lineContact = await prisma.lineContact.findFirst({
      where: { lineUserId },
      include: {
        tenant: true,
        project: true,
      },
    });

    if (!lineContact || !lineContact.tenant) {
      return NextResponse.json({ error: "Tenant not linked" }, { status: 404 });
    }

    // Verify invoice belongs to this tenant
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        tenantId: lineContact.tenant.id,
        status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found or not payable" }, { status: 404 });
    }

    // Decode base64 image
    const matches = base64Image.match(/^data:(.+);base64,(.+)$/);
    if (!matches) {
      return NextResponse.json({ error: "Invalid image format" }, { status: 400 });
    }

    const contentType = matches[1];
    const imageBuffer = Buffer.from(matches[2], "base64");

    // Determine file extension
    const ext = contentType.includes("png") ? "png" : "jpg";
    const timestamp = Date.now();
    const s3Key = `slips/${invoiceId}/${timestamp}-liff.${ext}`;

    // Upload to S3
    await uploadFile(s3Key, imageBuffer, contentType);

    // Find or create a payment record for this invoice
    let payment = await prisma.payment.findFirst({
      where: {
        invoiceId: invoiceId,
        status: "PENDING",
      },
    });

    if (!payment) {
      // Create a new pending payment
      payment = await prisma.payment.create({
        data: {
          invoiceId: invoiceId,
          tenantId: lineContact.tenant.id,
          amount: invoice.totalAmount - invoice.paidAmount,
          method: "TRANSFER",
          status: "PENDING",
          paidAt: new Date(),
        },
      });
    }

    // Create PaymentSlip record
    const slip = await prisma.paymentSlip.create({
      data: {
        paymentId: payment.id,
        s3Key: s3Key,
        fileName: `slip-${timestamp}.${ext}`,
        contentType: contentType,
        uploadedBy: lineContact.tenant.id,
        source: "LIFF",
      },
    });

    // Optionally notify admin via LINE (send message to the project's LINE OA)
    // This would require push message capability

    return NextResponse.json({
      success: true,
      paymentId: payment.id,
      slipId: slip.id,
      message: "สลิปถูกส่งเรียบร้อยแล้ว รอการตรวจสอบ",
    });
  } catch (error) {
    console.error("Error submitting slip:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
