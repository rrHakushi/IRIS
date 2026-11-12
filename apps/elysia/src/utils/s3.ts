import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3"

const RUSTFS_URL = Bun.env.RUSTFS_URL
const RUSTFS_REGION = Bun.env.RUSTFS_REGION
const RUSTFS_ACCESS_KEY = Bun.env.RUSTFS_ACCESS_KEY
const RUSTFS_SECRET_KEY = Bun.env.RUSTFS_SECRET_KEY
export const PUBLIC_BUCKET = Bun.env.RUSTFS_PUBLIC_BUCKET!
export const ENCRYPTED_BUCKET = Bun.env.RUSTFS_ENCRYPTED_BUCKET

if (!RUSTFS_URL || !RUSTFS_REGION || !RUSTFS_ACCESS_KEY || !RUSTFS_SECRET_KEY || !PUBLIC_BUCKET) {
  const missing = [
    !RUSTFS_URL && "RUSTFS_URL",
    !RUSTFS_REGION && "RUSTFS_REGION",
    !RUSTFS_ACCESS_KEY && "RUSTFS_ACCESS_KEY",
    !RUSTFS_SECRET_KEY && "RUSTFS_SECRET_KEY",
    !PUBLIC_BUCKET && "RUSTFS_PUBLIC_BUCKET",
  ].filter(Boolean)
  throw new Error(`Missing required RustFS environment variable(s): ${missing.join(", ")}`)
}

export const s3Client = new S3Client({
  endpoint: RUSTFS_URL,
  region: RUSTFS_REGION,
  credentials: {
    accessKeyId: RUSTFS_ACCESS_KEY,
    secretAccessKey: RUSTFS_SECRET_KEY,
  },
  forcePathStyle: true,
})

let bucketChecked = false

export async function ensurePublicBucketExists(): Promise<void> {
  if (bucketChecked) return
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: PUBLIC_BUCKET }))
    bucketChecked = true
  } catch (err: any) {
    if (err?.name === "NotFound" || err?.$metadata?.httpStatusCode === 404) {
      try {
        await s3Client.send(new CreateBucketCommand({ Bucket: PUBLIC_BUCKET }))
        bucketChecked = true
      } catch (createErr) {
        console.warn(
          `[RustFS] Warning creating bucket ${PUBLIC_BUCKET}:`,
          createErr
        )
      }
    } else {
      // If error is other (e.g. connection refused in offline testing), log softly
      console.warn(
        `[RustFS] S3 HeadBucket info for ${PUBLIC_BUCKET}:`,
        err?.message || err
      )
    }
  }
}

export async function uploadPublicAsset(params: {
  key: string
  body: Uint8Array | Buffer
  contentType: string
}): Promise<{ key: string; publicUrl: string }> {
  await ensurePublicBucketExists()

  await s3Client.send(
    new PutObjectCommand({
      Bucket: PUBLIC_BUCKET,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    })
  )

  return {
    key: params.key,
    publicUrl: `/public/${params.key}`,
  }
}

export async function getPublicAsset(key: string): Promise<{
  body: ReadableStream | any
  contentType?: string
  contentLength?: number
} | null> {
  try {
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: PUBLIC_BUCKET,
        Key: key,
      })
    )

    return {
      body: response.Body,
      contentType: response.ContentType || "application/octet-stream",
      contentLength: response.ContentLength,
    }
  } catch (err: any) {
    if (err?.name === "NoSuchKey" || err?.$metadata?.httpStatusCode === 404) {
      return null
    }
    return null
  }
}

export function extractS3Key(
  urlOrKey: string | null | undefined
): string | null {
  if (!urlOrKey || typeof urlOrKey !== "string") return null
  const clean = urlOrKey
    .replace(/^(?:https?:\/\/[^/]+)?\/public\//, "")
    .replace(/^\/+/, "")
  return clean.startsWith("users/") ? clean : null
}

export async function deletePublicAsset(urlOrKey: string): Promise<boolean> {
  const key = extractS3Key(urlOrKey) || urlOrKey
  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: PUBLIC_BUCKET,
        Key: key,
      })
    )
    return true
  } catch (err) {
    console.error(`[RustFS] Failed to delete object ${key}:`, err)
    return false
  }
}
