export const DEFAULT_CHAT_MODEL: string = "chat-model";

export type ChatModel = {
  id: string;
  name: string;
  description: string;
};

export const chatModels: ChatModel[] = [
  {
    id: "chat-model",
    name: "Gemini 2.5 Flash",
    description:
      "Fast and efficient multimodal model with vision and text capabilities",
  },
  {
    id: "chat-model-reasoning",
    name: "Gemini Flash Reasoning",
    description:
      "Uses advanced chain-of-thought reasoning for complex problems",
  },
];
