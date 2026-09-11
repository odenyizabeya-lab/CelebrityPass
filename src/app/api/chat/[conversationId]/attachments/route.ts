import { NextResponse } from "next/server";
import { getCurrentFanId } from "@/lib/auth";
import { canFanSendMessage, isConversationAccessible } from "@/lib/chat/access";
import { uploadChatAttachment } from "@/lib/storage";
import { touchFanPresence } from "@/lib/chat/presence";

export const dynamic = "force-dynamic";

const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "audio/webm",
  "audio/mpeg",
  "audio/ogg",
  "video/mp4",
  "video/webm",
  "application/octet-stream",
]);

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

type Ctx = { params: Promise<{ conversationId: string }> };

export async function POST(request: Request, { params }: Ctx) {
  const { conversationId } = await params;
  const fanId = await getCurrentFanId();
  if (!fanId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { accessible, conversation } = await isConversationAccessible(
    conversationId,
    "fan",
    fanId,
  );
  if (!accessible || !conversation) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { allowed, reason } = await canFanSendMessage(fanId, conversation.celebrityId);
  if (!allowed) {
    return NextResponse.json(
      { error: reason ?? "Not allowed to send attachment" },
      { status: 403 },
    );
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_MIMES.has(mime)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File exceeds 25 MB limit" },
      { status: 413 },
    );
  }

  const name = file.name || "attachment";
  const safeName = name.replace(/[^\w.\- ]+/g, "").slice(0, 120);
  const ext = safeName.split(".").pop() || "bin";
  const key = `fan-${fanId}/conversation-${conversationId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const uploaded = await uploadChatAttachment({
    bucket: "chat-attachments",
    path: key,
    file: buffer,
    contentType: mime,
  });
  if (!uploaded) {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  touchFanPresence(fanId).catch(() => {});
  return NextResponse.json(
    {
      attachment: {
        bucket: uploaded.bucket,
        key: uploaded.key,
        url: uploaded.url,
        mime,
        size: buffer.length,
        name: safeName,
      },
      conversationId,
    },
    { status: 201 },
  );
}