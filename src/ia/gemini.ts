import { GoogleGenAI, Type, type Content, type FunctionDeclaration, type Part, type Schema } from "@google/genai";
import { UpstreamError } from "../errors.js";
import type { ChatRequest, ChatResponse, Responder, ToolCall } from "./types.js";

export type GeminiOptions = {
  readonly apiKey: string;
  readonly model: string;
};

const REQUEST_TIMEOUT_MS = 90_000;
const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1_000;

function toUpstreamError(error: unknown, model: string): UpstreamError {
  if (error instanceof Error && "status" in error) {
    const status = (error as { status?: number }).status;
    return new UpstreamError(`Gemini request failed for model "${model}": ${error.message}`, {
      cause: error,
      statusCode: status,
    });
  }
  return new UpstreamError(`Gemini request failed for model "${model}"`, { cause: error });
}

const PARAMETER_TYPES = {
  string: Type.STRING,
  number: Type.NUMBER,
  integer: Type.INTEGER,
  boolean: Type.BOOLEAN,
} as const;

function toDeclaration(tool: ChatRequest["tools"][number]): FunctionDeclaration {
  const properties = Object.fromEntries(
    Object.entries(tool.parameters.properties).map(([name, parameter]) => [
      name,
      {
        type: PARAMETER_TYPES[parameter.type],
        ...(parameter.description ? { description: parameter.description } : {}),
        ...(parameter.enum ? { enum: [...parameter.enum] } : {}),
      },
    ]),
  ) as Record<string, Schema>;

  return {
    name: tool.name,
    description: tool.description,
    parameters: {
      type: Type.OBJECT,
      properties,
      ...(tool.parameters.required ? { required: [...tool.parameters.required] } : {}),
    },
  };
}

function toContents(turns: ChatRequest["turns"]): Content[] {
  return turns.map((turn) => {
    if (turn.role === "user") {
      return { role: "user", parts: [{ text: turn.text }] };
    }
    if (turn.role === "model") {
      return {
        role: "model",
        parts: [
          ...(turn.text ? [{ text: turn.text }] : []),
          ...turn.toolCalls.map(
            (call) =>
              ({
                functionCall: {
                  name: call.name,
                  args: call.args,
                  ...(call.id ? { id: call.id } : {}),
                },
                ...(call.thoughtSignature ? { thoughtSignature: call.thoughtSignature } : {}),
              }) as Part,
          ),
        ],
      };
    }
    return {
      role: "user",
      parts: [
        {
          functionResponse: {
            name: turn.name,
            response: turn.result,
            ...(turn.id ? { id: turn.id } : {}),
          },
        },
      ],
    };
  });
}

function isRetryable(error: UpstreamError): boolean {
  return error.statusCode === undefined || [429, 500, 502, 503, 504].includes(error.statusCode);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createGeminiResponder(options: GeminiOptions): Responder {
  const client = new GoogleGenAI({
    apiKey: options.apiKey,
    httpOptions: { timeout: REQUEST_TIMEOUT_MS },
  });

  return async ({ systemPrompt, turns, tools }: ChatRequest): Promise<ChatResponse> => {
    let lastError: UpstreamError | undefined;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      if (attempt > 0) {
        await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
      }
      try {
        const response = await client.models.generateContent({
          model: options.model,
          contents: toContents(turns),
          config: {
            systemInstruction: systemPrompt,
            ...(tools.length > 0 ? { tools: [{ functionDeclarations: tools.map(toDeclaration) }] } : {}),
          },
        });

        const rawParts = response.candidates?.[0]?.content?.parts ?? [];
        const toolCalls: ToolCall[] = rawParts.flatMap((part) => {
          const call = part.functionCall;
          if (!call?.name) return [];
          return [
            {
              name: call.name,
              args: call.args ?? {},
              ...(call.id ? { id: call.id } : {}),
              ...(part.thoughtSignature ? { thoughtSignature: part.thoughtSignature } : {}),
            },
          ];
        });
        const text = rawParts
          .flatMap((part) => (part.text ? [{ text: part.text }] : []))
          .map((part) => part.text)
          .join("");

        if (text.length === 0 && toolCalls.length === 0) {
          throw new UpstreamError(`Gemini returned an empty response for model "${options.model}"`);
        }
        return { text, toolCalls };
      } catch (error) {
        if (error instanceof UpstreamError) {
          lastError = error;
        } else {
          lastError = toUpstreamError(error, options.model);
        }
        if (!isRetryable(lastError)) {
          throw lastError;
        }
      }
    }
    throw lastError;
  };
}
