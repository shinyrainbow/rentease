import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET!;

export async function uploadFile(
  key: string,
  body: Buffer,
  contentType: string,
  isPublic: boolean = false
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
    ...(isPublic && { ACL: "public-read" }),
  });

  await s3Client.send(command);
  return key;
}

// Get public URL for objects with public-read ACL
export function getPublicUrl(key: string): string {
  return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

export async function getPresignedUrl(
  key: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
}

export function getS3Key(type: "invoice" | "receipt", id: string, lang: string): string {
  const timestamp = Date.now();
  return `${type}s/${id}/${lang}-${timestamp}.pdf`;
}

// Check if a string is an S3 key (not a full URL)
export function isS3Key(value: string): boolean {
  return value && !value.startsWith("http://") && !value.startsWith("https://");
}

// Resolve a logo URL - if it's an S3 key, generate a presigned URL; otherwise return as-is
export async function resolveLogoUrl(logoUrlOrKey: string | null | undefined): Promise<string | null> {
  if (!logoUrlOrKey) return null;

  if (isS3Key(logoUrlOrKey)) {
    // It's an S3 key, generate a fresh presigned URL (1 hour expiry for display)
    return getPresignedUrl(logoUrlOrKey, 3600);
  }

  // It's already a full URL, return as-is
  return logoUrlOrKey;
}
