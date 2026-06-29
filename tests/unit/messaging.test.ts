import { describe, it, expect } from "vitest";
import {
  renderTemplate,
  resolveRecipients,
  extractMergeKeys,
  htmlToText,
  escapeHtml,
} from "@/lib/messaging";

const ctx = {
  currency: "INR",
  company: { name: "Acme Pvt Ltd" },
  client: { name: "Bob & Co", email: "bob@co.com" },
  invoice: { number: "INV-001", total: 1500, dueDate: "2026-07-01" },
  link: "https://app/invoice/1",
};

describe("renderTemplate", () => {
  it("substitutes dotted merge paths", () => {
    expect(renderTemplate("Hi {{client.name}}", ctx)).toBe("Hi Bob &amp; Co");
  });

  it("formats money-looking numeric keys with currency", () => {
    expect(renderTemplate("Due {{invoice.total}}", ctx)).toContain("₹1,500");
  });

  it("renders unknown tokens as empty string", () => {
    expect(renderTemplate("X{{nope.missing}}Y", ctx)).toBe("XY");
  });

  it("HTML-escapes by default (XSS-safe) but not when escape:false", () => {
    const evil = { client: { name: "<script>alert(1)</script>" } };
    expect(renderTemplate("{{client.name}}", evil)).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;"
    );
    expect(renderTemplate("{{client.name}}", evil, { escape: false })).toBe(
      "<script>alert(1)</script>"
    );
  });

  it("does not escape a link when used raw (href context)", () => {
    expect(renderTemplate("{{link}}", ctx, { escape: false })).toBe(
      "https://app/invoice/1"
    );
  });
});

describe("resolveRecipients", () => {
  it("resolves a merge token to an address", () => {
    expect(resolveRecipients("{{client.email}}", ctx)).toEqual(["bob@co.com"]);
  });

  it("splits literal + merged lists on comma/semicolon/space", () => {
    expect(
      resolveRecipients("a@x.com, b@y.com; {{client.email}}", ctx)
    ).toEqual(["a@x.com", "b@y.com", "bob@co.com"]);
  });

  it("drops blanks and unknown tokens", () => {
    expect(resolveRecipients("{{nope}} ,  ", ctx)).toEqual([]);
  });
});

describe("extractMergeKeys", () => {
  it("lists referenced keys uniquely", () => {
    expect(
      extractMergeKeys("Hi {{client.name}}, see {{invoice.number}} / {{client.name}}")
    ).toEqual(["client.name", "invoice.number"]);
  });
});

describe("htmlToText", () => {
  it("strips tags, converts breaks, decodes entities", () => {
    expect(htmlToText("<p>Hi <b>Bob</b></p><br/>Pay &amp; go")).toBe(
      "Hi Bob\n\nPay & go"
    );
  });
});

describe("escapeHtml", () => {
  it("escapes the five significant characters", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;"
    );
  });
});
