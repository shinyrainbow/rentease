import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { uploadFile } from "@/lib/s3";

// POST /api/contracts/[id]/sign - Sign a contract (landlord)
export async function POST(
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
    const { signature } = data; // Base64 signature image

    if (!signature) {
      return NextResponse.json({ error: "Signature is required" }, { status: 400 });
    }

    const existingContract = await prisma.leaseContract.findUnique({
      where: { id },
      include: {
        project: { select: { ownerId: true } },
      },
    });

    if (!existingContract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    if (existingContract.project.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (existingContract.status !== "DRAFT") {
      return NextResponse.json({ error: "Contract already signed by landlord" }, { status: 400 });
    }

    // Upload signature to S3
    const base64Data = signature.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const s3Key = `contracts/${id}/landlord-signature-${Date.now()}.png`;
    await uploadFile(s3Key, buffer, "image/png");

    // Refresh token expiration (7 days from signing)
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 7);

    const contract = await prisma.leaseContract.update({
      where: { id },
      data: {
        landlordSignature: s3Key,
        landlordSignedAt: new Date(),
        status: "PENDING_TENANT",
        tokenExpiresAt,
      },
      include: {
        project: { select: { id: true, name: true, nameTh: true } },
        unit: { select: { id: true, unitNumber: true } },
        tenant: { select: { id: true, name: true, nameTh: true, email: true, phone: true } },
      },
    });

    return NextResponse.json(contract);
  } catch (error) {
    console.error("Error signing contract:", error);
    return NextResponse.json({ error: "Failed to sign contract" }, { status: 500 });
  }
}
