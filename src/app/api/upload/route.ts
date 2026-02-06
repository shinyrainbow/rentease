import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { uploadFile, getPresignedUrl } from "@/lib/s3";

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
    if (type === "logo" && projectId) {
      s3Key = `logos/${projectId}/${timestamp}.${ext}`;
    } else {
      s3Key = `uploads/${session.user.id}/${timestamp}.${ext}`;
    }

    // Upload to S3
    await uploadFile(s3Key, buffer, file.type);

    // Get the presigned URL
    const url = await getPresignedUrl(s3Key, 60 * 60 * 24 * 365); // 1 year expiry

    return NextResponse.json({
      success: true,
      url,
      key: s3Key,
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
