import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { uploadFile, getPresignedUrl } from "@/lib/s3";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: paymentId } = await params;

    // Verify user owns this payment
    const payment = await prisma.payment.findFirst({
      where: {
        id: paymentId,
        invoice: { project: { ownerId: session.user.id } },
      },
      include: {
        slips: true,
      },
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // Add presigned URLs
    const slipsWithUrls = await Promise.all(
      payment.slips.map(async (slip) => ({
        ...slip,
        presignedUrl: await getPresignedUrl(slip.s3Key),
      }))
    );

    return NextResponse.json(slipsWithUrls);
  } catch (error) {
    console.error("Error fetching slips:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: paymentId } = await params;
    const { base64Image, fileName } = await request.json();

    if (!base64Image) {
      return NextResponse.json({ error: "Image data required" }, { status: 400 });
    }

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
    const s3Key = `slips/${payment.invoiceId}/${timestamp}.${ext}`;

    // Upload to S3
    await uploadFile(s3Key, imageBuffer, contentType);

    // Create PaymentSlip record
    const slip = await prisma.paymentSlip.create({
      data: {
        paymentId: paymentId,
        s3Key: s3Key,
        fileName: fileName || `slip-${timestamp}.${ext}`,
        contentType: contentType,
        uploadedBy: session.user.id,
        source: "MANUAL",
      },
    });

    return NextResponse.json({
      ...slip,
      presignedUrl: await getPresignedUrl(s3Key),
    });
  } catch (error) {
    console.error("Error adding slip:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
