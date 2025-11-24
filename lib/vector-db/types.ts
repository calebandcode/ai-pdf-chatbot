// Types for topic embedding operations

export type TopicEmbeddingData = {
  chatId: string;
  documentId: string;
  topicId: string;
  topicTitle: string;
  topicDescription?: string;
  embedding: number[];
  topicData: {
    topic: string;
    description?: string;
    pages?: number[];
    subtopics?: Array<{
      subtopic: string;
      description?: string;
      pages?: number[];
    }>;
  };
};

export type SimilarTopic = {
  topicId: string;
  topicTitle: string;
  topicDescription?: string;
  similarity: number;
  chatId: string;
  documentId: string;
  topicData: TopicEmbeddingData["topicData"];
};

export type TopicSearchOptions = {
  chatId: string;
  embedding: number[];
  threshold?: number;
  limit?: number;
  excludeDocumentIds?: string[];
};










