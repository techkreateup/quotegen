import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prismaUnscoped } from "@/lib/db";
import bcrypt from "bcryptjs";

/**
 * API-level tenant isolation suite. Requires the dev server on BASE_URL
 * (default http://localhost:3000) — skipped automatically if unreachable.
 *
 * Creates two companies with one admin each, then proves company B can
 * never read or mutate company A's data through the HTTP API.
 */
const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

const STAMP = Date.now();
const COMPANY_A = `iso_a_${STAMP}`;
const COMPANY_B = `iso_b_${STAMP}`;
const PASSWORD = "IsoTest123";

let serverUp = false;
let cookieA = "";
let cookieB = "";
let clientAId = "";

async function login(email: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  expect(res.status).toBe(200);
  const setCookie = res.headers.get("set-cookie") ?? "";
  return setCookie.split(";")[0];
}

function api(cookie: string) {
  return (path: string, init?: RequestInit) =>
    fetch(`${BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", cookie, ...(init?.headers ?? {}) },
    });
}

async function createTenant(id: string, email: string) {
  await prismaUnscoped.company.create({
    data: {
      id,
      name: `Isolation ${id}`,
      slug: id.replace(/_/g, "-"),
      settings: { create: { businessName: id } },
      users: {
        create: {
          name: `Admin ${id}`,
          email,
          password: bcrypt.hashSync(PASSWORD, 10),
          platformRole: "COMPANY_ADMIN",
          mustResetPassword: false,
          userRole: {
            create: {
              companyId: id,
              name: "Admin",
              isSystem: true,
              permissions: Object.fromEntries(
                ["dashboard", "clients", "quotations", "invoices", "receipts", "credit-notes", "catalog", "recurring-invoices", "reminders", "employees", "salary", "vouchers", "vendors", "subscriptions", "transactions", "projects", "settings", "audit-logs", "gst", "purchase-bills"].map(
                  (m) => [m, { view: true, create: true, edit: true, delete: true }]
                )
              ),
            },
          },
        },
      },
    },
  });
}

beforeAll(async () => {
  try {
    await fetch(`${BASE}/login`);
    serverUp = true;
  } catch {
    console.warn(`Dev server not reachable at ${BASE} — isolation suite skipped`);
    return;
  }

  await createTenant(COMPANY_A, `admin@${COMPANY_A}.test`);
  await createTenant(COMPANY_B, `admin@${COMPANY_B}.test`);
  cookieA = await login(`admin@${COMPANY_A}.test`);
  cookieB = await login(`admin@${COMPANY_B}.test`);

  // Seed a client for company A through the API
  const res = await api(cookieA)("/api/clients", {
    method: "POST",
    body: JSON.stringify({ businessName: "A Secret Client" }),
  });
  expect(res.status).toBe(201);
  clientAId = (await res.json()).id;
});

afterAll(async () => {
  await prismaUnscoped.company.deleteMany({ where: { id: { in: [COMPANY_A, COMPANY_B] } } });
  await prismaUnscoped.$disconnect();
});

describe.runIf(process.env.CI !== "true")("API tenant isolation", () => {
  const LIST_ENDPOINTS = [
    "/api/clients",
    "/api/quotations",
    "/api/invoices",
    "/api/receipts",
    "/api/credit-notes",
    "/api/catalog",
    "/api/employees",
    "/api/vendors",
    "/api/subscriptions",
    "/api/transactions",
    "/api/projects",
  ];

  it("company B sees zero of company A's rows on every list endpoint", async () => {
    if (!serverUp) return;
    for (const ep of LIST_ENDPOINTS) {
      const res = await api(cookieB)(ep);
      expect(res.status, ep).toBe(200);
      const body = await res.json();
      const rows = Array.isArray(body) ? body : body.data ?? body.issues ?? [];
      expect(rows.length, `${ep} leaked rows to company B`).toBe(0);
    }
  });

  it("company B cannot read A's client by id", async () => {
    if (!serverUp) return;
    const res = await api(cookieB)(`/api/clients/${clientAId}`);
    expect([404, 500]).toContain(res.status);
    if (res.status === 200) throw new Error("cross-tenant read succeeded!");
  });

  it("company B cannot update or delete A's client", async () => {
    if (!serverUp) return;
    const upd = await api(cookieB)(`/api/clients/${clientAId}`, {
      method: "PUT",
      body: JSON.stringify({ businessName: "hacked" }),
    });
    expect(upd.status).not.toBe(200);

    const del = await api(cookieB)(`/api/clients/${clientAId}`, { method: "DELETE" });
    expect(del.status).not.toBe(200);

    // Verify intact via A
    const check = await api(cookieA)(`/api/clients/${clientAId}`);
    const client = await check.json();
    expect(client.businessName).toBe("A Secret Client");
  });

  it("company users cannot reach platform APIs", async () => {
    if (!serverUp) return;
    for (const ep of ["/api/admin/companies", "/api/admin/analytics", "/api/support/issues"]) {
      const res = await api(cookieB)(ep);
      expect(res.status, ep).toBe(403);
    }
  });

  it("settings are isolated per company", async () => {
    if (!serverUp) return;
    const a = await api(cookieA)("/api/settings").then((r) => r.json());
    const b = await api(cookieB)("/api/settings").then((r) => r.json());
    expect(a.businessName).toBe(COMPANY_A);
    expect(b.businessName).toBe(COMPANY_B);
  });

  it("document numbering is per-company", async () => {
    if (!serverUp) return;
    const mk = (cookie: string) =>
      api(cookie)("/api/invoices", {
        method: "POST",
        body: JSON.stringify({
          invoiceDate: new Date().toISOString(),
          clientId: clientAId, // only valid for A; B uses its own client
          items: [],
          totalAmount: 100,
        }),
      });
    const resA = await mk(cookieA);
    expect(resA.status).toBe(201);
    const invA = await resA.json();
    expect(invA.invoiceNo).toBe("INV00001");

    // B gets its own client first
    const clientB = await api(cookieB)("/api/clients", {
      method: "POST",
      body: JSON.stringify({ businessName: "B Client" }),
    }).then((r) => r.json());
    const resB = await api(cookieB)("/api/invoices", {
      method: "POST",
      body: JSON.stringify({
        invoiceDate: new Date().toISOString(),
        clientId: clientB.id,
        items: [],
        totalAmount: 50,
      }),
    });
    expect(resB.status).toBe(201);
    const invB = await resB.json();
    expect(invB.invoiceNo).toBe("INV00001"); // independent sequence
  });
});
