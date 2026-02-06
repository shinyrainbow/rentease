import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { uploadFile, getPresignedUrl, getPublicUrl } from "@/lib/s3";

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
    let isPublic = false;

    if (type === "logo" && projectId) {
      // Logos are stored in "logo" folder and made public
      s3Key = `logo/${projectId}/${timestamp}.${ext}`;
      isPublic = true;
    } else {
      s3Key = `uploads/${session.user.id}/${timestamp}.${ext}`;
    }

    // Upload to S3
    let url: string;

    if (isPublic) {
      // For logos, try with public ACL first, fallback to private if ACL not allowed
      try {
        await uploadFile(s3Key, buffer, file.type, true);
        url = getPublicUrl(s3Key);
      } catch (aclError) {
        // If ACL fails (bucket blocks public access), upload without ACL
        console.warn("Public ACL failed, uploading without ACL:", aclError);
        await uploadFile(s3Key, buffer, file.type, false);
        // Use public URL anyway (works if bucket policy allows public access to logo/ prefix)
        url = getPublicUrl(s3Key);
      }
    } else {
      await uploadFile(s3Key, buffer, file.type, false);
      url = await getPresignedUrl(s3Key, 60 * 60 * 24 * 7); // Max 7 days for presigned URLs
    }

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
