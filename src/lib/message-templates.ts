// ─── Message template definitions & seeding (Track B / Sprint B2) ────────────
// System (built-in) templates seeded per company on first use, the editable
// column whitelist, and a realistic sample context for the editor's live
// preview. Keep system bodies short, plain, and merge-driven.

export const TEMPLATE_CATEGORIES = ["Sales", "Billing", "Procurement", "HR", "General"] as const;
export const TEMPLATE_CHANNELS = ["EMAIL", "WHATSAPP", "BOTH"] as const;
export const TEMPLATE_ENTITY_TYPES = [
  "", "client", "quotation", "invoice", "purchaseOrder", "vendor", "employee",
] as const;
export const TEMPLATE_ATTACH_KINDS = ["none", "quote", "invoice", "po", "grn", "statement"] as const;

// Columns a user may set/update — never spread the raw body (LEARNING §11.1).
export const TEMPLATE_STRING_FIELDS = [
  "name", "category", "channel", "entityType",
  "toExpr", "ccExpr", "bccExpr", "subject", "body", "attachKind",
] as const;
export const TEMPLATE_BOOL_FIELDS = ["attachPdf", "isActive"] as const;

export interface SystemTemplate {
  key: string; // stable identity for re-seed/upgrade
  name: string;
  category: (typeof TEMPLATE_CATEGORIES)[number];
  channel: (typeof TEMPLATE_CHANNELS)[number];
  entityType: (typeof TEMPLATE_ENTITY_TYPES)[number];
  subject: string;
  body: string; // HTML with {{merge}} vars
  attachPdf: boolean;
  attachKind: (typeof TEMPLATE_ATTACH_KINDS)[number];
}

const sig = `<p>Regards,<br/>{{company.name}}</p>`;

export const SYSTEM_TEMPLATES: SystemTemplate[] = [
  // ── Sales ──
  {
    key: "quote_send", name: "Quotation — Send", category: "Sales", channel: "BOTH",
    entityType: "quotation", attachPdf: true, attachKind: "quote",
    subject: "Quotation {{quotation.number}} from {{company.name}}",
    body: `<p>Hi {{client.name}},</p><p>Please find attached our quotation <b>{{quotation.number}}</b> for <b>{{quotation.total}}</b>, valid till {{quotation.validTill}}.</p><p>You can also view it here: {{link}}</p><p>Happy to answer any questions.</p>${sig}`,
  },
  {
    key: "quote_followup", name: "Quotation — Follow-up", category: "Sales", channel: "BOTH",
    entityType: "quotation", attachPdf: false, attachKind: "none",
    subject: "Following up on quotation {{quotation.number}}",
    body: `<p>Hi {{client.name}},</p><p>Just following up on quotation <b>{{quotation.number}}</b> ({{quotation.total}}) we shared. Do you have any questions, or shall we proceed?</p><p>View it again: {{link}}</p>${sig}`,
  },
  // ── Billing ──
  {
    key: "invoice_send", name: "Invoice — Send", category: "Billing", channel: "BOTH",
    entityType: "invoice", attachPdf: true, attachKind: "invoice",
    subject: "Invoice {{invoice.number}} from {{company.name}}",
    body: `<p>Hi {{client.name}},</p><p>Please find attached invoice <b>{{invoice.number}}</b> for <b>{{invoice.total}}</b>, due on {{invoice.dueDate}}.</p><p>View &amp; pay online: {{link}}</p><p>Thank you for your business.</p>${sig}`,
  },
  {
    key: "dunning_gentle", name: "Payment reminder — Gentle (before/at due)", category: "Billing",
    channel: "BOTH", entityType: "invoice", attachPdf: false, attachKind: "none",
    subject: "Reminder: invoice {{invoice.number}} due {{invoice.dueDate}}",
    body: `<p>Hi {{client.name}},</p><p>A friendly reminder that invoice <b>{{invoice.number}}</b> for <b>{{invoice.balance}}</b> is due on {{invoice.dueDate}}.</p><p>View &amp; pay: {{link}}</p><p>Please ignore this if you've already paid.</p>${sig}`,
  },
  {
    key: "dunning_firm", name: "Payment reminder — Firm (overdue)", category: "Billing",
    channel: "BOTH", entityType: "invoice", attachPdf: false, attachKind: "none",
    subject: "Action required: invoice {{invoice.number}} is overdue",
    body: `<p>Hi {{client.name}},</p><p>Invoice <b>{{invoice.number}}</b> for <b>{{invoice.balance}}</b> was due on {{invoice.dueDate}} and is now overdue. Please arrange payment at your earliest convenience.</p><p>Pay now: {{link}}</p>${sig}`,
  },
  {
    key: "dunning_final", name: "Payment reminder — Final notice", category: "Billing",
    channel: "EMAIL", entityType: "invoice", attachPdf: false, attachKind: "none",
    subject: "Final notice: invoice {{invoice.number}} ({{invoice.balance}})",
    body: `<p>Hi {{client.name}},</p><p>This is a final reminder that invoice <b>{{invoice.number}}</b> for <b>{{invoice.balance}}</b> remains unpaid past its due date of {{invoice.dueDate}}. Kindly clear the balance to avoid further action.</p><p>Pay now: {{link}}</p>${sig}`,
  },
  {
    key: "receipt_thanks", name: "Payment received — Thank you", category: "Billing",
    channel: "BOTH", entityType: "invoice", attachPdf: false, attachKind: "none",
    subject: "Payment received for invoice {{invoice.number}}",
    body: `<p>Hi {{client.name}},</p><p>We've received your payment for invoice <b>{{invoice.number}}</b>. Thank you!</p>${sig}`,
  },
  // ── Procurement ──
  {
    key: "po_send", name: "Purchase Order — Send", category: "Procurement", channel: "EMAIL",
    entityType: "purchaseOrder", attachPdf: true, attachKind: "po",
    subject: "Purchase Order {{po.number}} from {{company.name}}",
    body: `<p>Hi {{vendor.name}},</p><p>Please find attached our purchase order <b>{{po.number}}</b> for <b>{{po.total}}</b>. Kindly confirm acceptance and expected delivery.</p><p>View: {{link}}</p>${sig}`,
  },
  {
    key: "vendor_bill_due", name: "Vendor bill — Payment due reminder", category: "Procurement",
    channel: "EMAIL", entityType: "purchaseOrder", attachPdf: false, attachKind: "none",
    subject: "Payment scheduled: bill {{bill.number}} ({{bill.balance}}) due {{bill.dueDate}}",
    body: `<p>Hi {{vendor.name}},</p><p>This is a heads-up that payment against your bill <b>{{bill.number}}</b> for <b>{{bill.balance}}</b> is scheduled around <b>{{bill.dueDate}}</b>. We'll share the remittance advice once processed.</p>${sig}`,
  },
  {
    key: "vendor_remittance", name: "Vendor — Remittance advice", category: "Procurement",
    channel: "EMAIL", entityType: "vendor", attachPdf: false, attachKind: "none",
    subject: "Payment sent: {{amount}} from {{company.name}}",
    body: `<p>Hi {{vendor.name}},</p><p>This confirms a payment of <b>{{amount}}</b> has been made to your account. Please find the remittance details attached/below.</p>${sig}`,
  },
  // ── HR ──
  {
    key: "hr_doc_share", name: "HR — Document share", category: "HR", channel: "EMAIL",
    entityType: "employee", attachPdf: true, attachKind: "statement",
    subject: "{{company.name}}: your document is ready",
    body: `<p>Hi {{employee.name}},</p><p>Please find your document attached. Reach out to HR if you have any questions.</p>${sig}`,
  },
];

/** Realistic context for the editor's live preview (LEARNING §13.3). */
export const SAMPLE_CONTEXT = {
  currency: "INR",
  company: { name: "Acme Solutions Pvt Ltd", email: "accounts@acme.in" },
  client: { name: "Globex Traders", email: "buyer@globex.in" },
  vendor: { name: "Sunrise Supplies", email: "sales@sunrise.in" },
  employee: { name: "Priya Sharma", email: "priya@acme.in" },
  quotation: { number: "Q-0007", total: 84500, validTill: "15 Jul 2026" },
  invoice: { number: "INV-0042", total: 118000, balance: 118000, dueDate: "10 Jul 2026" },
  po: { number: "PO-0011", total: 256000 },
  bill: { number: "BILL-0055", total: 118000, balance: 118000, dueDate: "12 Jul 2026" },
  amount: 256000,
  link: "https://quotegen.kreateup.in/i/abc123",
} as const;
