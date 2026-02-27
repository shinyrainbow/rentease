import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { uploadFile } from "@/lib/s3";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messageId, projectId, invoiceId } = await request.json();

    if (!messageId || !invoiceId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Find invoice first (to get projectId if not provided)
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        ...(projectId && { projectId }),
        project: { ownerId: session.user.id },
      },
      include: {
        tenant: true,
        unit: true,
        project: { include: { lineOa: true } },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const project = invoice.project;
    const lineAccessToken = project.lineOa?.lineAccessToken || project.lineAccessToken;
    if (!lineAccessToken) {
      return NextResponse.json({ error: "LINE not configured for this project" }, { status: 404 });
    }

    // Fetch image from LINE Content API
    const lineResponse = await fetch(
      `https://api-data.line.me/v2/bot/message/${messageId}/content`,
      {
        headers: {
          Authorization: `Bearer ${lineAccessToken}`,
        },
      }
    );

    if (!lineResponse.ok) {
      const errorText = await lineResponse.text().catch(() => "");
      console.error("LINE Content API error:", lineResponse.status, errorText);
      if (lineResponse.status === 404) {
        return NextResponse.json(
          { error: "Message content expired or not found. LINE messages can only be retrieved for a limited time." },
          { status: 404 }
        );
      }
      if (lineResponse.status === 401) {
        return NextResponse.json(
          { error: "LINE access token invalid or expired. Please reconnect LINE OA." },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: `Failed to fetch image from LINE: ${lineResponse.status}` },
        { status: 500 }
      );
    }

    const contentType = lineResponse.headers.get("content-type") || "image/jpeg";
    const imageBuffer = Buffer.from(await lineResponse.arrayBuffer());

    // Determine file extension
    const ext = contentType.includes("png") ? "png" : "jpg";
    const timestamp = Date.now();
    const s3Key = `slips/${invoiceId}/${timestamp}.${ext}`;

    // Upload to S3
    try {
      await uploadFile(s3Key, imageBuffer, contentType);
    } catch (s3Error) {
      console.error("S3 upload error:", s3Error);
      return NextResponse.json(
        { error: "Failed to upload image to storage" },
        { status: 500 }
      );
    }

    // Find or create a payment record for this invoice
    let payment;
    try {
      payment = await prisma.payment.findFirst({
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
            tenantId: invoice.tenantId,
            amount: invoice.totalAmount - invoice.paidAmount,
            method: "TRANSFER",
            status: "PENDING",
            paidAt: new Date(),
            // Snapshot fields
            projectName: invoice.projectName || invoice.project.name,
            unitNumber: invoice.unitNumber || invoice.unit?.unitNumber,
            invoiceNo: invoice.invoiceNo,
            invoiceDate: invoice.invoiceDate,
            invoiceTotalAmount: invoice.totalAmount,
            tenantName: invoice.tenantName || invoice.tenant?.name,
            tenantNameTh: invoice.tenantNameTh || invoice.tenant?.nameTh,
            tenantType: invoice.tenantType || invoice.tenant?.tenantType,
          },
        });
      }
    } catch (paymentError) {
      console.error("Payment creation error:", paymentError);
      return NextResponse.json(
        { error: "Failed to create payment record" },
        { status: 500 }
      );
    }

    // Create PaymentSlip record
    let slip;
    try {
      slip = await prisma.paymentSlip.create({
        data: {
          paymentId: payment.id,
          s3Key: s3Key,
          fileName: `slip-${timestamp}.${ext}`,
          contentType: contentType,
          uploadedBy: session.user.id,
          source: "LINE_CHAT",
        },
      });
    } catch (slipError) {
      console.error("PaymentSlip creation error:", slipError);
      return NextResponse.json(
        { error: "Failed to create slip record" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      paymentId: payment.id,
      slipId: slip.id,
    });
  } catch (error) {
    console.error("Error saving slip:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
