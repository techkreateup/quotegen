import { describe, it, expect } from "vitest";
import {
  parse,
  clientSchema,
  invoiceSchema,
  employeeSchema,
  catalogSchema,
} from "@/lib/schemas";

describe("clientSchema", () => {
  it("accepts a valid client and treats empty optionals as undefined", () => {
    const r = parse(clientSchema, { businessName: "Acme", email: "", gstin: "" });
    expect(r.ok).toBe(true);
    expect(r.data?.businessName).toBe("Acme");
  });

  it("rejects a missing business name with a field error", () => {
    const r = parse(clientSchema, { businessName: "" });
    expect(r.ok).toBe(false);
    expect(r.response?.status).toBe(400);
  });

  it("rejects an invalid GSTIN", () => {
    const r = parse(clientSchema, { businessName: "Acme", gstin: "NOTVALID" });
    expect(r.ok).toBe(false);
  });

  it("rejects an invalid email", () => {
    const r = parse(clientSchema, { businessName: "Acme", email: "not-an-email" });
    expect(r.ok).toBe(false);
  });
});

describe("invoiceSchema", () => {
  it("requires at least one line item", () => {
    const r = parse(invoiceSchema, { clientId: "c1", items: [] });
    expect(r.ok).toBe(false);
  });

  it("accepts a valid invoice with coerced numeric quantity", () => {
    const r = parse(invoiceSchema, {
      clientId: "c1",
      items: [{ description: "Work", quantity: "2", rate: "100" }],
    });
    expect(r.ok).toBe(true);
  });

  it("rejects negative rate", () => {
    const r = parse(invoiceSchema, {
      clientId: "c1",
      items: [{ description: "Work", quantity: 1, rate: -5 }],
    });
    expect(r.ok).toBe(false);
  });
});

describe("employeeSchema", () => {
  it("rejects a negative salary", () => {
    const r = parse(employeeSchema, { name: "Bob", salary: -1 });
    expect(r.ok).toBe(false);
  });
});

describe("catalogSchema", () => {
  it("validates the real field name (rate, not price)", () => {
    const r = parse(catalogSchema, { name: "Item", rate: 50 });
    expect(r.ok).toBe(true);
  });
});
