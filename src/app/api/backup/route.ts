import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireCompanyId } from "@/lib/tenant-context";

const BACKUP_VERSION = "1.0";

async function GET_handler() {
  try {
    const [
      clients,
      quotations,
      invoices,
      receipts,
      employees,
      salaryRecords,
      vouchers,
      vendors,
      vendorPayments,
      subscriptions,
      subscriptionPayments,
      projects,
      transactions,
      settings,
    ] = await Promise.all([
      prisma.client.findMany(),
      prisma.quotation.findMany({ include: { items: true } }),
      prisma.invoice.findMany({ include: { items: true } }),
      prisma.paymentReceipt.findMany(),
      prisma.employee.findMany(),
      prisma.salaryRecord.findMany(),
      prisma.paymentVoucher.findMany(),
      prisma.vendor.findMany(),
      prisma.vendorPayment.findMany(),
      prisma.subscription.findMany(),
      prisma.subscriptionPayment.findMany(),
      prisma.project.findMany({ include: { tasks: true } }),
      prisma.transaction.findMany(),
      prisma.companySettings.findUnique({ where: { companyId: requireCompanyId() } }),
    ]);

    const backup = {
      version: BACKUP_VERSION,
      backupDate: new Date().toISOString(),
      data: {
        settings,
        clients,
        quotations,
        invoices,
        receipts,
        employees,
        salaryRecords,
        vouchers,
        vendors,
        vendorPayments,
        subscriptions,
        subscriptionPayments,
        projects,
        transactions,
      },
    };

    return NextResponse.json(backup);
  } catch (err: unknown) {
    console.error("GET /api/backup error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function POST_handler(request: NextRequest) {
  try {
    const backup = await request.json();

    // Validate backup structure
    if (!backup.version || !backup.data) {
      return NextResponse.json({ error: "Invalid backup format: missing version or data" }, { status: 400 });
    }

    const { data } = backup;

    const requiredKeys = [
      "clients", "quotations", "invoices", "employees",
    ];
    for (const key of requiredKeys) {
      if (!Array.isArray(data[key])) {
        return NextResponse.json({ error: `Invalid backup format: missing or invalid "${key}"` }, { status: 400 });
      }
    }

    await prisma.$transaction(async (tx) => {
      // Import settings
      if (data.settings) {
        // Strip identity fields so a foreign backup can't re-point the row
        const { updatedAt, id: _id, companyId: _cid, ...settingsData } = data.settings;
        await tx.companySettings.upsert({
          where: { companyId: requireCompanyId() },
          update: settingsData,
          create: { ...settingsData, companyId: requireCompanyId() },
        });
      }

      // Import clients
      for (const client of data.clients || []) {
        const { createdAt, updatedAt, quotations, invoices, receipts, projects, ...clientData } = client;
        await tx.client.upsert({
          where: { id: client.id },
          update: clientData,
          create: { ...clientData, id: client.id, createdAt: new Date(createdAt) },
        });
      }

      // Import employees
      for (const emp of data.employees || []) {
        const { createdAt, updatedAt, user, salaryRecords, vouchers, ...empData } = emp;
        if (empData.dateOfJoining) empData.dateOfJoining = new Date(empData.dateOfJoining);
        await tx.employee.upsert({
          where: { id: emp.id },
          update: empData,
          create: { ...empData, id: emp.id, createdAt: new Date(createdAt) },
        });
      }

      // Import vendors
      for (const vendor of data.vendors || []) {
        const { createdAt, updatedAt, payments, ...vendorData } = vendor;
        await tx.vendor.upsert({
          where: { id: vendor.id },
          update: vendorData,
          create: { ...vendorData, id: vendor.id, createdAt: new Date(createdAt) },
        });
      }

      // Import subscriptions
      for (const sub of data.subscriptions || []) {
        const { createdAt, updatedAt, payments, ...subData } = sub;
        subData.nextRenewalDate = new Date(subData.nextRenewalDate);
        await tx.subscription.upsert({
          where: { id: sub.id },
          update: subData,
          create: { ...subData, id: sub.id, createdAt: new Date(createdAt) },
        });
      }

      // Import quotations with items
      for (const q of data.quotations || []) {
        const { createdAt, updatedAt, items, client, ...qData } = q;
        qData.quotationDate = new Date(qData.quotationDate);
        if (qData.dueDate) qData.dueDate = new Date(qData.dueDate);
        await tx.quotation.upsert({
          where: { id: q.id },
          update: qData,
          create: { ...qData, id: q.id, createdAt: new Date(createdAt) },
        });
        // Upsert items
        if (items) {
          for (const item of items) {
            const { quotation, ...itemData } = item;
            await tx.quotationLineItem.upsert({
              where: { id: item.id },
              update: itemData,
              create: { ...itemData, id: item.id },
            });
          }
        }
      }

      // Import invoices with items
      for (const inv of data.invoices || []) {
        const { createdAt, updatedAt, items, client, quotation, receipts, transactions, ...invData } = inv;
        invData.invoiceDate = new Date(invData.invoiceDate);
        if (invData.dueDate) invData.dueDate = new Date(invData.dueDate);
        if (invData.paymentDate) invData.paymentDate = new Date(invData.paymentDate);
        if (!invData.quotationId) delete invData.quotationId;
        await tx.invoice.upsert({
          where: { id: inv.id },
          update: invData,
          create: { ...invData, id: inv.id, createdAt: new Date(createdAt) },
        });
        if (items) {
          for (const item of items) {
            const { invoice, ...itemData } = item;
            await tx.invoiceLineItem.upsert({
              where: { id: item.id },
              update: itemData,
              create: { ...itemData, id: item.id },
            });
          }
        }
      }

      // Import receipts
      for (const r of data.receipts || []) {
        const { createdAt, updatedAt, invoice, client, ...rData } = r;
        rData.receiptDate = new Date(rData.receiptDate);
        await tx.paymentReceipt.upsert({
          where: { id: r.id },
          update: rData,
          create: { ...rData, id: r.id, createdAt: new Date(createdAt) },
        });
      }

      // Import salary records
      for (const sr of data.salaryRecords || []) {
        const { createdAt, updatedAt, employee, voucher, ...srData } = sr;
        if (srData.paymentDate) srData.paymentDate = new Date(srData.paymentDate);
        await tx.salaryRecord.upsert({
          where: { id: sr.id },
          update: srData,
          create: { ...srData, id: sr.id, createdAt: new Date(createdAt) },
        });
      }

      // Import vouchers
      for (const v of data.vouchers || []) {
        const { createdAt, updatedAt, employee, salaryRecord, transaction, ...vData } = v;
        vData.voucherDate = new Date(vData.voucherDate);
        if (vData.acknowledgedAt) vData.acknowledgedAt = new Date(vData.acknowledgedAt);
        if (!vData.salaryRecordId) delete vData.salaryRecordId;
        await tx.paymentVoucher.upsert({
          where: { id: v.id },
          update: vData,
          create: { ...vData, id: v.id, createdAt: new Date(createdAt) },
        });
      }

      // Import vendor payments
      for (const vp of data.vendorPayments || []) {
        const { createdAt, vendor, transaction, ...vpData } = vp;
        vpData.paidDate = new Date(vpData.paidDate);
        await tx.vendorPayment.upsert({
          where: { id: vp.id },
          update: vpData,
          create: { ...vpData, id: vp.id, createdAt: new Date(createdAt) },
        });
      }

      // Import subscription payments
      for (const sp of data.subscriptionPayments || []) {
        const { createdAt, subscription, transaction, ...spData } = sp;
        spData.paidDate = new Date(spData.paidDate);
        await tx.subscriptionPayment.upsert({
          where: { id: sp.id },
          update: spData,
          create: { ...spData, id: sp.id, createdAt: new Date(createdAt) },
        });
      }

      // Import projects with tasks
      for (const p of data.projects || []) {
        const { createdAt, updatedAt, tasks, client, activityLogs, ...pData } = p;
        if (pData.deadline) pData.deadline = new Date(pData.deadline);
        if (pData.completedAt) pData.completedAt = new Date(pData.completedAt);
        if (!pData.clientId) delete pData.clientId;
        await tx.project.upsert({
          where: { id: p.id },
          update: pData,
          create: { ...pData, id: p.id, createdAt: new Date(createdAt) },
        });
        if (tasks) {
          for (const task of tasks) {
            const { project, createdAt: tCreated, updatedAt: tUpdated, ...taskData } = task;
            if (taskData.dueDate) taskData.dueDate = new Date(taskData.dueDate);
            await tx.projectTask.upsert({
              where: { id: task.id },
              update: taskData,
              create: { ...taskData, id: task.id, createdAt: new Date(tCreated) },
            });
          }
        }
      }

      // Import transactions
      for (const t of data.transactions || []) {
        const { createdAt, updatedAt, invoice, voucher, subscriptionPayment, vendorPayment, ...tData } = t;
        tData.date = new Date(tData.date);
        if (!tData.invoiceId) delete tData.invoiceId;
        if (!tData.voucherId) delete tData.voucherId;
        if (!tData.subscriptionPaymentId) delete tData.subscriptionPaymentId;
        if (!tData.vendorPaymentId) delete tData.vendorPaymentId;
        await tx.transaction.upsert({
          where: { id: t.id },
          update: tData,
          create: { ...tData, id: t.id, createdAt: new Date(createdAt) },
        });
      }
    });

    return NextResponse.json({ success: true, message: "Backup imported successfully" });
  } catch (err: unknown) {
    console.error("POST /api/backup error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
export const POST = withApi(POST_handler);
