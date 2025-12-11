export type SpaceID = string;

export type SpaceAsset = {
  id: string;
  kind: "image" | "doc" | "note";
  url?: string;     // e.g., /uploads/...
  title?: string;
  text?: string;    // for notes
  createdAt: string;
};

export type SpaceMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  attachments?: SpaceAsset[];
  createdAt: string;
  scope?: {
    nodeId: string;
    nodeType: "topic" | "idea" | "query" | "evidence" | "report" | "image";
    imageUrl?: string;
  };
};

export type SpaceSnapshot = {
  id: SpaceID;
  topic: string;
  ideation: Array<{ id: string; title: string }>;
  queries: Array<{ id: string; query: string; priority: number }>;
  findings: Array<{ id: string; text: string; refs?: Array<{ title: string; url: string }> }>;
  reportMarkdown: string;
  references: Array<{ id: number; title: string; url: string; source?: string }>;
  createdAt: string;
  assets: SpaceAsset[];
  messages: SpaceMessage[];
};
