import { timingSafeEqual } from "node:crypto";

const BEARER_PREFIX = "Bearer ";

function providedKey(headers: Record<string, string | string[] | undefined>): string | undefined {
  const apiKeyHeader = headers["x-api-key"];
  if (typeof apiKeyHeader === "string" && apiKeyHeader.length > 0) return apiKeyHeader;

  const authorization = headers["authorization"];
  if (typeof authorization === "string" && authorization.startsWith(BEARER_PREFIX)) {
    return authorization.slice(BEARER_PREFIX.length);
  }
  return undefined;
}

export function isAuthorized(
  headers: Record<string, string | string[] | undefined>,
  expectedKey: string | undefined,
): boolean {
  if (!expectedKey) return true;
  const candidate = providedKey(headers);
  if (!candidate) return false;
  const candidateBuffer = Buffer.from(candidate, "utf8");
  const expectedBuffer = Buffer.from(expectedKey, "utf8");
  if (candidateBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(candidateBuffer, expectedBuffer);
}
