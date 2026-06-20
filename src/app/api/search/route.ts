import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

async function GET_handler(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q")?.trim();
    if (!q || q.length < 2) return NextResponse.json({ results: [] });

    const contains = { contains: q, mode: "insensitive" as const };

    const [clients, quotations, invoices, employees, vendors, projects] = await Promise.all([
      prisma.client.findMany({
        where: {
          OR: [
            { businessName: contains },
            { email: contains },
            { gstin: contains },
            { city: contains },
          ],
        },
        select: { id: true, businessName: true, email: true, city: true, status: true },
        take: 5,
      }),
      prisma.quotation.findMany({
        where: {
          OR: [
            { quotationNo: contains },
            { title: contains },
            { client: { businessName: contains } },
          ],
        },
        select: { id: true, quotationNo: true, totalAmount: true, status: true, client: { select: { businessName: true } } },
        take: 5,
      }),
      prisma.invoice.findMany({
        where: {
          OR: [
            { invoiceNo: contains },
            { title: contains },
            { client: { businessName: contains } },
          ],
        },
        select: { id: true, invoiceNo: true, totalAmount: true, status: true, client: { select: { businessName: true } } },
        take: 5,
      }),
      prisma.employee.findMany({
        where: {
          OR: [
            { name: contains },
            { employeeCode: contains },
            { email: contains },
            { designation: contains },
          ],
        },
        select: { id: true, name: true, employeeCode: true, designation: true, status: true },
        take: 5,
      }),
      prisma.vendor.findMany({
        where: {
          OR: [
            { name: contains },
            { email: contains },
          ],
        },
        select: { id: true, name: true, email: true },
        take: 5,
      }),
      prisma.project.findMany({
        where: {
          OR: [
            { title: contains },
            { description: contains },
          ],
        },
        select: { id: true, title: true, status: true, priority: true },
        take: 5,
      }),
    ]);

    const results: {
      type: string;
      id: string;
      title: string;
      subtitle: string;
      href: string;
      status?: string;
    }[] = [];

    for (const c of clients) {
      results.push({
        type: "Client",
        id: c.id,
        title: c.businessName,
        subtitle: [c.email, c.city].filter(Boolean).join(" · "),
        href: `/clients/view?id=${c.id}`,
        status: c.status,
      });
    }

    for (const qt of quotations) {
      results.push({
        type: "Quotation",
        id: qt.id,
        title: qt.quotationNo,
        subtitle: `${qt.client.businessName} · ₹${qt.totalAmount.toLocaleString("en-IN")}`,
        href: `/quotations/view?id=${qt.id}`,
        status: qt.status,
      });
    }

    for (const inv of invoices) {
      results.push({
        type: "Invoice",
        id: inv.id,
        title: inv.invoiceNo,
        subtitle: `${inv.client.businessName} · ₹${inv.totalAmount.toLocaleString("en-IN")}`,
        href: `/invoices/view?id=${inv.id}`,
        status: inv.status,
      });
    }

    for (const emp of employees) {
      results.push({
        type: "Employee",
        id: emp.id,
        title: emp.name,
        subtitle: [emp.employeeCode, emp.designation].filter(Boolean).join(" · "),
        href: `/employees`,
        status: emp.status,
      });
    }

    for (const v of vendors) {
      results.push({
        type: "Vendor",
        id: v.id,
        title: v.name,
        subtitle: v.email || "",
        href: `/vendors/view?id=${v.id}`,
      });
    }

    for (const p of projects) {
      results.push({
        type: "Project",
        id: p.id,
        title: p.title,
        subtitle: `${p.priority} priority`,
        href: `/projects/view?id=${p.id}`,
        status: p.status,
      });
    }

    return NextResponse.json({ results });
  } catch (e) {
    console.error("Search API error:", e);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
