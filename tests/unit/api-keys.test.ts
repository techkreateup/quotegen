import { describe, it, expect } from "vitest";
import { generateApiKey, hashKey } from "@/lib/api-keys";

describe("api-keys", () => {
  it("generates a prefixed key whose hash matches", () => {
    const { raw, keyHash, keyPrefix } = generateApiKey();
    expect(raw.startsWith("qg_live_")).toBe(true);
    expect(hashKey(raw)).toBe(keyHash);
    expect(keyPrefix.startsWith("qg_live_")).toBe(true);
    expect(keyPrefix).not.toBe(raw); // truncated display form
  });

  it("produces unique keys", () => {
    expect(generateApiKey().raw).not.toBe(generateApiKey().raw);
  });

  it("hashing is stable and one-way (hex, 64 chars)", () => {
    const h = hashKey("qg_live_test");
    expect(h).toBe(hashKey("qg_live_test"));
    expect(h).toMatch(/^[a-f0-9]{64}$/);
  });
});
