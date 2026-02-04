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

    if (!messageId || !projectId || !invoiceId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify user owns this project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        ownerId: session.user.id,
      },
    });

    if (!project || !project.lineAccessToken) {
      return NextResponse.json({ error: "Project not found or LINE not configured" }, { status: 404 });
    }

    // Verify invoice belongs to this project
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        projectId: projectId,
      },
      include: {
        tenant: true,
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Fetch image from LINE Content API
    const lineResponse = await fetch(
      `https://api-data.line.me/v2/bot/message/${messageId}/content`,
      {
        headers: {
          Authorization: `Bearer ${project.lineAccessToken}`,
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
