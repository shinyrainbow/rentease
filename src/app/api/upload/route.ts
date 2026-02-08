import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { uploadFile, getPresignedUrl } from "@/lib/s3";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as string;
    const projectId = formData.get("projectId") as string;
    const tenantId = formData.get("tenantId") as string;

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "File size must be less than 2MB" }, { status: 400 });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Determine file extension
    const ext = file.type.includes("png") ? "png" : file.type.includes("gif") ? "gif" : "jpg";
    const timestamp = Date.now();

    // Create S3 key based on type
    let s3Key: string;
    let isPublic = false;

    if (type === "logo" && projectId) {
      // Logos are stored in "logo" folder and made public
      s3Key = `logo/${projectId}/${timestamp}.${ext}`;
      isPublic = true;
    } else if (type === "tenant" && tenantId) {
      // Tenant images are stored in "tenants" folder
      s3Key = `tenants/${tenantId}/${timestamp}.${ext}`;
    } else {
      s3Key = `uploads/${session.user.id}/${timestamp}.${ext}`;
    }

    // Upload to S3 (logos are public, others are private)
    await uploadFile(s3Key, buffer, file.type, isPublic);

    // If uploading a tenant image, update the tenant record
    if (type === "tenant" && tenantId) {
      // Verify tenant belongs to user
      const tenant = await prisma.tenant.findFirst({
        where: {
          id: tenantId,
          unit: { project: { ownerId: session.user.id } },
        },
      });

      if (!tenant) {
        return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
      }

      // Update tenant with new image URL
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { imageUrl: s3Key },
      });
    }

    // Generate presigned URL (7 days)
    const url = await getPresignedUrl(s3Key, 60 * 60 * 24 * 7);

    return NextResponse.json({
      success: true,
      url,
      key: s3Key,
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
