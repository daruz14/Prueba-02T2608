export type ToolParameter = {
  readonly type: "string" | "number" | "integer" | "boolean";
  readonly description?: string;
  readonly enum?: readonly string[];
};

export type ToolSpec = {
  readonly name: string;
  readonly description: string;
  readonly parameters: {
    readonly type: "object";
    readonly properties: Readonly<Record<string, ToolParameter>>;
    readonly required?: readonly string[];
  };
};

export type ToolCall = {
  readonly name: string;
  readonly args: Record<string, unknown>;
  readonly id?: string;
  readonly thoughtSignature?: string;
};

export type ChatTurn =
  | { readonly role: "user"; readonly text: string }
  | { readonly role: "model"; readonly text: string; readonly toolCalls: readonly ToolCall[] }
  | { readonly role: "tool"; readonly name: string; readonly id?: string; readonly result: Record<string, unknown> };

export type ChatRequest = {
  readonly systemPrompt: string;
  readonly turns: readonly ChatTurn[];
  readonly tools: readonly ToolSpec[];
};

export type ChatResponse = {
  readonly text: string;
  readonly toolCalls: readonly ToolCall[];
};

export type Responder = (request: ChatRequest) => Promise<ChatResponse>;
