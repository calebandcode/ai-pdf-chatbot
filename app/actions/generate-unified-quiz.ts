"use server";

import { generateObject } from "ai";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { myProvider } from "@/lib/ai/providers";
import {
  buildDocumentQuizContextExtras,
  type DocumentQuizContextExtras,
} from "@/lib/ai/quiz/document-context";
import { getDocumentChunks } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import {
  type DocumentQuizContext,
  type QuizContext,
  QuizQuestion,
  type QuizResult,
  QuizScope,
  type SubtopicQuizContext,
  type TopicQuizContext,
  type DocumentQuizDiagnostics,
} from "@/lib/types/quiz";

const QuizQuestionSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  options: z.object({
    A: z.string(),
    B: z.string(),
    C: z.string(),
    D: z.string(),
  }),
  correct: z.string(),
  explanation: z.string(),
  difficulty: z.enum(["easy", "medium", "hard", "mixed", "easy-medium"]),
  sourcePages: z.array(z.number()),
});

const QuizResultSchema = z.object({
  quizId: z.string(),
  questions: z.array(QuizQuestionSchema),
  title: z.string(),
  scope: z.enum(["subtopic", "topic", "document"]),
  context: z.object({
    scope: z.string(),
    questionCount: z.number(),
    difficulty: z.string(),
  }),
});

const BASE_SYSTEM_PROMPT = `You are an expert AI study tutor.

Core expectations:
- Stay fully grounded in the provided material
- Use the SAME LANGUAGE as the learner's document for every output
- Keep a supportive but rigorous tone
- Produce multiple-choice questions with four labelled options (A, B, C, D)
- Provide clear explanations that reference the source material
- Include page citations when they add clarity
- Avoid structural, navigation, or section-location trivia entirely
- Aim for a healthy mix of conceptual and applied/scenario questions`;

const STRUCTURAL_REGEX =
  /\b(section|chapter|heading|appendix|table of contents|which (section|chapter|part)|which of the following sections|paragraph)\b/i;
const SCENARIO_REGEX =
  /\b(scenario|case|situation|project|client|patient|team|classroom|consider|suppose|imagine|you are|your company|if\s)\b/i;
const BANNED_OPTION_REGEX = /\b(all of the above|none of the above)\b/i;
const COVERAGE_TOKENIZER_REGEX = /[^a-z0-9]+/g;
const MIN_PROMPT_TOKENS = 6;
const REDUNDANCY_THRESHOLD = 0.7;
const LITERAL_OVERLAP_THRESHOLD = 0.85;
const LITERAL_MIN_TOKENS = 8;

function buildAggregatedTopics(context: DocumentQuizContext): string {
  const topics = [...context.allTopics];
  const MAX_TOPICS = 8;
  const sampled =
    topics.length > MAX_TOPICS
      ? topics
          .slice()
          .sort(() => 0.5 - Math.random())
          .slice(0, MAX_TOPICS)
      : topics;

  const clamp = (text: string, max = 400) =>
    text.length > max ? `${text.slice(0, max)}...` : text;

  return sampled
    .map((t) => {
      const title = t.topic;
      const summary = clamp(t.description || "");
      return `Topic: ${title}\nSummary: ${summary}`;
    })
    .join("\n\n");
}

function buildQuizPrompt(context: QuizContext): string {
  const basePrompt = `You are an expert AI study tutor. Create questions that probe real understanding, not superficial recall.

Global guardrails:
- ALWAYS write in the SAME LANGUAGE as the provided material
- ONLY use the supplied context; do not invent facts
- Avoid structural, navigation, or section-location questions
- Prioritise conceptual understanding, causal reasoning, comparisons, and scenario/application thinking
- Keep an encouraging, conversational tone that still challenges the learner
- Every explanation must reinforce why the answer is correct using the source material`;

  switch (context.scope) {
    case "subtopic":
      return `${basePrompt}

CONTEXT: Subtopic Quiz
- Document: "${context.documentTitle || "Unknown Document"}"
- Subtopic: "${context.subtopicName}"
- Parent Topic: "${context.parentTopicName}"
- Pages: ${context.subtopicPages.join(", ")}
- Question Count: ${context.questionCount}
- Difficulty: ${context.difficulty}

CONTENT TO BASE QUESTIONS ON:
${context.subtopicContent}

RAW DOCUMENT CONTENT:
${context.rawContent}

Generate ${context.questionCount} focused questions about "${context.subtopicName}". Questions should test understanding of the specific concepts covered in this subtopic. IMPORTANT: Generate all questions, options, and explanations in the same language as the document content.

CRITICAL: Base your questions ONLY on the content shown above. Do not create generic questions about ${context.subtopicName} - use the actual content provided.`;

    case "topic":
      return `${basePrompt}

CONTEXT: Topic Quiz
- Document: "${context.documentTitle || "Unknown Document"}"
- Topic: "${context.topicName}"
- Pages: ${context.topicPages.join(", ")}
- Question Count: ${context.questionCount}
- Difficulty: ${context.difficulty}

SUBTTOPICS COVERED:
${context.allSubtopics.map((st) => `- ${st.subtopic} (pages ${st.pages.join(", ")})`).join("\n")}

TOPIC CONTENT:
${context.topicContent}

RAW DOCUMENT CONTENT:
${context.rawContent}

Generate ${context.questionCount} comprehensive questions about "${context.topicName}". Questions should cover all subtopics and test overall understanding of the topic. IMPORTANT: Generate all questions, options, and explanations in the same language as the document content.

CRITICAL: Base your questions ONLY on the content shown above. Do not create generic questions about ${context.topicName} - use the actual content provided.`;

    case "document": {
      const docCtx = context as DocumentQuizContext;
      const topics = docCtx.allTopics || [];
      const outline = topics
        .map((topic, index) => {
          const subtopics = topic.subtopics
            ?.map(
              (subtopic) =>
                `    - ${subtopic.subtopic} (pages ${subtopic.pages.join(", ")})`
            )
            .join("\n");
          return `${index + 1}. ${topic.topic} (pages ${topic.pages.join(", ")})
    Summary: ${topic.description || "N/A"}
${subtopics ? `${subtopics}` : ""}`;
        })
        .join("\n\n");

      const summaries =
        docCtx.compressedSummaries?.length
          ? docCtx.compressedSummaries
              .map(
                (summary, index) =>
                  `${index + 1}. ${summary.title} (${summary.kind}${
                    summary.kind === "subtopic" && summary.parentTopicId
                      ? ` -> ${summary.parentTopicId}`
                      : ""
                  }, pages ${summary.pages.join(", ")}): ${summary.summary}`
              )
              .join("\n")
          : buildAggregatedTopics(docCtx);

      const snippets =
        docCtx.sampledSnippets?.length
          ? docCtx.sampledSnippets
              .map(
                (snippet, index) =>
                  `Snippet ${index + 1} - page ${snippet.page} (${snippet.reason} sample)\n${snippet.content}`
              )
              .join("\n\n")
          : "";

      return `${basePrompt}

CONTEXT: Full Document Quiz
- Document: "${docCtx.documentTitle}"
- Total Pages: ${docCtx.allPages.length}
- Question Count: ${docCtx.questionCount}
- Difficulty: ${docCtx.difficulty}
- Schema Version: ${docCtx.schemaVersion ?? 1}

TOPIC OUTLINE:
${outline || "No outline available"}

COMPRESSED SUMMARIES (concept essentials):
${summaries}

KEY RAW SNIPPETS (for evidence and detail):
${snippets || "No additional snippets provided"}

Question requirements:
1. Cover at least three distinct top-level topics (or as many as available)
2. >=40% of questions must be scenario-based or application-focused
3. Remaining questions probe conceptual understanding, causal links, comparisons, or implications
4. Vary the real-world situations so no two questions feel like the same story
5. Each question must cite relevant page numbers when referencing specific content
6. Distractors must be plausible, mutually exclusive, and reflect realistic misconceptions
7. Absolutely no structural/navigation/meta questions or verbatim restatements of a single sentence

Validation checklist (self-verify before finalising):
- [ ] Every question stems from the provided summaries/snippets
- [ ] At least one application scenario is present
- [ ] No structural/meta wording appears
- [ ] Coverage spans multiple topics
- [ ] Each explanation reinforces the concept and cites supporting evidence`;
    }

    default:
      throw new Error(`Unsupported quiz scope: ${(context as any).scope}`);
  }
}

function generateQuizId(): string {
  return `quiz-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export async function generateUnifiedQuiz(
  context: QuizContext
): Promise<QuizResult> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new ChatSDKError("unauthorized:api", "User session not found");
  }

  try {
    const { enrichedContext, rawContent, extras } =
      await prepareQuizContext(context);

    console.log("[quiz] generation-context:", {
      scope: enrichedContext.scope,
      documentTitle: enrichedContext.documentTitle,
      rawContentLength: rawContent.length,
      rawContentPreview: rawContent.slice(0, 200) + "...",
      snippets:
        enrichedContext.scope === "document"
          ? (enrichedContext as DocumentQuizContext).sampledSnippets?.length
          : "N/A",
      configVersion:
        enrichedContext.scope === "document"
          ? (enrichedContext as DocumentQuizContext).generationConfig?.version
          : "N/A",
      documentIds: enrichedContext.documentIds,
    });

    const prompt = buildQuizPrompt(enrichedContext);
    const generation = await runGenerationWithQuality({
      context: enrichedContext,
      prompt,
    });

    const quizId = generateQuizId();
    const title = getQuizTitle(enrichedContext);

    let finalContext: QuizContext = enrichedContext;
    if (enrichedContext.scope === "document") {
      const docCtx = enrichedContext as DocumentQuizContext;
      finalContext = {
        ...docCtx,
        diagnostics: mergeDiagnostics(
          docCtx.diagnostics,
          generation.diagnostics,
          extras
        ),
      };
    }

    return {
      quizId,
      questions: generation.questions,
      title,
      scope: enrichedContext.scope,
      context: finalContext,
      diagnostics: generation.diagnostics,
    };
  } catch (error) {
    console.error("Error generating unified quiz:", error);
    throw new ChatSDKError("offline:api", "Failed to generate quiz questions");
  }
}

async function runGenerationWithQuality({
  context,
  prompt,
}: {
  context: QuizContext;
  prompt: string;
}): Promise<{
  questions: QuizQuestion[];
  diagnostics?: DocumentQuizDiagnostics;
}> {
  const maxAttempts = context.scope === "document" ? 2 : 1;
  let augmentedPrompt = prompt;
  let attempts = 0;
  let lastDiagnostics: DocumentQuizDiagnostics | undefined;
  let finalQuestions: QuizQuestion[] = [];

  while (attempts < maxAttempts) {
    attempts += 1;

    const result = await generateObject({
      model: myProvider.languageModel("chat-model"),
      schema: QuizResultSchema,
      prompt: augmentedPrompt,
      system: BASE_SYSTEM_PROMPT,
    });

    let questions: QuizQuestion[] = result.object.questions ?? [];

    if (context.scope === "document") {
      const evaluation = evaluateDocumentQuestions(
        questions,
        context as DocumentQuizContext
      );
      lastDiagnostics = evaluation.diagnostics;

      if (evaluation.shouldRegenerate && attempts < maxAttempts) {
        augmentedPrompt = `${prompt}

Regeneration note #${attempts}: ${evaluation.regenReason}. Remove structural/meta questions and expand conceptual + applied coverage.`;
        continue;
      }

      questions = evaluation.questions.length
        ? evaluation.questions
        : evaluation.fallback.slice(
            0,
            (context as DocumentQuizContext).questionCount
          );
    }

    finalQuestions = normalizeQuestions(questions, context);
    break;
  }

  if (!finalQuestions.length) {
    finalQuestions = normalizeQuestions([], context);
  }

  return {
    questions: finalQuestions,
    diagnostics: lastDiagnostics,
  };
}

async function prepareQuizContext(
  context: QuizContext
): Promise<{
  enrichedContext: QuizContext;
  rawContent: string;
  extras?: DocumentQuizContextExtras;
}> {
  switch (context.scope) {
    case "subtopic": {
      const ctx = context as SubtopicQuizContext;
      if (ctx.rawContent && ctx.rawContent.length > 0) {
        return { enrichedContext: ctx, rawContent: ctx.rawContent };
      }

      const documentId = ctx.documentIds[0];
      const chunks = await getDocumentChunks({ documentId });
      const relevant = chunks.filter((chunk) =>
        ctx.subtopicPages.includes(chunk.page)
      );
      const rawContent = relevant
        .map((chunk) => `Page ${chunk.page}: ${chunk.content}`)
        .join("\n\n");

      return {
        enrichedContext: { ...ctx, rawContent },
        rawContent,
      };
    }

    case "topic": {
      const ctx = context as TopicQuizContext;
      if (ctx.rawContent && ctx.rawContent.length > 0) {
        return { enrichedContext: ctx, rawContent: ctx.rawContent };
      }

      const documentId = ctx.documentIds[0];
      const chunks = await getDocumentChunks({ documentId });
      const relevant = chunks.filter((chunk) =>
        ctx.topicPages.includes(chunk.page)
      );
      const rawContent = relevant
        .map((chunk) => `Page ${chunk.page}: ${chunk.content}`)
        .join("\n\n");

      return {
        enrichedContext: { ...ctx, rawContent },
        rawContent,
      };
    }

    case "document": {
      const ctx = context as DocumentQuizContext;
      const allChunks = [];
      for (const documentId of ctx.documentIds) {
        try {
          const chunks = await getDocumentChunks({ documentId });
          allChunks.push(...chunks);
        } catch (error) {
          console.warn("[quiz] failed to fetch document chunks:", {
            documentId,
            error,
          });
        }
      }

      const extras = await buildDocumentQuizContextExtras({
        chunks: allChunks,
        context: ctx,
        config: ctx.generationConfig,
      });

      let rawContent = extras.sampledSnippets
        .map((snippet) => `Page ${snippet.page}: ${snippet.content}`)
        .join("\n\n");

      const combinedSummary =
        ctx.documentSummary ||
        extras.compressedSummaries
          .filter((summary) => summary.kind === "topic")
          .map((summary) => summary.summary)
          .join(" ");

      let enrichedContext: DocumentQuizContext = {
        ...ctx,
        schemaVersion: extras.config.version,
        sampledSnippets: extras.sampledSnippets,
        compressedSummaries: extras.compressedSummaries,
        generationConfig: extras.config,
        diagnostics: mergeDiagnostics(ctx.diagnostics, undefined, extras),
        documentSummary: combinedSummary,
        rawContent,
      };

      if (!rawContent.length) {
        rawContent = buildAggregatedTopics(enrichedContext);
        enrichedContext = { ...enrichedContext, rawContent };
      }

      return {
        enrichedContext,
        rawContent,
        extras,
      };
    }

    default:
      return { enrichedContext: context, rawContent: "" };
  }
}

function mergeDiagnostics(
  existing?: DocumentQuizDiagnostics,
  evaluation?: DocumentQuizDiagnostics,
  extras?: DocumentQuizContextExtras
): DocumentQuizDiagnostics | undefined {
  if (!existing && !evaluation && !extras) {
    return evaluation ?? existing;
  }

  return {
    approxTokenCount:
      evaluation?.approxTokenCount ??
      existing?.approxTokenCount ??
      extras?.totalApproxTokens,
    snippetCount:
      evaluation?.snippetCount ??
      existing?.snippetCount ??
      extras?.sampledSnippets.length,
    coverageRatio: evaluation?.coverageRatio ?? existing?.coverageRatio,
    applicationRatio: evaluation?.applicationRatio ?? existing?.applicationRatio,
    structuralQuestionCount:
      evaluation?.structuralQuestionCount ?? existing?.structuralQuestionCount,
    redundantQuestionCount:
      evaluation?.redundantQuestionCount ?? existing?.redundantQuestionCount,
    literalQuestionCount:
      evaluation?.literalQuestionCount ?? existing?.literalQuestionCount,
    intentCounts: evaluation?.intentCounts ?? existing?.intentCounts,
    dropCounts: evaluation?.dropCounts ?? existing?.dropCounts,
  };
}

type DocumentEvaluation = {
  questions: QuizQuestion[];
  fallback: QuizQuestion[];
  diagnostics: DocumentQuizDiagnostics;
  shouldRegenerate: boolean;
  regenReason: string;
};

function evaluateDocumentQuestions(
  questions: QuizQuestion[],
  context: DocumentQuizContext
): DocumentEvaluation {
  const accepted: QuizQuestion[] = [];
  const fallback: QuizQuestion[] = [];
  const topicMatches = new Set<string>();
  let structuralCount = 0;
  let scenarioCount = 0;
  let conceptualCount = 0;
  let recallCount = 0;
  let redundantDrops = 0;
  let literalDrops = 0;

  const snippetTokenSets = (context.sampledSnippets ?? []).map((snippet) =>
    new Set(tokenize(snippet.content))
  );
  const acceptedTokenSets: Array<Set<string>> = [];

  const topicTokens = (context.allTopics || []).flatMap((topic) => {
    const tokens = [topic.topic, topic.description || ""]
      .filter(Boolean)
      .map((token) => sanitize(token))
      .filter((token) => token.length > 2);
    const subtopicTokens =
      topic.subtopics?.map((subtopic) =>
        sanitize(subtopic.subtopic)
      ) || [];
    return [...tokens, ...subtopicTokens];
  });

  for (const question of questions) {
    const trimmedOptions = Object.fromEntries(
      ["A", "B", "C", "D"].map((label) => [
        label,
        (question.options?.[label] || "").trim(),
      ])
    );
    const normalizedCorrect = (question.correct || "A").trim().toUpperCase();
    const correctOption = ["A", "B", "C", "D"].includes(normalizedCorrect)
      ? normalizedCorrect
      : "A";

    const normalizedQuestion: QuizQuestion = {
      ...question,
      options: trimmedOptions,
      correct: correctOption,
      sourcePages: Array.isArray(question.sourcePages)
        ? question.sourcePages
        : [],
    };

    const prompt = question.prompt || "";
    const explanation = question.explanation || "";
    const promptTokens = tokenize(prompt);
    const promptSet = new Set(promptTokens);

    fallback.push(normalizedQuestion);

    if (
      STRUCTURAL_REGEX.test(prompt) ||
      STRUCTURAL_REGEX.test(explanation) ||
      BANNED_OPTION_REGEX.test(
        Object.values(trimmedOptions).join(" ").toLowerCase()
      )
    ) {
      structuralCount += 1;
      continue;
    }

    if (
      promptTokens.length >= LITERAL_MIN_TOKENS &&
      isOverlyLiteral(promptSet, snippetTokenSets)
    ) {
      literalDrops += 1;
      continue;
    }

    if (isRedundantPrompt(promptSet, acceptedTokenSets)) {
      redundantDrops += 1;
      continue;
    }

    const isScenario = detectScenarioQuestion(normalizedQuestion);
    if (isScenario) {
      scenarioCount += 1;
      normalizedQuestion.type = "scenario";
    } else if (!normalizedQuestion.type) {
      normalizedQuestion.type = "multiple_choice";
    }

    if (!isScenario) {
      if (isConceptualPrompt(prompt)) {
        conceptualCount += 1;
      } else {
        recallCount += 1;
      }
    }

    const normalizedPromptText = sanitize(prompt);
    topicTokens.forEach((token) => {
      if (token && normalizedPromptText.includes(token)) {
        topicMatches.add(token);
      }
    });

    accepted.push(normalizedQuestion);
    acceptedTokenSets.push(promptSet);
  }

  const coverageRatio =
    topicTokens.length > 0
      ? Math.min(
          1,
          topicMatches.size / Math.max(1, Math.min(topicTokens.length, accepted.length))
        )
      : undefined;
  const applicationRatio =
    accepted.length > 0 ? scenarioCount / accepted.length : 0;

  const diagnostics: DocumentQuizDiagnostics = {
    approxTokenCount: context.diagnostics?.approxTokenCount,
    snippetCount: context.sampledSnippets?.length,
    structuralQuestionCount: structuralCount,
    coverageRatio,
    applicationRatio,
    redundantQuestionCount: redundantDrops,
    literalQuestionCount: literalDrops,
    intentCounts: {
      scenario: scenarioCount,
      conceptual: conceptualCount,
      recall: recallCount,
    },
    dropCounts: {
      structural: structuralCount,
      redundant: redundantDrops,
      literal: literalDrops,
    },
  };

  const regenReasons: string[] = [];
  if (structuralCount > 0) {
    regenReasons.push("remove structural or navigation-based questions");
  }
  if (coverageRatio !== undefined && coverageRatio < 0.6) {
    regenReasons.push("increase coverage across distinct topics");
  }
  if (applicationRatio < 0.4 && accepted.length >= context.questionCount) {
    regenReasons.push("raise the proportion of applied/scenario questions");
  }
  if (accepted.length < context.questionCount) {
    regenReasons.push("insufficient high-quality questions generated");
  }

  console.log("[quiz] document diagnostics:", {
    structuralCount,
    scenarioCount,
    conceptualCount,
    recallCount,
    redundantDrops,
    literalDrops,
    coverageRatio,
    applicationRatio,
    acceptedCount: accepted.length,
  });

  return {
    questions: accepted.slice(0, context.questionCount),
    fallback: fallback.slice(0, context.questionCount),
    diagnostics,
    shouldRegenerate: regenReasons.length > 0,
    regenReason: regenReasons.join("; "),
  };
}

function normalizeQuestions(
  questions: QuizQuestion[],
  context: QuizContext
): QuizQuestion[] {
  if (!questions.length) {
    return [];
  }

  return questions.slice(0, context.questionCount).map((question, index) => {
    const trimmedOptions = Object.fromEntries(
      ["A", "B", "C", "D"].map((label) => [
        label,
        (question.options?.[label] || "").trim(),
      ])
    );
    const normalizedCorrect = (question.correct || "A").trim().toUpperCase();
    const correctOption = ["A", "B", "C", "D"].includes(normalizedCorrect)
      ? normalizedCorrect
      : "A";

    return {
      ...question,
      id: question.id || `q${index + 1}`,
      options: trimmedOptions,
      correct: correctOption,
      type: question.type || "multiple_choice",
      sourcePages: Array.isArray(question.sourcePages)
        ? question.sourcePages
        : [],
    };
  });
}

function detectScenarioQuestion(question: QuizQuestion): boolean {
  const prompt = question.prompt || "";
  return SCENARIO_REGEX.test(prompt) || /\bif\b.+\?/i.test(prompt);
}

function tokenize(text: string): string[] {
  return sanitize(text)
    .split(" ")
    .filter(Boolean);
}

function sanitize(text: string): string {
  return text.toLowerCase().replace(COVERAGE_TOKENIZER_REGEX, " ").trim();
}

function jaccardSimilarity(
  a: Set<string>,
  b: Set<string>
): number {
  if (a.size === 0 || b.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) {
      intersection += 1;
    }
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function isOverlyLiteral(
  promptTokens: Set<string>,
  snippetTokenSets: Array<Set<string>>
): boolean {
  if (promptTokens.size === 0 || snippetTokenSets.length === 0) {
    return false;
  }
  for (const snippetTokens of snippetTokenSets) {
    const similarity = jaccardSimilarity(promptTokens, snippetTokens);
    if (similarity >= LITERAL_OVERLAP_THRESHOLD) {
      return true;
    }
  }
  return false;
}

function isRedundantPrompt(
  promptTokens: Set<string>,
  acceptedTokenSets: Array<Set<string>>
): boolean {
  if (promptTokens.size === 0) {
    return false;
  }
  for (const existing of acceptedTokenSets) {
    const similarity = jaccardSimilarity(promptTokens, existing);
    if (similarity >= REDUNDANCY_THRESHOLD) {
      return true;
    }
  }
  return false;
}

function isConceptualPrompt(prompt: string): boolean {
  const lowered = prompt.toLowerCase();
  if (
    /\b(why|how|impact|effect|consequence|result|compare|contrast|difference|improve|optimize|should|best|choose|recommend)\b/.test(
      lowered
    )
  ) {
    return true;
  }
  const tokens = tokenize(lowered);
  return tokens.length >= Math.max(MIN_PROMPT_TOKENS, 10);
}

function getQuizTitle(context: QuizContext): string {
  switch (context.scope) {
    case "subtopic":
      return `Quiz: ${context.subtopicName}`;
    case "topic":
      return `Quiz: ${context.topicName}`;
    case "document":
      return `Quiz: ${context.documentTitle}`;
    default:
      return "Quiz";
  }
}
