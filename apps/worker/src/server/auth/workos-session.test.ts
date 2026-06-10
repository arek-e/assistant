import { describe, expect, test } from "bun:test";
import {
  createLoginState,
  decodeLoginState,
  encodeLoginState,
  sanitizeReturnTo
} from "./workos-session";

describe("WorkOS session helpers", () => {
  test("round-trips login state", () => {
    const state = createLoginState("/debug?tab=memory");
    const decoded = decodeLoginState(encodeLoginState(state));

    expect(decoded).toEqual(state);
    expect(decoded?.returnTo).toBe("/debug?tab=memory");
  });

  test("sanitizes external return targets", () => {
    expect(sanitizeReturnTo("https://evil.test")).toBe("/");
    expect(sanitizeReturnTo("//evil.test")).toBe("/");
    expect(sanitizeReturnTo("/chat")).toBe("/chat");
  });
});
