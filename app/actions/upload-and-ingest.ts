"use server";

import { put } from "@vercel/blob";
import { auth } from "@/app/(auth)/auth";
import {
  createDocumentRecord,
  saveDocumentChunks,
} from "@/lib/db/queries";
import { embedChunks } from "@/lib/ingest/embed";
import { chunkPages } from "@/lib/ingest/chunk";
import { extractPdfPages } from "@/lib/ingest/pdf";
import { ensureVectorIndex } from "@/lib/ingest/vector";
import { ChatSDKError } from "@/lib/errors";

type UploadResult = {
  documentId: string;
  title: string;
  blobUrl: string;
  chunksInserted: number;
};

function sanitizeTitle(filename: string) {
  return filename.replace(/\.pdf$/i, "");
}

function isFile(value: unknown): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

export async function uploadAndIngest(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new ChatSDKError("unauthorized:api", "User session not found");
  }

  const files = formData.getAll("files").filter(isFile);

  if (files.length === 0) {
    throw new ChatSDKError("bad_request:api", "No files provided");
  }

  const results: UploadResult[] = [];

  for (const file of files) {
    if (file.type !== "application/pdf") {
      throw new ChatSDKError(
        "bad_request:api",
        `Unsupported file type: ${file.type}`
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const blob = await put(`documents/${file.name}`, buffer, {
      access: "private",
      addRandomSuffix: true,
      contentType: file.type,
    });

    const title = sanitizeTitle(file.name);

    const documentRecord = await createDocumentRecord({
      userId: session.user.id,
      title,
      blobUrl: blob.url,
    });

    const pages = await extractPdfPages(buffer);
    const chunks = chunkPages(pages);
    const embedded = await embedChunks(chunks);

    await saveDocumentChunks({
      documentId: documentRecord.id,
      chunks: embedded.map((chunk) => ({
        page: chunk.page,
        content: chunk.content,
        embedding: chunk.embedding,
        tokens: chunk.tokens ?? null,
      })),
    });

    results.push({
      documentId: documentRecord.id,
      title: documentRecord.title,
      blobUrl: documentRecord.blobUrl,
      chunksInserted: embedded.length,
    });
  }

  await ensureVectorIndex();

  return { documents: results };
}
