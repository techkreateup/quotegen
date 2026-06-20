import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prismaUnscoped } from "@/lib/db";
import bcrypt from "bcryptjs";

/**
 * Full CRUD lifecycle suite for major entities within a single tenant.
 * Exercises create → list → read-by-id → update → delete over the HTTP API,
 * proving the happy path (the isolation suite covers the cross-tenant denials).
 *
 * Requires the dev server on TEST_BASE_URL — skipped if unreachable.
 */
const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";
const STAMP = Date.now();
const COMPANY = `crud_${STAMP}`;
const PASSWORD = "CrudTest123";

let serverUp = false;
let cookie = "";

function api(path: string, init?: RequestInit) {
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", cookie, ...(init?.headers ?? {}) },
  });
}

async function createTenant() {
  await prismaUnscoped.company.create({
    data: {
      id: COMPANY,
      name: `CRUD ${COMPANY}`,
      slug: COMPANY.replace(/_/g, "-"),
      settings: { create: { businessName: COMPANY } },
      users: {
        create: {
          name: `Admin ${COMPANY}`,
          email: `admin@${COMPANY}.test`,
          password: bcrypt.hashSync(PASSWORD, 10),
          platformRole: "COMPANY_ADMIN",
          mustResetPassword: false,
          userRole: {
            create: {
              companyId: COMPANY,
              name: "Admin",
              isSystem: true,
              permissions: Object.fromEntries(
                ["dashboard", "clients", "vendors", "catalog"].map((m) => [
                  m,
                  { view: true, create: true, edit: true, delete: true },
                ])
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
    console.warn(`Dev server not reachable at ${BASE} — CRUD lifecycle suite skipped`);
    return;
  }
  await createTenant();
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `admin@${COMPANY}.test`, password: PASSWORD }),
  });
  expect(res.status).toBe(200);
  cookie = (res.headers.get("set-cookie") ?? "").split(";")[0];
});

afterAll(async () => {
  await prismaUnscoped.company.deleteMany({ where: { id: COMPANY } });
  await prismaUnscoped.$disconnect();
});

describe.runIf(process.env.CI !== "true")("CRUD lifecycle (single tenant)", () => {
  it("client: create → list → get → update → delete", async () => {
    if (!serverUp) return;

    // CREATE
    const created = await api("/api/clients", {
      method: "POST",
      body: JSON.stringify({ businessName: "Acme Co", email: "acme@example.com" }),
    });
    expect(created.status).toBe(201);
    const client = await created.json();
    expect(client.id).toBeTruthy();
    expect(client.businessName).toBe("Acme Co");

    // LIST
    const list = await api("/api/clients").then((r) => r.json());
    const rows = Array.isArray(list) ? list : list.data ?? [];
    expect(rows.some((c: { id: string }) => c.id === client.id)).toBe(true);

    // GET by id
    const got = await api(`/api/clients/${client.id}`);
    expect(got.status).toBe(200);
    expect((await got.json()).businessName).toBe("Acme Co");

    // UPDATE
    const updated = await api(`/api/clients/${client.id}`, {
      method: "PUT",
      body: JSON.stringify({ businessName: "Acme Renamed" }),
    });
    expect(updated.status).toBe(200);
    const after = await api(`/api/clients/${client.id}`).then((r) => r.json());
    expect(after.businessName).toBe("Acme Renamed");

    // DELETE
    const del = await api(`/api/clients/${client.id}`, { method: "DELETE" });
    expect(del.status).toBe(200);
    const gone = await api(`/api/clients/${client.id}`);
    expect([404, 500]).toContain(gone.status);
  });

  it("vendor: create → update → delete", async () => {
    if (!serverUp) return;

    const created = await api("/api/vendors", {
      method: "POST",
      body: JSON.stringify({ name: "Bolt Supplies" }),
    });
    expect(created.status).toBe(201);
    const vendor = await created.json();
    expect(vendor.id).toBeTruthy();

    const updated = await api(`/api/vendors/${vendor.id}`, {
      method: "PUT",
      body: JSON.stringify({ name: "Bolt Supplies Ltd" }),
    });
    expect(updated.status).toBe(200);

    const del = await api(`/api/vendors/${vendor.id}`, { method: "DELETE" });
    expect(del.status).toBe(200);
  });

  it("rejects invalid input with a 400 (Zod gate)", async () => {
    if (!serverUp) return;
    const res = await api("/api/clients", {
      method: "POST",
      body: JSON.stringify({ businessName: "", email: "not-an-email" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.fieldErrors).toBeTruthy();
  });
});
