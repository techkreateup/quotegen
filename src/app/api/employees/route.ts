import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { requireCompanyId } from "@/lib/tenant-context";
import { nextDocNumber } from "@/lib/numbering";
import { parse, employeeSchema } from "@/lib/schemas";

async function GET_handler(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const pageParam = sp.get("page");

    const active = { deletedAt: null };
    if (!pageParam) {
      const employees = await prisma.employee.findMany({ where: active, orderBy: { createdAt: "desc" } });
      return NextResponse.json(employees);
    }

    const page = Math.max(1, parseInt(pageParam) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(sp.get("limit") || "20") || 20));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      prisma.employee.findMany({ where: active, orderBy: { createdAt: "desc" }, skip, take: limit }),
      prisma.employee.count({ where: active }),
    ]);

    return NextResponse.json({
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err: unknown) {
    console.error("GET /api/employees error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function POST_handler(request: NextRequest) {
  try {
    const data = await request.json();
    const v = parse(employeeSchema, data);
    if (!v.ok) return v.response!;

    const companyId = requireCompanyId();
    const { dateOfJoining, salary, ...rest } = data;

    const employee = await prisma.$transaction(async (tx) => {
      const { number } = await nextDocNumber(tx, "nextEmployeeNo");
      return tx.employee.create({
        data: {
          companyId,
          ...rest,
          employeeCode: `EMP${String(number).padStart(5, "0")}`,
          salary: salary ? Number(salary) : 0,
          dateOfJoining: dateOfJoining ? new Date(dateOfJoining) : null,
        },
      });
    });

    const userId = request.headers.get("x-user-id") || "system";
    logAudit({ userId, entity: "Employee", entityId: employee.id, action: "CREATE", after: { name: employee.name, employeeCode: employee.employeeCode, designation: employee.designation } });
    return NextResponse.json(employee, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/employees error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const POST = withApi(POST_handler);
