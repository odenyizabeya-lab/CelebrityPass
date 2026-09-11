import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function uploadChatAttachment(params: {
  bucket: string
  path: string
  file: Buffer | ArrayBuffer | Uint8Array
  contentType: string
}): Promise<{ bucket: string; key: string; url: string } | null> {
  try {
    const { error } = await supabase.storage
      .from(params.bucket)
      .upload(params.path, params.file, {
        contentType: params.contentType,
        upsert: false,
      })
    if (error) {
      console.error("Failed to upload chat attachment", error)
      return null
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from(params.bucket).getPublicUrl(params.path)
    return { bucket: params.bucket, key: params.path, url: publicUrl }
  } catch (err) {
    console.error("Failed to upload chat attachment", err)
    return null
  }
}

export async function getSignedUrl(
  bucket: string,
  key: string,
  expiresIn?: number
): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(key, expiresIn ?? 3600)
    if (error) {
      console.error("Failed to create signed URL", error)
      return null
    }
    return data.signedUrl
  } catch (err) {
    console.error("Failed to create signed URL", err)
    return null
  }
}

export async function deleteChatAttachment(
  bucket: string,
  key: string
): Promise<boolean> {
  try {
    const { error } = await supabase.storage.from(bucket).remove([key])
    if (error) {
      console.error("Failed to delete chat attachment", error)
      return false
    }
    return true
  } catch (err) {
    console.error("Failed to delete chat attachment", err)
    return false
  }
}