"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard, FileText, Users, ClipboardList, Truck, Receipt, CreditCard,
  FileMinus, BookMarked, CalendarClock, Bell, Briefcase, UserCircle, DollarSign,
  Package, Wallet, BookOpen, ShoppingCart, PackageCheck, TrendingUp, RefreshCw,
  FolderKanban, BarChart3, FileSpreadsheet, ClipboardCheck, Shield, Recycle,
  Settings, Search, Menu, X, Plus, ChevronDown, ChevronRight, ArrowUpRight,
} from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import { Eye, Edit2, Copy, Trash2 } from "lucide-react";
import { RealDoc, PayslipDoc as SharedPayslip, FnfDoc, IdCardDoc, GstReturnDoc, LetterDoc } from "@/components/landing/RealDocs";
import { DOC_TEMPLATES } from "@/lib/doc-templates";

/* ─────────────────────────────────────────────────────────────────────────
   DemoApp — a mirror window of the real QuoteGen SaaS.
   Same sidebar tree as src/components/Sidebar.tsx, same design system
   (.card / .btn-* / .tbl / StatusBadge from globals.css), dummy data only.
   No backend, no saves — every action shows a demo toast.
   ───────────────────────────────────────────────────────────────────────── */

const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

type Row = (string | number)[];
type Screen = {
  title: string; sub?: string; cta?: string;
  stats?: [string, string, string?][];              // label, value, color
  cols?: string[]; rows?: Row[]; badgeCol?: number;  // generic table
  custom?: React.ReactNode;
};

/* ── dummy screens (data mirrors real page columns) ─────────────────────── */
const S: Record<string, Screen> = {
  "/": { title: "", custom: <DashReal /> },
  "/clients": {
    title: "Clients", cta: "Add Client",
    cols: ["Name", "GSTIN", "City", "Outstanding", "Status"], badgeCol: 4,
    rows: [
      ["Sample Interiors", "33ABCDE1234F2Z6", "Chennai", inr(64500), "Active"],
      ["Sample Traders", "29ABCDE1234F1Z5", "Bengaluru", inr(0), "Active"],
      ["Example Exports", "33ABCDE1234F3Z7", "Coimbatore", inr(118000), "At Risk"],
      ["Demo Solutions", "36ABCDE1234F1Z5", "Hyderabad", inr(0), "Active"],
    ],
  },
  "/quotations": {
    title: "Quotations", cta: "New Quotation",
    stats: [["Total", "42"], ["Won", "23", "#059669"], ["Pending", "11", "#B45309"], ["Win rate", "55%", "#4F46E5"]],
    cols: ["Quote No", "Client", "Date", "Amount", "Status"], badgeCol: 4,
    rows: [
      ["QT-0342", "Example Exports", "06 Jul 2026", inr(340000), "Pending"],
      ["QT-0341", "Example Studio", "04 Jul 2026", inr(118000), "Won"],
      ["QT-0340", "Sample Interiors", "02 Jul 2026", inr(64500), "Sent"],
      ["QT-0339", "Sample Traders", "28 Jun 2026", inr(232000), "Draft"],
    ],
    custom: <QuoteDoc />,
  },
  "/sales-orders": {
    title: "Sales Orders", cta: "New Sales Order",
    cols: ["SO No", "Client", "Client PO", "Amount", "Status"], badgeCol: 4,
    rows: [
      ["SO-0088", "Example Studio", "PO-2214", inr(118000), "InProgress"],
      ["SO-0087", "Sample Interiors", "PO-1190", inr(64500), "Completed"],
      ["SO-0086", "Demo Solutions", "—", inr(90000), "Completed"],
    ],
    custom: <SoDoc />,
  },
  "/delivery-challans": {
    title: "Delivery Challans", cta: "New Challan",
    cols: ["DC No", "Client", "Against SO", "Items", "Status"], badgeCol: 4,
    rows: [
      ["DC-0054", "Example Studio", "SO-0088", "3 items", "Sent"],
      ["DC-0053", "Sample Interiors", "SO-0087", "5 items", "Done"],
    ],
    custom: <DcDoc />,
  },
  "/invoices": {
    title: "Invoices", cta: "New Invoice",
    stats: [["Total billed", inr(4820000)], ["Collected", inr(4392000), "#059669"], ["Unpaid", inr(310000), "#B45309"], ["Overdue", inr(118000), "#DC2626"]],
    cols: ["Invoice No", "Client", "Date", "Amount", "Status"], badgeCol: 4,
    rows: [
      ["INV-00248", "Example Studio", "04 Jul 2026", inr(118000), "Paid"],
      ["INV-00247", "Sample Interiors", "01 Jul 2026", inr(64500), "Unpaid"],
      ["INV-00246", "Example Exports", "22 Jun 2026", inr(118000), "Overdue"],
      ["INV-00245", "Sample Traders", "18 Jun 2026", inr(232000), "Paid"],
      ["INV-00244", "Demo Solutions", "12 Jun 2026", inr(90000), "PartiallyPaid"],
    ],
    custom: <InvoiceDoc />,
  },
  "/payment-receipts": {
    title: "Payment Receipts", cta: "Record Payment",
    cols: ["Receipt No", "Against", "Mode", "Amount", "Status"], badgeCol: 4,
    rows: [
      ["RCP-0161", "INV-00248", "UPI", inr(118000), "Settled"],
      ["RCP-0160", "INV-00245", "Bank Transfer", inr(232000), "Settled"],
      ["RCP-0159", "INV-00244", "Cheque", inr(45000), "Pending"],
    ],
    custom: <ReceiptDoc />,
  },
  "/credit-notes": {
    title: "Credit Notes", cta: "New Credit Note",
    cols: ["CN No", "Client", "Against", "Amount", "Status"], badgeCol: 4,
    rows: [["CN-0012", "Demo Solutions", "INV-00244", inr(12000), "Done"]],
  },
  "/catalog": {
    title: "Item Catalog", cta: "Add Item",
    cols: ["Item", "HSN/SAC", "Rate", "GST %", "Status"], badgeCol: 4,
    rows: [
      ["Brand identity package", "9983", inr(85000), "18%", "Active"],
      ["Website design & build", "9983", inr(150000), "18%", "Active"],
      ["Monthly design retainer", "9983", inr(100000), "18%", "Active"],
      ["Print collateral set", "4911", inr(24000), "12%", "Active"],
    ],
  },
  "/recurring-invoices": {
    title: "Recurring Invoices", cta: "New Recurring",
    cols: ["Client", "Plan", "Every", "Amount", "Status"], badgeCol: 4,
    rows: [
      ["Example Studio", "Design retainer", "Monthly", inr(118000), "Active"],
      ["Demo Solutions", "Maintenance", "Quarterly", inr(45000), "Paused"],
    ],
  },
  "/reminders": {
    title: "Reminders", sub: "Auto-generated from overdue invoices",
    cols: ["Invoice", "Client", "Overdue by", "Amount", "Status"], badgeCol: 4,
    rows: [
      ["INV-00246", "Example Exports", "14 days", inr(118000), "Pending"],
      ["INV-00247", "Sample Interiors", "5 days", inr(64500), "Sent"],
    ],
  },
  "/employees": {
    title: "Employees", cta: "Add Employee",
    cols: ["Name", "Role", "Joined", "CTC", "Status"], badgeCol: 4,
    rows: [
      ["Arun Kumar", "Sales Executive", "Mar 2024", inr(540000), "Active"],
      ["Meena Ravi", "Accounts", "Aug 2023", inr(480000), "Active"],
      ["Vikram S", "Operations Lead", "Jan 2023", inr(660000), "Active"],
    ],
    custom: <IdOut />,
  },
  "/salary": {
    title: "Salary — July 2026", cta: "Run Payroll",
    stats: [["Gross", inr(147000)], ["PF + ESI", inr(11640), "#B45309"], ["TDS + PT", inr(3110), "#B45309"], ["Net payable", inr(132250), "#059669"]],
    cols: ["Employee", "Basic", "HRA", "Deductions", "Net Pay"],
    rows: [
      ["Arun Kumar", inr(22500), inr(9000), inr(4930), inr(42300)],
      ["Meena Ravi", inr(20000), inr(8000), inr(4380), inr(38750)],
      ["Vikram S", inr(27500), inr(11000), inr(5440), inr(51200)],
    ],
    custom: <PayslipDoc />,
  },
  "/employee-assets": {
    title: "Employee Assets", cta: "Issue Asset",
    cols: ["Asset", "Assigned to", "Issued", "Value", "Status"], badgeCol: 4,
    rows: [
      ["MacBook Air M3", "Arun Kumar", "Mar 2024", inr(114900), "Active"],
      ["iPhone 15", "Vikram S", "Jan 2023", inr(79900), "Active"],
    ],
  },
  "/fnf": {
    title: "Full & Final Settlements",
    cols: ["Employee", "Last day", "Gratuity", "Recovery", "Status"], badgeCol: 4,
    rows: [["Deepak N", "31 May 2026", inr(48076), inr(12500), "Settled"]],
    custom: <FnfOut />,
  },
  "/transactions": {
    title: "Transactions",
    cols: ["Date", "Description", "Type", "Amount", "Status"], badgeCol: 4,
    rows: [
      ["04 Jul", "Payment · INV-00248", "Income", inr(118000), "Done"],
      ["03 Jul", "Vendor payment · BILL-0067", "Expense", inr(38500), "Done"],
      ["01 Jul", "Salary run · June", "Expense", inr(132250), "Done"],
    ],
  },
  "/vendors": {
    title: "Vendors", cta: "Add Vendor",
    cols: ["Vendor", "GSTIN", "Category", "Payable", "Status"], badgeCol: 4,
    rows: [
      ["Sample Prints", "33ABCDE1234F4Z8", "Printing", inr(38500), "Active"],
      ["Demo IT Supplies", "33ABCDE1234F5Z9", "Hardware", inr(0), "Active"],
    ],
  },
  "/purchase-orders": {
    title: "Purchase Orders", cta: "New PO",
    cols: ["PO No", "Vendor", "Date", "Amount", "Status"], badgeCol: 4,
    rows: [
      ["PO-0034", "Sample Prints", "02 Jul 2026", inr(38500), "Sent"],
      ["PO-0033", "Demo IT Supplies", "20 Jun 2026", inr(114900), "Completed"],
    ],
    custom: <PoDoc />,
  },
  "/goods-receipts": {
    title: "Goods Receipts", cta: "New GRN",
    cols: ["GRN No", "Against PO", "Received", "Qty match", "Status"], badgeCol: 4,
    rows: [["GRN-0021", "PO-0033", "24 Jun 2026", "12 / 12", "Done"]],
    custom: <GrnDoc />,
  },
  "/purchase-bills": {
    title: "Vendor Bills", cta: "Record Bill", sub: "3-way matched against PO + GRN",
    cols: ["Bill No", "Vendor", "3-way match", "Amount", "Status"], badgeCol: 4,
    rows: [
      ["BILL-0067", "Sample Prints", "Matched ✓", inr(38500), "Unpaid"],
      ["BILL-0066", "Demo IT Supplies", "Matched ✓", inr(114900), "Paid"],
    ],
  },
  "/debit-notes": {
    title: "Debit Notes", cta: "New Debit Note",
    cols: ["DN No", "Vendor", "Against", "Amount", "Status"], badgeCol: 4,
    rows: [["DN-0004", "Sample Prints", "BILL-0067", inr(2400), "Sent"]],
    custom: <DnDoc />,
  },
  "/payables": {
    title: "Payables Ageing",
    stats: [["Total payable", inr(41000 + 38500)], ["Current", inr(38500), "#059669"], ["30 days", inr(41000), "#B45309"], ["60+ days", inr(0), "#DC2626"]],
    cols: ["Vendor", "Bill", "Due", "Amount", "Status"], badgeCol: 4,
    rows: [
      ["Sample Prints", "BILL-0067", "12 Jul 2026", inr(38500), "Unpaid"],
      ["Sample Rentals", "BILL-0064", "28 Jun 2026", inr(41000), "Overdue"],
    ],
  },
  "/cash": {
    title: "Cash Command Center",
    stats: [["Money in", inr(482000), "#059669"], ["Money out", inr(214000), "#DC2626"], ["Net position", inr(268000), "#4F46E5"], ["Follow-ups due", "3", "#B45309"]],
    custom: <CashExtra />,
  },
  "/subscriptions": {
    title: "Subscriptions", cta: "New Subscription",
    cols: ["Client", "Service", "Renews", "Amount", "Status"], badgeCol: 4,
    rows: [["Demo Solutions", "Hosting + support", "01 Aug 2026", inr(15000), "Active"]],
  },
  "/pipeline": {
    title: "Sales Pipeline",
    stats: [["Leads", "8"], ["Quoted", "5", "#4F46E5"], ["Negotiation", "3", "#B45309"], ["Won this month", "4", "#059669"]],
    cols: ["Deal", "Client", "Stage", "Value", "Status"], badgeCol: 4,
    rows: [
      ["Office rebrand", "Example Exports", "Negotiation", inr(340000), "Pending"],
      ["Web revamp", "New lead", "Quoted", inr(150000), "Sent"],
    ],
  },
  "/documents": {
    title: "Document Vault", cta: "Upload",
    cols: ["Document", "Linked to", "Uploaded by", "Date", "Status"], badgeCol: 4,
    rows: [
      ["Client PO-2214.pdf", "SO-0088", "Arun Kumar", "04 Jul", "Active"],
      ["Rental agreement.pdf", "Vendor · Sample Rentals", "Priya", "12 Jan", "Active"],
    ],
    custom: <TemplatesOut />,
  },
  "/projects": {
    title: "Projects", cta: "New Project",
    cols: ["Project", "Client", "Deadline", "Billed", "Status"], badgeCol: 4,
    rows: [
      ["Brand refresh", "Example Studio", "30 Aug 2026", inr(118000), "InProgress"],
      ["Store interiors", "Sample Interiors", "15 Jul 2026", inr(64500), "OnHold"],
    ],
  },
  "/reports": {
    title: "Reports", sub: "Revenue, tax, ageing, payroll — export any of them",
    custom: <ReportsExtra />,
  },
  "/gst-report": {
    title: "GST Returns — June 2026",
    stats: [["Taxable value", inr(408475)], ["CGST", inr(36763), "#4F46E5"], ["SGST", inr(36763), "#4F46E5"], ["IGST", inr(16200), "#B45309"]],
    cols: ["Section", "Invoices", "Taxable", "Tax", "Status"], badgeCol: 4,
    rows: [
      ["B2B", "9", inr(382475), inr(68843), "Done"],
      ["B2CS", "4", inr(26000), inr(4680), "Done"],
      ["Nil-rated", "1", inr(0), inr(0), "Done"],
    ],
    custom: <><GstExtra /><GstOut /></>,
  },
  "/follow-ups": {
    title: "Follow-ups",
    cols: ["With", "About", "Due", "Owner", "Status"], badgeCol: 4,
    rows: [
      ["Example Exports", "INV-00246 overdue", "Today", "Arun", "Pending"],
      ["New lead", "Quote QT-0343 discussion", "08 Jul", "Priya", "Todo"],
    ],
  },
  "/approvals": {
    title: "Approvals", sub: "Multi-step workflows on quotes, invoices, POs and payroll",
    custom: <ApprovalsExtra />,
  },
  "/audit-logs": {
    title: "Audit Log", sub: "Every action, with before / after values",
    custom: <AuditExtra />,
  },
  "/recycle-bin": {
    title: "Recycle Bin",
    cols: ["Record", "Type", "Deleted by", "When", "Status"], badgeCol: 4,
    rows: [["QT-0335", "Quotation", "Arun Kumar", "28 Jun", "Pending"]],
  },
  "/settings/profile": {
    title: "My Profile",
    custom: (
      <div className="card mt-1" style={{ padding: 20, maxWidth: 560 }}>
        <div className="flex items-center gap-4">
          <span className="w-14 h-14 rounded-full flex items-center justify-center text-[18px] font-bold text-white" style={{ background: "#4F46E5" }}>P</span>
          <div><p className="text-[16px] font-bold">R. Priya (name changed)</p><p className="text-[12.5px]" style={{ color: "#64748B" }}>priya@example.com · Owner</p></div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-5 text-[13px]">
          {[["Phone", "+91 90000 00000"], ["Role", "Owner (all modules)"], ["2FA", "Enabled ✓"], ["Last login", "Today, 09:02"]].map(([l, v]) => (
            <div key={l}><p className="text-[10.5px] uppercase font-bold" style={{ color: "#94A3B8" }}>{l}</p><p className="font-semibold mt-0.5">{v}</p></div>
          ))}
        </div>
      </div>
    ),
  },
  "/settings": {
    title: "General Settings", sub: "Business identity printed on every document",
    custom: (
      <div className="card mt-1" style={{ padding: 20, maxWidth: 640 }}>
        <div className="grid sm:grid-cols-2 gap-3 text-[13px]">
          {[["Business name", "Example Studio"], ["GSTIN", "33ABCDE1234F1Z5"], ["PAN", "ABCDE1234F"], ["Address", "1 Example Street, Example City 600001"], ["Email", "billing@example.com"], ["Phone", "+91 90000 00000"], ["Bank", "Example Bank · ****1837 · EXBK0000001"], ["Theme color", "Indigo #4F46E5"]].map(([l, v]) => (
            <div key={l} className="rounded-lg p-3" style={{ background: "#F0F2F8" }}>
              <p className="text-[10.5px] uppercase font-bold" style={{ color: "#94A3B8" }}>{l}</p><p className="font-semibold mt-0.5">{v}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  "/settings/business-setup": {
    title: "Business Setup", sub: "Logo, document numbering and prefixes",
    custom: (
      <div className="grid sm:grid-cols-2 gap-3 mt-1" style={{ maxWidth: 700 }}>
        <div className="card" style={{ padding: 18 }}>
          <p className="text-[11px] uppercase font-bold" style={{ color: "#94A3B8" }}>Document series</p>
          {[["Quotations", "QT-", "0343 next"], ["Invoices (GST)", "INV-", "00249 next"], ["Invoices (non-GST)", "NB-", "0021 next"], ["Receipts", "RCP-", "0162 next"]].map(([l, p, n]) => (
            <div key={l} className="flex justify-between py-2 text-[13px]" style={{ borderBottom: "1px solid #E8EAEF" }}>
              <span>{l}</span><span className="lp-num font-semibold">{p} <span style={{ color: "#94A3B8" }}>· {n}</span></span>
            </div>
          ))}
        </div>
        <div className="card" style={{ padding: 18 }}>
          <p className="text-[11px] uppercase font-bold" style={{ color: "#94A3B8" }}>Branding</p>
          <div className="mt-3 rounded-lg flex items-center justify-center h-20" style={{ background: "#F0F2F8", border: "1px dashed #C7D2FE" }}>
            <span className="text-[13px] font-bold" style={{ color: "#4F46E5" }}>Example Studio logo</span>
          </div>
          <p className="text-[12px] mt-2" style={{ color: "#64748B" }}>Appears on every quote, invoice, challan and payslip.</p>
        </div>
      </div>
    ),
  },
  "/settings/users": {
    title: "Users", cta: "Invite User",
    cols: ["User", "Email", "Role", "2FA", "Status"], badgeCol: 4,
    rows: [
      ["Priya S", "priya@example.com", "Owner", "On", "Active"],
      ["Arun Kumar", "arun@example.com", "Sales", "On", "Active"],
      ["Meena Ravi", "meena@example.com", "Accounts", "Off", "Active"],
      ["Vikram S", "vikram@example.com", "Operations", "On", "Active"],
    ],
  },
  "/settings/roles": {
    title: "Roles & Permissions", cta: "New Role",
    custom: (
      <div className="card tbl-wrap mt-1" style={{ padding: 0 }}>
        <table className="tbl">
          <thead><tr><th>Role</th><th>Invoices</th><th>Quotations</th><th>Salary</th><th>Settings</th><th>Audit Log</th></tr></thead>
          <tbody>
            {[["Owner", "Full", "Full", "Full", "Full", "Full"], ["Sales", "Create + view", "Full", "—", "—", "—"], ["Accounts", "Full", "View", "Full", "—", "View"], ["Operations", "View", "View", "—", "—", "—"]].map((r) => (
              <tr key={r[0]}>{r.map((c, i) => <td key={i} className={i === 0 ? "font-bold text-[13px]" : "text-[12.5px]"} style={i > 0 && c === "—" ? { color: "#CBD5E1" } : {}}>{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
  },
  "/settings/workflows": {
    title: "Approval Workflows", cta: "New Workflow",
    custom: (
      <div className="space-y-3 mt-1" style={{ maxWidth: 640 }}>
        {[["Quotations above ₹2,00,000", "Sales → Partner → Owner", "2 steps · e-sign on final"], ["Payroll runs", "Accounts → Owner", "2 steps"], ["Purchase orders", "Any → Owner", "1 step"]].map(([t, path, meta]) => (
          <div key={t} className="card" style={{ padding: 16 }}>
            <p className="text-[13.5px] font-bold">{t}</p>
            <p className="text-[12.5px] mt-1 lp-num" style={{ color: "#4F46E5" }}>{path}</p>
            <p className="text-[11.5px] mt-0.5" style={{ color: "#94A3B8" }}>{meta}</p>
          </div>
        ))}
      </div>
    ),
  },
  "/settings/message-templates": {
    title: "Message Templates", cta: "New Template",
    custom: (
      <div className="grid sm:grid-cols-2 gap-3 mt-1" style={{ maxWidth: 760 }}>
        {[["Invoice email", "Hi {{client}}, please find invoice {{no}} for {{amount}} attached. Due {{due_date}}."], ["Payment reminder (WhatsApp)", "Gentle reminder: invoice {{no}} of {{amount}} is overdue by {{days}} days. Pay via {{link}}."], ["Quote follow-up", "Hi {{client}}, following up on quotation {{no}} — happy to walk you through it."], ["Receipt confirmation", "Payment of {{amount}} received against {{invoice}}. Receipt {{no}} attached. Thank you!"]].map(([t, body]) => (
          <div key={t} className="card" style={{ padding: 16 }}>
            <p className="text-[13px] font-bold">{t}</p>
            <p className="text-[12px] mt-1.5 rounded-lg p-2.5 lp-num" style={{ background: "#F0F2F8", color: "#475569" }}>{body}</p>
          </div>
        ))}
      </div>
    ),
  },
  "/settings/activity-logs": {
    title: "Activity Logs", sub: "Sign-ins and security events",
    cols: ["When", "User", "Event", "IP", "Status"], badgeCol: 4,
    rows: [
      ["Today 09:02", "Priya S", "Signed in (2FA)", "49.205.xx.xx", "Done"],
      ["Today 08:44", "Arun Kumar", "Signed in", "106.51.xx.xx", "Done"],
      ["Yesterday", "Unknown", "Failed login (wrong password)", "182.72.xx.xx", "Lost"],
    ],
  },
  "/settings/security": {
    title: "Security",
    custom: (
      <div className="grid sm:grid-cols-2 gap-3 mt-1" style={{ maxWidth: 700 }}>
        {[["Two-factor authentication", "Enabled for 3 of 4 users", "On"], ["Active sessions", "2 devices · revoke anytime", "OK"], ["Password policy", "Min 8 chars, rotation reminders", "On"], ["Login alerts", "Email on new device sign-in", "On"]].map(([t, d, s]) => (
          <div key={t} className="card flex items-start justify-between gap-3" style={{ padding: 16 }}>
            <div><p className="text-[13.5px] font-bold">{t}</p><p className="text-[12px] mt-0.5" style={{ color: "#64748B" }}>{d}</p></div>
            <StatusBadge status={s === "On" || s === "OK" ? "Active" : "Inactive"} />
          </div>
        ))}
      </div>
    ),
  },
  "/settings/privacy": {
    title: "Privacy & Data", sub: "DPDP-compliant controls",
    custom: (
      <div className="space-y-3 mt-1" style={{ maxWidth: 560 }}>
        {[["Export all data", "Full JSON export of every record your company owns"], ["Delete account", "Erase the workspace after a 30-day cooling period"], ["Audit retention", "Logs retained 365 days, then archived"]].map(([t, d]) => (
          <div key={t} className="card" style={{ padding: 16 }}>
            <p className="text-[13.5px] font-bold">{t}</p><p className="text-[12px] mt-0.5" style={{ color: "#64748B" }}>{d}</p>
          </div>
        ))}
      </div>
    ),
  },
  "/settings/api-keys": {
    title: "API Keys", cta: "Generate Key",
    cols: ["Name", "Key", "Created", "Last used", "Status"], badgeCol: 4,
    rows: [
      ["Zapier integration", "qg_live_••••7f2a", "12 Jun 2026", "Today", "Active"],
      ["Internal reporting", "qg_live_••••c918", "02 May 2026", "3 days ago", "Active"],
    ],
  },
  "/billing": {
    title: "Billing & Invoices",
    custom: (
      <div className="mt-1" style={{ maxWidth: 640 }}>
        <div className="card flex flex-wrap items-center justify-between gap-3" style={{ padding: 18, background: "#EEF2FF", border: "1px solid #DDD6FE" }}>
          <div><p className="text-[14px] font-bold" style={{ color: "#4338CA" }}>✨ Launch offer — Free</p><p className="text-[12.5px]" style={{ color: "#64748B" }}>Every module unlocked · renews Oct 2026 · no card on file</p></div>
          <span className="btn-primary" style={{ display: "inline-flex", alignItems: "center", height: 34, padding: "0 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 600 }}>See plans</span>
        </div>
        <div className="card tbl-wrap mt-3" style={{ padding: 0 }}>
          <table className="tbl">
            <thead><tr><th>Invoice</th><th>Period</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody><tr><td className="font-bold text-indigo-600 text-[13px]">QG-SUB-0001</td><td>Jul – Oct 2026</td><td className="lp-num">₹0 (launch)</td><td><StatusBadge status="Paid" /></td></tr></tbody>
          </table>
        </div>
      </div>
    ),
  },
};

/* ── custom screen bits ─────────────────────────────────────────────────── */
/* Exact replica of the real dashboard (src/app/page.tsx) */
function DashReal() {
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[12px]" style={{ color: "#94A3B8" }}>Monday, 6 July 2026</p>
          <h2 className="text-[24px] font-bold" style={{ color: "#0F172A", letterSpacing: "-0.01em" }}>Good evening 👋</h2>
        </div>
        <div className="flex gap-2">
          <span className="btn-outline" style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 38, padding: "0 16px", borderRadius: 10, fontSize: 13, fontWeight: 600 }}><Plus size={14} /> Quotation</span>
          <span className="btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 38, padding: "0 16px", borderRadius: 10, fontSize: 13, fontWeight: 600 }}><Plus size={14} /> Invoice</span>
        </div>
      </div>

      <div className="card mt-4 flex items-center gap-3" style={{ padding: "14px 16px", maxWidth: 340, background: "#F5F3FF", border: "1px solid #DDD6FE" }}>
        <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "white" }}><RefreshCw size={16} style={{ color: "#7C3AED" }} /></span>
        <div><p className="text-[13.5px] font-bold" style={{ color: "#6D28D9" }}>Renewals Due</p><p className="text-[12px]" style={{ color: "#64748B" }}>1 this week</p></div>
        <ChevronRight size={15} className="ml-auto" style={{ color: "#7C3AED" }} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mt-4">
        {([[Users, 6, "Clients"], [Briefcase, 3, "Employees"], [FolderKanban, 2, "Projects"], [Package, 2, "Vendors"], [RefreshCw, 1, "Subscriptions"], [FileText, 42, "Quotations"]] as [React.ElementType, number, string][]).map(([Icon, n, l]) => (
          <div key={l} className="card flex items-center gap-3" style={{ padding: "12px 14px" }}>
            <Icon size={17} style={{ color: "#4F46E5" }} />
            <div><p className="lp-num text-[16px] font-bold leading-none">{n}</p><p className="text-[11px] mt-0.5" style={{ color: "#64748B" }}>{l}</p></div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        {["This Month", "Last Month", "This Quarter", "This Year", "All Time"].map((p, i) => (
          <span key={p} className="text-[12.5px] font-semibold rounded-full px-4 py-1.5"
                style={{ background: "white", border: `1.5px solid ${i === 4 ? "#4F46E5" : "#E8EAEF"}`, color: i === 4 ? "#4338CA" : "#475569" }}>{p}</span>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-3 mt-4">
        <div className="card" style={{ padding: 20 }}>
          <div className="flex justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748B" }}>Revenue <span className="font-normal normal-case">(All Time)</span></p>
            <span className="text-[12px] font-semibold" style={{ color: "#4F46E5" }}>Reports ↗</span>
          </div>
          <p className="lp-num text-[34px] font-bold mt-2" style={{ color: "#0F172A" }}>{inr(4820000)}</p>
          <p className="text-[12.5px]" style={{ color: "#64748B" }}>42 invoices · 6 clients</p>
          <div className="grid grid-cols-2 gap-y-4 mt-5 pt-4" style={{ borderTop: "1px solid #E8EAEF" }}>
            {[["Collected", inr(4392000), "#059669"], ["Outstanding", inr(428000), "#DC2626"], ["This Month", inr(482000), "#0F172A"], ["Net Profit", inr(1340000), "#059669"]].map(([l, v, c]) => (
              <div key={l}><p className="text-[12px] font-semibold" style={{ color: c }}>{l}</p><p className="lp-num text-[19px] font-bold" style={{ color: c }}>{v}</p></div>
            ))}
          </div>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div className="flex justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748B" }}>Expenses</p>
            <span className="text-[12px] font-semibold" style={{ color: "#4F46E5" }}>All transactions ↗</span>
          </div>
          {[["Vendors", inr(214000), 62, "#F97316"], ["Salaries", inr(132250), 38, "#4F46E5"]].map(([l, v, w, c]) => (
            <div key={l as string} className="mt-4">
              <div className="flex justify-between text-[13px]"><span className="font-semibold">{l}</span><span className="lp-num font-bold">{v}</span></div>
              <div className="h-2 rounded-full mt-1.5" style={{ background: "#F0F2F8" }}>
                <div className="h-2 rounded-full" style={{ width: `${w}%`, background: c as string }} />
              </div>
            </div>
          ))}
          <div className="flex justify-between mt-5 pt-4 text-[13.5px] font-bold" style={{ borderTop: "1px solid #E8EAEF" }}>
            <span>Total Expenses</span><span className="lp-num">{inr(346250)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function InvoiceDoc() { return <RealDoc type="Invoice" no="INV-00248" status="Paid" title="Design retainer — July" note="Output preview — the exact invoice your client receives" />; }
function QuoteDoc() { return <RealDoc type="Quotation" no="QT-0341" status="Won" title="Design retainer — July" note="Output preview — the exact quotation your client receives" />; }
function ReceiptDoc() { return <RealDoc type="Payment Receipt" no="RCP-0161" status="Settled" title="Payment against INV-00248" note="Output preview — the receipt issued on payment" />; }
function SoDoc() { return <RealDoc type="Sales Order" no="SO-0088" status="InProgress" title="Design retainer — July" note="Output preview — the sales order document" />; }
function DcDoc() { return <RealDoc type="Delivery Challan" no="DC-0054" status="Sent" title="Dispatch against SO-0088" note="Output preview — the delivery challan for dispatch" />; }
function PoDoc() { return <RealDoc type="Purchase Order" no="PO-0034" status="Sent" title="Print collateral order" note="Output preview — the PO your vendor receives" />; }
function DnDoc() { return <RealDoc type="Debit Note" no="DN-0004" status="Sent" title="Return against BILL-0067" note="Output preview — the debit note document" />; }
function GrnDoc() { return <RealDoc type="Goods Receipt Note" no="GRN-0021" status="Done" title="Receipt against PO-0033" note="Output preview — the goods receipt note" />; }

function PayslipDoc(){return(<div className="mt-4"><p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{color:"#64748B"}}>Output preview — payslip generated for each employee</p><SharedPayslip/></div>);}
function FnfOut(){return(<div className="mt-4"><p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{color:"#64748B"}}>Output preview — the settlement statement</p><FnfDoc/></div>);}
function IdOut(){return(<div className="mt-4"><p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{color:"#64748B"}}>Output preview — employee ID card</p><IdCardDoc/></div>);}
function GstOut(){return(<div className="mt-4"><p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{color:"#64748B"}}>Output preview — the compiled return</p><GstReturnDoc/></div>);}

function TemplatesOut(){return(
  <div className="mt-4">
    <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{color:"#64748B"}}>Pre-made templates — 16 real letter templates, rendered on your letterhead</p>
    <div className="flex flex-wrap gap-2 mb-3">
      {DOC_TEMPLATES.map((t)=>(
        <span key={t.id} className="text-[11px] font-semibold rounded-full px-3 py-1" style={{background:"#EEF2FF",color:"#4338CA"}}>{t.title}</span>
      ))}
    </div>
    <LetterDoc tplId="offer-letter" values={{employee:"Arun Kumar",role:"Sales Executive",ctc:"5,40,000",joining:"01 Aug 2026",date:"07 Jul 2026"}}/>
  </div>);}

function CashExtra() {
  return (
    <div className="card mt-3" style={{ padding: 16 }}>
      <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#64748B" }}>Receivables ageing</p>
      <div className="mt-3 space-y-2">
        {[["Current", 62, "#059669", inr(232000)], ["1–30 days", 24, "#B45309", inr(64500)], ["31–60 days", 10, "#EA580C", inr(45000)], ["60+ days", 14, "#DC2626", inr(118000)]].map(([l, w, c, amt]) => (
          <div key={l as string} className="flex items-center gap-3 text-[12px]">
            <span className="w-20 shrink-0" style={{ color: "#64748B" }}>{l}</span>
            <span className="h-2.5 rounded-full" style={{ width: `${w}%`, background: c as string }} />
            <span className="lp-num ml-auto font-semibold">{amt}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GstExtra() {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <span className="btn-primary" style={{ display: "inline-flex", alignItems: "center", height: 34, padding: "0 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 600 }}>Export GSTR-1 JSON</span>
      <span className="btn-outline" style={{ display: "inline-flex", alignItems: "center", height: 34, padding: "0 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 600 }}>Export GSTR-3B</span>
    </div>
  );
}

function ReportsExtra() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-1">
      {[["Revenue report", "Month-wise income vs expense"], ["Ageing report", "Receivables by bucket"], ["GST summary", "Tax collected & paid"], ["Payroll register", "Salary components by month"], ["Client statement", "Ledger per client"], ["Vendor statement", "Ledger per vendor"]].map(([t, d]) => (
        <div key={t} className="card" style={{ padding: 16 }}>
          <BarChart3 size={16} style={{ color: "#4F46E5" }} />
          <p className="text-[13.5px] font-semibold mt-2">{t}</p>
          <p className="text-[12px] mt-0.5" style={{ color: "#64748B" }}>{d}</p>
        </div>
      ))}
    </div>
  );
}

function ApprovalsExtra() {
  return (
    <div className="space-y-3 mt-1">
      <div className="card" style={{ padding: 16, borderLeft: "3px solid #DC2626" }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[14px] font-semibold">Quotation QT-0342 · {inr(340000)}</p>
            <p className="text-[12px]" style={{ color: "#64748B" }}>Raised by Arun Kumar · Step 1 of 2 · awaiting Owner approval</p>
          </div>
          <div className="flex gap-2">
            <span className="btn-success" style={{ display: "inline-flex", alignItems: "center", height: 32, padding: "0 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 600 }}>Approve & sign</span>
            <span className="btn-danger-soft" style={{ display: "inline-flex", alignItems: "center", height: 32, padding: "0 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, border: "1px solid #FECACA" }}>Reject</span>
          </div>
        </div>
      </div>
      <div className="card" style={{ padding: 16 }}>
        <p className="text-[14px] font-semibold">July payroll · {inr(132250)}</p>
        <p className="text-[12px]" style={{ color: "#64748B" }}>Raised by Meena Ravi · Step 2 of 2 · approved by Partner, awaiting you</p>
      </div>
    </div>
  );
}

function AuditExtra() {
  const rows = [
    ["09:41", "Priya (Owner)", "APPROVED", "Invoice INV-00248 · " + inr(118000)],
    ["09:38", "Arun Kumar", "UPDATED", "QT-0341 · discount 5% → 8%"],
    ["09:12", "Meena Ravi", "CREATED", "Receipt RCP-0161 against INV-00248"],
    ["08:55", "System", "REMINDER", "INV-00246 · overdue 14 days"],
    ["08:10", "Vikram S", "DELETED", "QT-0335 → Recycle Bin"],
  ];
  return (
    <div className="card mt-1" style={{ padding: 0, overflow: "hidden" }}>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[48px_minmax(0,1fr)] sm:grid-cols-[56px_150px_110px_1fr] gap-x-3 gap-y-0.5 px-4 py-3 text-[12.5px]"
             style={{ borderTop: i ? "1px solid #E8EAEF" : "none" }}>
          <span className="lp-num" style={{ color: "#94A3B8" }}>{r[0]}</span>
          <span className="font-semibold">{r[1]}</span>
          <span className="lp-num font-semibold" style={{ color: "#4F46E5" }}>{r[2]}</span>
          <span className="col-span-2 sm:col-span-1" style={{ color: "#475569" }}>{r[3]}</span>
        </div>
      ))}
    </div>
  );
}

function SettingsExtra() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-1">
      {[["Users & Roles", "4 users · 3 roles · per-module permissions"], ["Approval Workflows", "2 active workflows"], ["Business Setup", "Logo, GSTIN, invoice series"], ["Security", "2FA on · sessions · API keys"], ["Message Templates", "Email & WhatsApp templates"], ["Billing", "Free plan · 3 months remaining"]].map(([t, d]) => (
        <div key={t} className="card" style={{ padding: 16 }}>
          <p className="text-[13.5px] font-semibold">{t}</p>
          <p className="text-[12px] mt-0.5" style={{ color: "#64748B" }}>{d}</p>
        </div>
      ))}
    </div>
  );
}

/* ── nav tree (mirror of src/components/Sidebar.tsx) ────────────────────── */
type NavChild = { label: string; href: string; icon: React.ElementType };
type NavItem = { label: string; href?: string; icon: React.ElementType; children?: NavChild[] };

const NAV: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Sales & Invoices", icon: FileText, children: [
    { label: "Clients", href: "/clients", icon: Users },
    { label: "Quotations", href: "/quotations", icon: FileText },
    { label: "Sales Orders", href: "/sales-orders", icon: ClipboardList },
    { label: "Delivery Challans", href: "/delivery-challans", icon: Truck },
    { label: "Invoices", href: "/invoices", icon: Receipt },
    { label: "Payment Receipts", href: "/payment-receipts", icon: CreditCard },
    { label: "Credit Notes", href: "/credit-notes", icon: FileMinus },
    { label: "Catalog", href: "/catalog", icon: BookMarked },
    { label: "Recurring", href: "/recurring-invoices", icon: CalendarClock },
    { label: "Reminders", href: "/reminders", icon: Bell },
  ]},
  { label: "HR & Payroll", icon: Briefcase, children: [
    { label: "Employees", href: "/employees", icon: UserCircle },
    { label: "Salary", href: "/salary", icon: DollarSign },
    { label: "Assets", href: "/employee-assets", icon: Package },
    { label: "Full & Final", href: "/fnf", icon: FileMinus },
  ]},
  { label: "Finance", icon: Wallet, children: [
    { label: "Transactions", href: "/transactions", icon: BookOpen },
    { label: "Vendors", href: "/vendors", icon: Package },
    { label: "Purchase Orders", href: "/purchase-orders", icon: ShoppingCart },
    { label: "Goods Receipts", href: "/goods-receipts", icon: PackageCheck },
    { label: "Vendor Bills", href: "/purchase-bills", icon: Receipt },
    { label: "Debit Notes", href: "/debit-notes", icon: FileMinus },
    { label: "Payables", href: "/payables", icon: Wallet },
    { label: "Cash Command Center", href: "/cash", icon: TrendingUp },
    { label: "Subscriptions", href: "/subscriptions", icon: RefreshCw },
  ]},
  { label: "Sales Pipeline", href: "/pipeline", icon: TrendingUp },
  { label: "Documents", href: "/documents", icon: BookMarked },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "GST Returns", href: "/gst-report", icon: FileSpreadsheet },
  { label: "Follow-ups", href: "/follow-ups", icon: CalendarClock },
  { label: "Approvals", href: "/approvals", icon: ClipboardCheck },
  { label: "Audit Log", href: "/audit-logs", icon: Shield },
  { label: "Recycle Bin", href: "/recycle-bin", icon: Recycle },
  { label: "Settings", icon: Settings, children: [
    { label: "My Profile", href: "/settings/profile", icon: UserCircle },
    { label: "General", href: "/settings", icon: Settings },
    { label: "Business Setup", href: "/settings/business-setup", icon: BookMarked },
    { label: "Users", href: "/settings/users", icon: Users },
    { label: "Roles", href: "/settings/roles", icon: Shield },
    { label: "Workflows", href: "/settings/workflows", icon: ClipboardCheck },
    { label: "Message Templates", href: "/settings/message-templates", icon: FileText },
    { label: "Activity Logs", href: "/settings/activity-logs", icon: BookOpen },
    { label: "Security", href: "/settings/security", icon: Shield },
    { label: "Privacy & Data", href: "/settings/privacy", icon: Shield },
    { label: "API Keys", href: "/settings/api-keys", icon: Package },
    { label: "Billing & Invoices", href: "/billing", icon: Receipt },
  ]},
];

/* ── guided tour steps ──────────────────────────────────────────────────── */
const TOUR: { href: string; group?: string; text: string }[] = [
  { href: "/", text: "This is your dashboard — today's money, pending approvals and alerts, the moment you log in." },
  { href: "/quotations", group: "Sales & Invoices", text: "Create GST-ready quotations and track every one to Won or Lost." },
  { href: "/invoices", group: "Sales & Invoices", text: "One click converts a quote to a compliant invoice — CGST/SGST auto-split, HSN summary included." },
  { href: "/cash", group: "Finance", text: "The Cash Command Center: money in, money out, and who owes you — aged by 30/60/90 days." },
  { href: "/gst-report", text: "GSTR-1 and 3B compile themselves from your invoices. Export JSON for filing." },
  { href: "/salary", group: "HR & Payroll", text: "Payroll computes Basic, HRA, PF, ESI and TDS — payslips generate per employee." },
  { href: "/approvals", text: "Nothing big goes out on one person's say-so. Approvals gate quotes, invoices, POs and payroll." },
  { href: "/audit-logs", text: "And the audit log remembers everything — who did what, with before and after values." },
];

/* ── the demo app ───────────────────────────────────────────────────────── */
export default function DemoApp({ full = false }: { full?: boolean }) {
  const [path, setPath] = useState("/");
  const [open, setOpen] = useState<Record<string, boolean>>({ "Sales & Invoices": true });
  const [menu, setMenu] = useState(false);        // mobile drawer
  const [toast, setToast] = useState<string | null>(null);
  const [tour, setTour] = useState(0);            // index into TOUR, -1 = off
  const toastTimer = useRef<number | null>(null);

  const demoToast = (msg = "Demo mode — sign up free to use this for real.") => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  };

  const nav = (href: string) => {
    setPath(href);
    setMenu(false);
    if (tour >= 0 && TOUR[tour]?.href === href) {
      setTour(tour + 1 < TOUR.length ? tour + 1 : -1);
    }
  };

  /* tour: open the group containing the target + auto-advance */
  const step = tour >= 0 ? TOUR[tour] : null;
  useEffect(() => {
    if (!step) return;
    if (step.group) setOpen((o) => ({ ...o, [step.group!]: true }));
    const id = window.setTimeout(() => nav(step.href), 5200);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour]);

  const screen = S[path] ?? S["/"];

  const NavBtn = ({ item, child }: { item: NavItem | NavChild; child?: boolean }) => {
    const active = item.href === path;
    const isTarget = step?.href === item.href;
    return (
      <button onClick={() => item.href && nav(item.href)}
        className="relative w-full flex items-center gap-2.5 rounded-lg text-left cursor-pointer transition-colors"
        style={{
          padding: child ? "7px 10px 7px 30px" : "8px 10px",
          fontSize: 13, fontWeight: active ? 600 : 500,
          background: active ? "#EEF2FF" : "transparent",
          color: active ? "#4338CA" : "#334155",
        }}>
        <item.icon size={15} strokeWidth={1.9} style={{ color: active ? "#4F46E5" : "#64748B" }} />
        {item.label}
        {isTarget && (
          <span aria-hidden className="absolute inset-0 rounded-lg pointer-events-none demo-pulse" style={{ border: "2px solid #4F46E5" }} />
        )}
      </button>
    );
  };

  const sidebar = (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: "#FFFFFF", borderRight: "1px solid #E8EAEF", scrollbarWidth: "thin" }}>
      <div className="flex items-center justify-between px-4 h-14 shrink-0" style={{ borderBottom: "1px solid #E8EAEF" }}>
        <span className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#4F46E5", boxShadow: "0 4px 10px rgba(79,70,229,0.35)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" /></svg>
          </span>
          <span>
            <span className="block text-[15px] font-bold leading-tight" style={{ color: "#0F172A" }}>QuoteGen</span>
            <span className="block text-[10.5px]" style={{ color: "#94A3B8" }}>Business Suite</span>
          </span>
        </span>
        <button className="lg:hidden cursor-pointer" onClick={() => setMenu(false)} aria-label="Close menu"><X size={17} /></button>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {NAV.map((item) =>
          item.children ? (
            <div key={item.label}>
              <button onClick={() => setOpen((o) => ({ ...o, [item.label]: !o[item.label] }))}
                className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-semibold cursor-pointer"
                style={{ color: "#334155" }}>
                <item.icon size={15} strokeWidth={1.9} style={{ color: "#64748B" }} />
                {item.label}
                {open[item.label] ? <ChevronDown size={13} className="ml-auto" /> : <ChevronRight size={13} className="ml-auto" />}
              </button>
              {open[item.label] && <div className="space-y-0.5">{item.children.map((c) => <NavBtn key={c.href} item={c} child />)}</div>}
            </div>
          ) : (
            <NavBtn key={item.label} item={item} />
          )
        )}
      </nav>
      <div className="m-2 rounded-xl p-3 shrink-0" style={{ background: "#EEF2FF", border: "1px solid #DDD6FE" }}>
        <p className="text-[12px] font-bold" style={{ color: "#4338CA" }}>✨ Free for 3 months</p>
        <p className="text-[11px] mt-0.5" style={{ color: "#64748B" }}>Every feature unlocked. See plans →</p>
      </div>
    </div>
  );

  return (
    <div className={`relative w-full overflow-hidden font-display ${full ? "" : "rounded-2xl"}`}
         style={{
           border: full ? "none" : "1px solid #D1D5E0",
           boxShadow: full ? "none" : "0 40px 90px -40px rgba(15,23,42,0.4)",
           height: full ? "100dvh" : "min(820px, 88vh)",
           background: "#F0F2F8",
         }}>
      <style>{`@keyframes demoPulse { 0% { opacity: .9; transform: scale(1);} 100% { opacity: 0; transform: scale(1.08);} } .demo-pulse { animation: demoPulse 1.3s ease-out infinite; }`}</style>

      {/* demo banner */}
      <div className="flex items-center justify-center gap-2 px-3 h-8 text-[11px] font-semibold"
           style={{ background: "#0F172A", color: "white" }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#34D399" }} />
        Live demo · sample company · nothing saves
        <Link href="/signup" className="ml-2 no-underline inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full"
              style={{ background: "white", color: "#0F172A" }}>
          Get your own <ArrowUpRight size={10} />
        </Link>
      </div>

      <div className="flex" style={{ height: "calc(100% - 32px)" }}>
        {/* desktop sidebar */}
        <div className="hidden lg:block w-[220px] shrink-0 h-full">{sidebar}</div>
        {/* mobile drawer */}
        {menu && (
          <>
            <div className="absolute inset-0 z-20 lg:hidden" style={{ background: "rgba(15,23,42,0.4)" }} onClick={() => setMenu(false)} />
            <div className="absolute top-8 bottom-0 left-0 z-30 w-[240px] lg:hidden">{sidebar}</div>
          </>
        )}

        {/* main */}
        <div className="flex-1 min-w-0 flex flex-col h-full">
          {/* topbar */}
          <div className="flex items-center gap-3 px-3 sm:px-5 h-12 shrink-0" style={{ background: "white", borderBottom: "1px solid #E8EAEF" }}>
            <button className="lg:hidden cursor-pointer" onClick={() => setMenu(true)} aria-label="Open menu"><Menu size={18} /></button>
            <div className="flex items-center gap-2 flex-1 max-w-[420px] rounded-xl px-3 h-9"
                 style={{ background: "#F0F2F8", border: "1px solid #E8EAEF", color: "#64748B" }}
                 onClick={() => demoToast("Search works across every module in the real app.")}>
              <Search size={14} /> <span className="text-[12.5px]">Search clients, invoices, projects…</span>
              <span className="ml-auto hidden sm:inline lp-num text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: "white", border: "1px solid #E8EAEF" }}>Ctrl+K</span>
            </div>
            <button className="ml-auto cursor-pointer relative" onClick={() => demoToast()} aria-label="Notifications">
              <Bell size={17} style={{ color: "#64748B" }} />
              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 rounded-full text-[8.5px] font-bold text-white flex items-center justify-center" style={{ background: "#DC2626" }}>9+</span>
            </button>
            <span className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white" style={{ background: "#4F46E5" }}>P</span>
              <span className="hidden sm:inline text-[13px] font-bold" style={{ color: "#0F172A" }}>Priya</span>
            </span>
            <button className="hidden sm:inline text-[12.5px] font-semibold cursor-pointer" style={{ color: "#64748B" }} onClick={() => demoToast()}>Sign Out</button>
          </div>

          {/* screen */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-5" onClickCapture={(e) => {
            const t = e.target as HTMLElement;
            if (t.closest("button, .btn-primary, .btn-outline, .btn-success, .btn-danger-soft") && !t.closest("nav") && !t.closest("[data-tour]") && !t.closest("[aria-label]")) demoToast();
          }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-[18px] sm:text-[20px] font-bold" style={{ color: "#0F172A", letterSpacing: "-0.01em" }}>{screen.title}</h2>
                {screen.sub && <p className="text-[12px] mt-0.5" style={{ color: "#64748B" }}>{screen.sub}</p>}
              </div>
              {screen.cta && (
                <button className="btn-primary cursor-pointer" onClick={() => demoToast()}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 34, padding: "0 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 600 }}>
                  <Plus size={14} /> {screen.cta}
                </button>
              )}
            </div>

            {screen.stats && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mt-3">
                {screen.stats.map(([l, v, c]) => (
                  <div key={l} className="card" style={{ padding: "12px 14px" }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#94A3B8" }}>{l}</p>
                    <p className="lp-num text-[17px] font-bold mt-0.5" style={{ color: c ?? "#0F172A" }}>{v}</p>
                  </div>
                ))}
              </div>
            )}

            {screen.cols && (
              <div className="card tbl-wrap mt-3" style={{ padding: 0 }}>
                <table className="tbl">
                  <thead><tr>
                    <th className="mob-hide" style={{ width: 36 }}><input type="checkbox" readOnly /></th>
                    <th className="mob-hide">#</th>
                    {screen.cols.map((c) => <th key={c}>{c}</th>)}
                    <th>Actions</th>
                  </tr></thead>
                  <tbody>
                    {screen.rows!.map((r, i) => (
                      <tr key={i} className="cursor-pointer" onClick={() => demoToast("Opens the full record in the real app.")}>
                        <td className="mob-hide"><input type="checkbox" readOnly /></td>
                        <td className="mob-hide text-slate-300 font-semibold text-[12px] w-10">{i + 1}</td>
                        {r.map((cell, j) => (
                          <td key={j}>
                            {j === screen.badgeCol ? <StatusBadge status={String(cell)} /> :
                              j === 0 ? <span className="font-bold text-indigo-600 text-[13px]">{cell}</span> :
                              <span className="font-medium text-[13px]">{cell}</span>}
                          </td>
                        ))}
                        <td>
                          <div className="flex items-center gap-0.5" style={{ color: "#64748B" }}>
                            <span className="p-1 rounded hover:bg-slate-100" title="View"><Eye size={14} /></span>
                            <span className="p-1 rounded hover:bg-slate-100" title="Edit"><Edit2 size={14} /></span>
                            <span className="p-1 rounded hover:bg-slate-100 mob-hide" title="Duplicate"><Copy size={14} /></span>
                            <span className="p-1 rounded hover:bg-slate-100 mob-hide" title="Delete" style={{ color: "#DC2626" }}><Trash2 size={14} /></span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {screen.custom}
          </div>
        </div>
      </div>

      {/* toast */}
      {toast && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-4 z-40 px-4 py-2.5 rounded-full text-[12px] font-semibold text-white"
             style={{ background: "#0F172A", boxShadow: "0 10px 30px -10px rgba(15,23,42,0.5)" }}>
          {toast}
        </div>
      )}

      {/* tour card */}
      {step && (
        <div data-tour className="absolute z-40 bottom-4 right-3 left-3 sm:left-auto sm:w-[320px] rounded-xl p-4"
             style={{ background: "#0F172A", color: "white", boxShadow: "0 16px 40px -12px rgba(15,23,42,0.55)" }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#A5B4FC" }}>
            Tour · step {tour + 1} of {TOUR.length}
          </p>
          <p className="mt-1.5 text-[12.5px] leading-snug">{step.text}</p>
          <div className="mt-3 flex items-center justify-between">
            <button onClick={() => setTour(-1)} className="cursor-pointer text-[11px]" style={{ color: "#94A3B8" }}>Skip tour</button>
            <button onClick={() => nav(step.href)}
                    className="cursor-pointer text-[11.5px] font-bold px-3.5 py-1.5 rounded-full"
                    style={{ background: "white", color: "#0F172A" }}>
              {tour + 1 === TOUR.length ? "Finish" : "Take me there"}
            </button>
          </div>
        </div>
      )}
      {!step && tour === -1 && (
        <button onClick={() => { setTour(0); setPath("/"); }}
                className="absolute bottom-4 right-3 z-40 cursor-pointer text-[11px] font-bold px-3.5 py-2 rounded-full"
                style={{ background: "#EEF2FF", color: "#4338CA", border: "1px solid #C7D2FE" }}>
          ↻ Restart tour
        </button>
      )}
    </div>
  );
}
