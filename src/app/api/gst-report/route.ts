import { withApi } from "@/lib/with-api";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

async function GET_handler(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const month = parseInt(sp.get("month") || "0");
    const year = parseInt(sp.get("year") || "0");
    const type = sp.get("type") || "gstr1";

    // ── FY Summary: B2B vs B2C tax split per month ──
    if (type === "fy-summary") {
      const fyParam = sp.get("fy") || "";
      const [startYear] = fyParam.split("-").map(Number);
      if (!startYear) return NextResponse.json({ error: "fy param required (e.g. 2025-2026)" }, { status: 400 });

      const fyStart = new Date(startYear, 3, 1);
      const fyEnd = new Date(startYear + 1, 2, 31, 23, 59, 59, 999);

      const invoices = await prisma.invoice.findMany({
        where: {
          invoiceDate: { gte: fyStart, lte: fyEnd },
          status: { notIn: ["Draft", "Cancelled"] },
        },
        include: { client: true },
      });

      const monthlyMap: Record<string, {
        month: number; year: number;
        b2b: { invoices: number; taxable: number; gst: number };
        b2c: { invoices: number; taxable: number; gst: number };
        totalGst: number;
      }> = {};

      for (const inv of invoices) {
        const m = inv.invoiceDate.getMonth() + 1;
        const y = inv.invoiceDate.getFullYear();
        const key = `${m}-${y}`;
        if (!monthlyMap[key]) {
          monthlyMap[key] = {
            month: m, year: y,
            b2b: { invoices: 0, taxable: 0, gst: 0 },
            b2c: { invoices: 0, taxable: 0, gst: 0 },
            totalGst: 0,
          };
        }
        const gst = inv.totalIgst + inv.totalCgst + inv.totalSgst;
        const taxable = inv.subtotal - inv.totalDiscount;
        const bucket = inv.client.gstin ? "b2b" : "b2c";
        monthlyMap[key][bucket].invoices += 1;
        monthlyMap[key][bucket].taxable += taxable;
        monthlyMap[key][bucket].gst += gst;
        monthlyMap[key].totalGst += gst;
      }

      return NextResponse.json(Object.values(monthlyMap));
    }

    // ── ITC Summary: Input Tax Credit from purchase bills ──
    if (type === "itc-summary") {
      const fyParam = sp.get("fy") || "";
      const [startYear] = fyParam.split("-").map(Number);
      if (!startYear) return NextResponse.json({ error: "fy param required" }, { status: 400 });

      const fyStart = new Date(startYear, 3, 1);
      const fyEnd = new Date(startYear + 1, 2, 31, 23, 59, 59, 999);

      const bills = await prisma.purchaseBill.findMany({
        where: {
          billDate: { gte: fyStart, lte: fyEnd },
          status: { not: "Cancelled" },
          itcEligible: true,
        },
        include: { vendor: true },
      });

      const monthlyItc: Record<string, {
        month: number; year: number; bills: number;
        igst: number; cgst: number; sgst: number; total: number;
      }> = {};

      for (const bill of bills) {
        const m = bill.billDate.getMonth() + 1;
        const y = bill.billDate.getFullYear();
        const key = `${m}-${y}`;
        if (!monthlyItc[key]) {
          monthlyItc[key] = { month: m, year: y, bills: 0, igst: 0, cgst: 0, sgst: 0, total: 0 };
        }
        monthlyItc[key].bills += 1;
        monthlyItc[key].igst += bill.totalIgst;
        monthlyItc[key].cgst += bill.totalCgst;
        monthlyItc[key].sgst += bill.totalSgst;
        monthlyItc[key].total += bill.totalIgst + bill.totalCgst + bill.totalSgst;
      }

      const fyTotals = {
        bills: bills.length,
        igst: bills.reduce((s, b) => s + b.totalIgst, 0),
        cgst: bills.reduce((s, b) => s + b.totalCgst, 0),
        sgst: bills.reduce((s, b) => s + b.totalSgst, 0),
        total: bills.reduce((s, b) => s + b.totalIgst + b.totalCgst + b.totalSgst, 0),
      };

      return NextResponse.json({ monthly: Object.values(monthlyItc), fyTotals });
    }

    // ── Tax Summary for a specific month (auto-fill for filing) ──
    if (type === "tax-summary") {
      if (!month || !year) return NextResponse.json({ error: "month and year required" }, { status: 400 });

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999);

      // Output tax from invoices
      const invoices = await prisma.invoice.findMany({
        where: {
          invoiceDate: { gte: startDate, lte: endDate },
          status: { notIn: ["Draft", "Cancelled"] },
        },
      });

      const creditNotes = await prisma.creditNote.findMany({
        where: {
          creditNoteDate: { gte: startDate, lte: endDate },
          status: { notIn: ["Draft", "Cancelled"] },
        },
      });

      const outputIgst = invoices.reduce((s, i) => s + i.totalIgst, 0) - creditNotes.reduce((s, c) => s + c.totalIgst, 0);
      const outputCgst = invoices.reduce((s, i) => s + i.totalCgst, 0) - creditNotes.reduce((s, c) => s + c.totalCgst, 0);
      const outputSgst = invoices.reduce((s, i) => s + i.totalSgst, 0) - creditNotes.reduce((s, c) => s + c.totalSgst, 0);
      const outputTotal = outputIgst + outputCgst + outputSgst;

      // Input tax credit from purchase bills
      const bills = await prisma.purchaseBill.findMany({
        where: {
          billDate: { gte: startDate, lte: endDate },
          status: { not: "Cancelled" },
          itcEligible: true,
        },
      });

      const itcIgst = bills.reduce((s, b) => s + b.totalIgst, 0);
      const itcCgst = bills.reduce((s, b) => s + b.totalCgst, 0);
      const itcSgst = bills.reduce((s, b) => s + b.totalSgst, 0);
      const itcTotal = itcIgst + itcCgst + itcSgst;

      // Challans already paid for this period
      const challans = await prisma.gstChallan.findMany({
        where: { month, year, status: "Paid" },
      });
      const paidTotal = challans.reduce((s, c) => s + c.totalAmount, 0);

      return NextResponse.json({
        output: { igst: outputIgst, cgst: outputCgst, sgst: outputSgst, total: outputTotal },
        itc: { igst: itcIgst, cgst: itcCgst, sgst: itcSgst, total: itcTotal },
        net: {
          igst: Math.max(0, outputIgst - itcIgst),
          cgst: Math.max(0, outputCgst - itcCgst),
          sgst: Math.max(0, outputSgst - itcSgst),
          total: Math.max(0, outputTotal - itcTotal),
        },
        paid: paidTotal,
        balance: Math.max(0, outputTotal - itcTotal - paidTotal),
        invoiceCount: invoices.length,
        billCount: bills.length,
      });
    }

    if (!month || !year) {
      return NextResponse.json({ error: "month and year required" }, { status: 400 });
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const invoices = await prisma.invoice.findMany({
      where: {
        invoiceDate: { gte: startDate, lte: endDate },
        status: { notIn: ["Draft", "Cancelled"] },
      },
      include: { client: true, items: true },
    });

    const creditNotes = await prisma.creditNote.findMany({
      where: {
        creditNoteDate: { gte: startDate, lte: endDate },
        status: { notIn: ["Draft", "Cancelled"] },
      },
      include: { client: true, items: true },
    });

    if (type === "gstr1") {
      // B2B
      const b2b = invoices
        .filter((inv) => inv.client.gstin)
        .map((inv) => ({
          id: inv.id,
          gstin: inv.client.gstin,
          clientName: inv.client.businessName,
          invoiceNo: inv.invoiceNo,
          invoiceDate: inv.invoiceDate.toISOString().split("T")[0],
          taxableValue: inv.subtotal - inv.totalDiscount,
          igst: inv.totalIgst,
          cgst: inv.totalCgst,
          sgst: inv.totalSgst,
          total: inv.totalAmount,
        }));

      // B2C
      const b2cInvoices = invoices.filter((inv) => !inv.client.gstin);
      const b2cMap: Record<string, { state: string; taxableValue: number; igst: number; cgst: number; sgst: number; total: number }> = {};
      for (const inv of b2cInvoices) {
        for (const item of inv.items) {
          const key = `${inv.client.state || "Unknown"}_${item.gstRate}`;
          if (!b2cMap[key]) {
            b2cMap[key] = { state: inv.client.state || "Unknown", taxableValue: 0, igst: 0, cgst: 0, sgst: 0, total: 0 };
          }
          b2cMap[key].taxableValue += item.amount;
          b2cMap[key].igst += item.igst;
          b2cMap[key].cgst += item.cgst;
          b2cMap[key].sgst += item.sgst;
          b2cMap[key].total += item.total;
        }
      }
      const b2c = Object.entries(b2cMap).map(([key, val]) => ({
        ...val,
        rate: parseFloat(key.split("_")[1]),
      }));

      // B2C individual invoice list (for UI display)
      const b2cList = b2cInvoices.map((inv) => ({
        id: inv.id,
        clientName: inv.client.businessName,
        invoiceNo: inv.invoiceNo,
        invoiceDate: inv.invoiceDate.toISOString().split("T")[0],
        state: inv.client.state || "Unknown",
        taxableValue: inv.subtotal - inv.totalDiscount,
        igst: inv.totalIgst,
        cgst: inv.totalCgst,
        sgst: inv.totalSgst,
        total: inv.totalAmount,
      }));

      // Credit Notes
      const cnList = creditNotes.map((cn) => ({
        creditNoteNo: cn.creditNoteNo,
        creditNoteDate: cn.creditNoteDate.toISOString().split("T")[0],
        clientName: cn.client.businessName,
        gstin: cn.client.gstin,
        taxableValue: cn.subtotal,
        igst: cn.totalIgst,
        cgst: cn.totalCgst,
        sgst: cn.totalSgst,
        total: cn.totalAmount,
      }));

      // HSN Summary
      const hsnMap: Record<string, { hsnSac: string; description: string; quantity: number; taxableValue: number; igst: number; cgst: number; sgst: number; total: number }> = {};
      for (const inv of invoices) {
        for (const item of inv.items) {
          const hsn = item.hsnSac || "N/A";
          if (!hsnMap[hsn]) {
            hsnMap[hsn] = { hsnSac: hsn, description: item.itemName, quantity: 0, taxableValue: 0, igst: 0, cgst: 0, sgst: 0, total: 0 };
          }
          hsnMap[hsn].quantity += item.quantity;
          hsnMap[hsn].taxableValue += item.amount;
          hsnMap[hsn].igst += item.igst;
          hsnMap[hsn].cgst += item.cgst;
          hsnMap[hsn].sgst += item.sgst;
          hsnMap[hsn].total += item.total;
        }
      }
      const hsnSummary = Object.values(hsnMap);

      // Totals
      const b2bTotals = {
        taxableValue: b2b.reduce((s, r) => s + r.taxableValue, 0),
        igst: b2b.reduce((s, r) => s + r.igst, 0),
        cgst: b2b.reduce((s, r) => s + r.cgst, 0),
        sgst: b2b.reduce((s, r) => s + r.sgst, 0),
        total: b2b.reduce((s, r) => s + r.total, 0),
      };
      const b2cTotals = {
        taxableValue: b2c.reduce((s, r) => s + r.taxableValue, 0),
        igst: b2c.reduce((s, r) => s + r.igst, 0),
        cgst: b2c.reduce((s, r) => s + r.cgst, 0),
        sgst: b2c.reduce((s, r) => s + r.sgst, 0),
        total: b2c.reduce((s, r) => s + r.total, 0),
      };
      const cnTotals = {
        taxableValue: cnList.reduce((s, r) => s + r.taxableValue, 0),
        igst: cnList.reduce((s, r) => s + r.igst, 0),
        cgst: cnList.reduce((s, r) => s + r.cgst, 0),
        sgst: cnList.reduce((s, r) => s + r.sgst, 0),
        total: cnList.reduce((s, r) => s + r.total, 0),
      };

      return NextResponse.json({ b2b, b2c, b2cList, creditNotes: cnList, hsnSummary, b2bTotals, b2cTotals, cnTotals });
    }

    // GSTR-3B
    if (type === "gstr3b") {
      const taxableSupplies = invoices.reduce((s, inv) => s + inv.subtotal - inv.totalDiscount, 0);
      const totalIgst = invoices.reduce((s, inv) => s + inv.totalIgst, 0);
      const totalCgst = invoices.reduce((s, inv) => s + inv.totalCgst, 0);
      const totalSgst = invoices.reduce((s, inv) => s + inv.totalSgst, 0);
      const totalAmount = invoices.reduce((s, inv) => s + inv.totalAmount, 0);

      const interStateUnregistered = invoices
        .filter((inv) => !inv.client.gstin && inv.totalIgst > 0)
        .reduce(
          (acc, inv) => ({
            taxableValue: acc.taxableValue + inv.subtotal - inv.totalDiscount,
            igst: acc.igst + inv.totalIgst,
          }),
          { taxableValue: 0, igst: 0 }
        );

      const cnIgst = creditNotes.reduce((s, cn) => s + cn.totalIgst, 0);
      const cnCgst = creditNotes.reduce((s, cn) => s + cn.totalCgst, 0);
      const cnSgst = creditNotes.reduce((s, cn) => s + cn.totalSgst, 0);

      // ITC from purchase bills (excludes RCM bills — their ITC is claimed only
      // AFTER the outward liability is paid). Also compute the RCM outward
      // liability separately (Table 3.1(d) — inward supplies liable to RCM).
      const allBills = await prisma.purchaseBill.findMany({
        where: {
          billDate: { gte: startDate, lte: endDate },
          status: { not: "Cancelled" },
        },
      });
      const rcmBills = allBills.filter((b) => b.isReverseCharge);
      const nonRcmBills = allBills.filter((b) => !b.isReverseCharge && b.itcEligible);
      const itcIgst = nonRcmBills.reduce((s, b) => s + b.totalIgst, 0);
      const itcCgst = nonRcmBills.reduce((s, b) => s + b.totalCgst, 0);
      const itcSgst = nonRcmBills.reduce((s, b) => s + b.totalSgst, 0);

      const rcmTaxableValue = rcmBills.reduce((s, b) => s + b.subtotal, 0);
      const rcmIgst = rcmBills.reduce((s, b) => s + b.totalIgst, 0);
      const rcmCgst = rcmBills.reduce((s, b) => s + b.totalCgst, 0);
      const rcmSgst = rcmBills.reduce((s, b) => s + b.totalSgst, 0);

      // Net liability = outward + RCM outward − CN − ITC (ITC is only for
      // non-RCM bills; RCM ITC is claimable next period, out of scope here).
      const netIgst = Math.max(0, totalIgst + rcmIgst - cnIgst - itcIgst);
      const netCgst = Math.max(0, totalCgst + rcmCgst - cnCgst - itcCgst);
      const netSgst = Math.max(0, totalSgst + rcmSgst - cnSgst - itcSgst);

      return NextResponse.json({
        table3_1: {
          taxableValue: taxableSupplies,
          igst: totalIgst,
          cgst: totalCgst,
          sgst: totalSgst,
          total: totalAmount,
        },
        table3_1_d: {
          // Table 3.1(d) — Inward supplies liable to reverse charge (§9(3)/§9(4)).
          taxableValue: rcmTaxableValue,
          igst: rcmIgst,
          cgst: rcmCgst,
          sgst: rcmSgst,
          total: rcmTaxableValue + rcmIgst + rcmCgst + rcmSgst,
          billCount: rcmBills.length,
        },
        table3_2: interStateUnregistered,
        creditNoteAdjustment: { igst: cnIgst, cgst: cnCgst, sgst: cnSgst },
        itc: { igst: itcIgst, cgst: itcCgst, sgst: itcSgst, total: itcIgst + itcCgst + itcSgst },
        netTaxLiability: {
          igst: netIgst,
          cgst: netCgst,
          sgst: netSgst,
          total: netIgst + netCgst + netSgst,
        },
      });
    }

    return NextResponse.json({ error: "Invalid type. Use gstr1, gstr3b, tax-summary, itc-summary, or fy-summary" }, { status: 400 });
  } catch (err) {
    console.error("GST Report error:", err);
    return NextResponse.json({ error: "Failed to generate GST report" }, { status: 500 });
  }
}

export const GET = withApi(GET_handler);
