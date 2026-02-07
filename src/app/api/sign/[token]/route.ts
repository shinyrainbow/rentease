import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { uploadFile, getPresignedUrl, isS3Key } from "@/lib/s3";

// GET /api/sign/[token] - Get contract for public signing
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const contract = await prisma.leaseContract.findUnique({
      where: { signingToken: token },
      include: {
        project: {
          select: {
            name: true,
            nameTh: true,
            companyName: true,
            companyNameTh: true,
            companyAddress: true,
            logoUrl: true,
          },
        },
        unit: { select: { unitNumber: true, floor: true, size: true, type: true } },
        tenant: {
          select: {
            name: true,
            nameTh: true,
            email: true,
            phone: true,
            address: true,
          },
        },
      },
    });

    if (!contract) {
      return NextResponse.json({ error: "Invalid signing link" }, { status: 404 });
    }

    // Check if token expired
    if (contract.tokenExpiresAt && new Date() > contract.tokenExpiresAt) {
      return NextResponse.json({ error: "Signing link has expired" }, { status: 410 });
    }

    // Check if already signed by tenant
    if (contract.tenantSignature) {
      return NextResponse.json({ error: "Contract already signed" }, { status: 400 });
    }

    // Check if landlord has signed
    if (contract.status !== "PENDING_TENANT") {
      return NextResponse.json({ error: "Contract not ready for signing" }, { status: 400 });
    }

    // Get logo presigned URL if needed
    let logoUrl = null;
    if (contract.project.logoUrl) {
      logoUrl = isS3Key(contract.project.logoUrl)
        ? await getPresignedUrl(contract.project.logoUrl)
        : contract.project.logoUrl;
    }

    // Return contract data (without sensitive info)
    return NextResponse.json({
      contractNo: contract.contractNo,
      title: contract.title,
      titleTh: contract.titleTh,
      baseRent: contract.baseRent,
      commonFee: contract.commonFee,
      deposit: contract.deposit,
      contractStart: contract.contractStart,
      contractEnd: contract.contractEnd,
      clauses: contract.clauses,
      project: {
        ...contract.project,
        logoUrl,
      },
      unit: contract.unit,
      tenant: contract.tenant,
      landlordSignedAt: contract.landlordSignedAt,
    });
  } catch (error) {
    console.error("Error fetching contract for signing:", error);
    return NextResponse.json({ error: "Failed to fetch contract" }, { status: 500 });
  }
}

// POST /api/sign/[token] - Submit tenant signature
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const data = await request.json();
    const { signature } = data;

    if (!signature) {
      return NextResponse.json({ error: "Signature is required" }, { status: 400 });
    }

    const contract = await prisma.leaseContract.findUnique({
      where: { signingToken: token },
    });

    if (!contract) {
      return NextResponse.json({ error: "Invalid signing link" }, { status: 404 });
    }

    // Check if token expired
    if (contract.tokenExpiresAt && new Date() > contract.tokenExpiresAt) {
      return NextResponse.json({ error: "Signing link has expired" }, { status: 410 });
    }

    // Check if already signed
    if (contract.tenantSignature) {
      return NextResponse.json({ error: "Contract already signed" }, { status: 400 });
    }

    // Check if landlord has signed
    if (contract.status !== "PENDING_TENANT") {
      return NextResponse.json({ error: "Contract not ready for signing" }, { status: 400 });
    }

    // Upload signature to S3
    const base64Data = signature.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const s3Key = `contracts/${contract.id}/tenant-signature-${Date.now()}.png`;
    await uploadFile(s3Key, buffer, "image/png");

    // Update contract
    const updatedContract = await prisma.leaseContract.update({
      where: { id: contract.id },
      data: {
        tenantSignature: s3Key,
        tenantSignedAt: new Date(),
        status: "SIGNED",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Contract signed successfully",
      signedAt: updatedContract.tenantSignedAt,
    });
  } catch (error) {
    console.error("Error signing contract:", error);
    return NextResponse.json({ error: "Failed to sign contract" }, { status: 500 });
  }
}
