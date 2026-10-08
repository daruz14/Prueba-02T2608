import { describe, expect, it } from "vitest";
import { isAuthorized } from "../../src/http/apiKey.js";

const KEY = "test-ingress-key";

describe("isAuthorized", () => {
  it("allows everything when no key is configured", () => {
    expect(isAuthorized({}, undefined)).toBe(true);
  });

  it("rejects requests without a key", () => {
    expect(isAuthorized({}, KEY)).toBe(false);
  });

  it("rejects a wrong key", () => {
    expect(isAuthorized({ "x-api-key": "another-key" }, KEY)).toBe(false);
  });

  it("rejects keys with a different length", () => {
    expect(isAuthorized({ "x-api-key": "test" }, KEY)).toBe(false);
  });

  it("accepts the x-api-key header", () => {
    expect(isAuthorized({ "x-api-key": KEY }, KEY)).toBe(true);
  });

  it("accepts a bearer token", () => {
    expect(isAuthorized({ authorization: `Bearer ${KEY}` }, KEY)).toBe(true);
  });

  it("rejects a malformed authorization header", () => {
    expect(isAuthorized({ authorization: KEY }, KEY)).toBe(false);
  });
});
