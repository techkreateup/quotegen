import { describe, it, expect } from "vitest";
import { canTransition } from "@/lib/subscription";

describe("canTransition", () => {
  it("allows the documented happy-path transitions", () => {
    expect(canTransition("TRIALING", "ACTIVE")).toBe(true);
    expect(canTransition("ACTIVE", "PAST_DUE")).toBe(true);
    expect(canTransition("PAST_DUE", "ACTIVE")).toBe(true);
    expect(canTransition("PAST_DUE", "CANCELED")).toBe(true);
    expect(canTransition("CANCELED", "ACTIVE")).toBe(true);
  });

  it("treats a same-state transition as a no-op (allowed)", () => {
    expect(canTransition("ACTIVE", "ACTIVE")).toBe(true);
  });

  it("rejects illegal transitions", () => {
    expect(canTransition("FREE", "PAST_DUE")).toBe(false);
    expect(canTransition("TRIALING", "PAST_DUE")).toBe(false);
    expect(canTransition("CANCELED", "PAST_DUE")).toBe(false);
  });
});
