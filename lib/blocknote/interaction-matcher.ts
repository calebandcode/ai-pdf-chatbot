import type { ChatMessage } from "@/lib/types";

/**
 * Find AI-generated explanation for a topic
 * Looks for messages with topicExplanation metadata part
 * Returns the LATEST explanation (most recent message)
 */
export function findExplanationForTopic(
  messages: ChatMessage[],
  topicName: string
): string | null {
  const topicLower = topicName.toLowerCase().trim();
  
  // Iterate in reverse to find the LATEST explanation (most recent message)
  // This ensures we get the newest explanation if a topic was expanded multiple times
  let latestExplanation: string | null = null;
  
  // First, try to find by metadata (more reliable) - iterate backwards
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "assistant") {
      // Check for topicExplanation metadata part
      const topicExplanationPart = msg.parts?.find(
        (p) => (p as { type?: string }).type === "data-topicExplanation"
      );
      
      if (topicExplanationPart) {
        const data = (topicExplanationPart as { data?: { topicName?: string; isSubtopic?: boolean } }).data;
        if (data?.topicName?.toLowerCase().trim() === topicLower) {
          // Found exact match - get the text part
          const textPart = msg.parts?.find(p => p.type === "text");
          if (textPart?.text) {
            // Return immediately since we're iterating backwards (latest first)
            return textPart.text;
          }
        }
      }
    }
  }
  
  // Fallback: Look for messages that contain topic name (less reliable) - iterate backwards
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "assistant") {
      const textParts = msg.parts?.filter(p => p.type === "text") || [];
      for (const part of textParts) {
        const text = part.text?.toLowerCase() || "";
        // Simple check: if message mentions topic and is explanation-like
        if (text.includes(topicLower) && text.length > 100) {
          // Return first match found (which is latest since we iterate backwards)
          return part.text || null;
        }
      }
    }
  }
  
  return null;
}

/**
 * Find Q&A pairs related to a topic
 */
export function findQAByTopic(
  messages: ChatMessage[],
  topicName: string
): Array<{ question: string; answer: string }> {
  const topicLower = topicName.toLowerCase();
  const qaPairs: Array<{ question: string; answer: string }> = [];
  
  for (let i = 0; i < messages.length - 1; i++) {
    const userMsg = messages[i];
    const assistantMsg = messages[i + 1];
    
    if (userMsg.role === "user" && assistantMsg.role === "assistant") {
      const questionPart = userMsg.parts?.find(p => p.type === "text");
      const answerPart = assistantMsg.parts?.find(p => p.type === "text");
      
      if (questionPart && answerPart) {
        const question = questionPart.text?.toLowerCase() || "";
        // Simple check: if question mentions topic
        if (question.includes(topicLower)) {
          qaPairs.push({
            question: questionPart.text || "",
            answer: answerPart.text || ""
          });
        }
      }
    }
  }
  
  return qaPairs;
}

