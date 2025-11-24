"use server";

import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { uploadAndIngest } from "@/app/actions/upload-and-ingest";
import { courses, units } from "@/lib/db/schema";
import type { DocumentSummary } from "@/lib/db/schema";
import { db, getDocumentSummary } from "@/lib/db/queries";

// Simple constants for initial rollout
const MAX_TOPICS = 6;

export async function createCourseFromUpload(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Unauthorized: no user session");
  }

  // Reuse existing ingestion pipeline
  const { documents } = await uploadAndIngest(formData);
  const firstDoc = documents[0];

  if (!firstDoc?.documentId) {
    throw new Error("No documentId returned from uploadAndIngest");
  }

  // Fetch summary + topics from document_summaries (or fall back later if needed)
  let summaryRecord: DocumentSummary | null = null;

  try {
    summaryRecord = await getDocumentSummary({ documentId: firstDoc.documentId });
  } catch {
    // In dev or if DB is not wired, tolerate missing summary and fall back to upload result
  }

  const mainTopics = summaryRecord?.mainTopics || null;
  const courseTitle = firstDoc.title || summaryRecord?.summary?.slice(0, 80) || "New Course";

  // Create course row
  const [course] = await db
    .insert(courses)
    .values({
      userId: session.user.id,
      documentId: firstDoc.documentId,
      title: courseTitle,
      sourceType: "pdf",
      sourceUrl: firstDoc.blobUrl,
    })
    .returning();

  if (!course) {
    throw new Error("Failed to create course");
  }

  // If we have topics, map them to units; otherwise, create a single generic unit
  if (mainTopics && Array.isArray(mainTopics) && mainTopics.length > 0) {
    const limitedTopics = mainTopics.slice(0, MAX_TOPICS);

    await db.insert(units).values(
      limitedTopics.map((topic, index) => ({
        courseId: course.id,
        orderIndex: index,
        title: topic.topic,
        summary: topic.description ?? "",
        isUnlocked: index === 0,
      })),
    );
  } else {
    await db.insert(units).values({
      courseId: course.id,
      orderIndex: 0,
      title: courseTitle,
      summary: firstDoc.summary ?? "",
      isUnlocked: true,
    });
  }

  redirect(`/course/${course.id}`);
}
