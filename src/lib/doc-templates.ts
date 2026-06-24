// Premade, professional document templates rendered as branded A4 pages with the
// company letterhead (logo + name + address) and an accent colour. Filled
// client-side and printed to PDF, so they cost zero storage. Placeholders are
// {{key}}; {{company}} / {{companyAddress}} come from company settings.

export interface TemplateField {
  key: string;
  label: string;
  placeholder?: string;
  type?: "text" | "date" | "number" | "textarea";
}

export interface DocTemplate {
  id: string;
  title: string;
  category: string;
  description: string;
  fields: TemplateField[];
  body: string; // HTML with {{placeholders}}
}

export interface Brand {
  name: string;
  logoUrl?: string;
  address?: string;
  website?: string;
  email?: string;
  phone?: string;
  gstin?: string;
  footer?: string;
  accent: string;
  showLogo: boolean;
}

const DATE: TemplateField = { key: "date", label: "Date", type: "date" };
const SIGNATORY: TemplateField[] = [
  { key: "signatory", label: "Signatory name", placeholder: "e.g. Priya Sharma" },
  { key: "designation", label: "Signatory designation", placeholder: "e.g. HR Manager" },
];

const SIGN_BLOCK = `<div style="margin-top:36px">
<p style="margin:0">Yours sincerely,</p>
<p style="margin:28px 0 0;font-weight:700">{{signatory}}</p>
<p style="margin:0;color:#64748b;font-size:12px">{{designation}}, {{company}}</p>
</div>`;

export const DOC_TEMPLATES: DocTemplate[] = [
  {
    id: "offer-letter",
    title: "Offer Letter",
    category: "Onboarding",
    description: "Extend a job offer with role, compensation and joining date.",
    fields: [
      { key: "employee", label: "Candidate name", placeholder: "Full name" },
      { key: "role", label: "Job title", placeholder: "e.g. Software Engineer" },
      { key: "ctc", label: "Annual CTC (₹)", placeholder: "e.g. 6,00,000" },
      { key: "joining", label: "Joining date", type: "date" },
      DATE, ...SIGNATORY,
    ],
    body: `<h1>Letter of Offer</h1>
<p style="color:#64748b;margin-bottom:20px">{{date}}</p>
<p>Dear {{employee}},</p>
<p>We are delighted to offer you the position of <strong>{{role}}</strong> at {{company}}. We were impressed by your background and believe you will be a valuable addition to our team.</p>
<p>Your annual cost to company (CTC) will be <strong>₹{{ctc}}</strong>. Your tentative date of joining is <strong>{{joining}}</strong>. This offer is subject to the verification of your credentials and the company's standard terms of employment.</p>
<p>We look forward to welcoming you aboard. Please sign and return a copy of this letter as a token of your acceptance.</p>
${SIGN_BLOCK}`,
  },
  {
    id: "appointment-letter",
    title: "Appointment Letter",
    category: "HR",
    description: "Confirm appointment and terms after the offer is accepted.",
    fields: [
      { key: "employee", label: "Employee name" },
      { key: "role", label: "Designation" },
      { key: "joining", label: "Date of joining", type: "date" },
      DATE, ...SIGNATORY,
    ],
    body: `<h1>Letter of Appointment</h1>
<p style="color:#64748b;margin-bottom:20px">{{date}}</p>
<p>Dear {{employee}},</p>
<p>With reference to your application and the subsequent interview, we are pleased to appoint you as <strong>{{role}}</strong> at {{company}}, effective <strong>{{joining}}</strong>.</p>
<p>You will be governed by the rules, regulations and policies of the company as amended from time to time. We are confident that your association with us will be long and mutually rewarding.</p>
<p>We welcome you to the {{company}} family.</p>
${SIGN_BLOCK}`,
  },
  {
    id: "nda",
    title: "Non-Disclosure Agreement",
    category: "Legal",
    description: "Protect confidential information shared with an individual.",
    fields: [
      { key: "party", label: "Other party / employee" },
      { key: "purpose", label: "Purpose", placeholder: "e.g. employment, consulting", type: "textarea" },
      DATE,
    ],
    body: `<h1>Non-Disclosure Agreement</h1>
<p>This Non-Disclosure Agreement ("Agreement") is entered into on <strong>{{date}}</strong> between <strong>{{company}}</strong> ("Disclosing Party") and <strong>{{party}}</strong> ("Receiving Party").</p>
<p><strong>1. Confidential Information.</strong> The Receiving Party shall hold in strict confidence all proprietary or confidential information disclosed in connection with {{purpose}}.</p>
<p><strong>2. Obligations.</strong> The Receiving Party shall not use or disclose such information to any third party without the prior written consent of the Disclosing Party.</p>
<p><strong>3. Survival.</strong> These obligations survive the termination of any relationship between the parties.</p>
<div style="display:flex;justify-content:space-between;margin-top:48px">
<div>____________________<br/><span style="font-size:12px;color:#64748b">For {{company}}</span></div>
<div>____________________<br/><span style="font-size:12px;color:#64748b">{{party}}</span></div>
</div>`,
  },
  {
    id: "experience-letter",
    title: "Experience / Relieving Letter",
    category: "HR",
    description: "Certify an employee's tenure and conduct on exit.",
    fields: [
      { key: "employee", label: "Employee name" },
      { key: "role", label: "Last designation" },
      { key: "from", label: "From", type: "date" },
      { key: "to", label: "To", type: "date" },
      DATE, ...SIGNATORY,
    ],
    body: `<h1>Experience Certificate</h1>
<p style="color:#64748b;margin-bottom:20px">{{date}}</p>
<p><strong>To Whom It May Concern</strong></p>
<p>This is to certify that <strong>{{employee}}</strong> was employed with {{company}} as <strong>{{role}}</strong> from <strong>{{from}}</strong> to <strong>{{to}}</strong>.</p>
<p>During this tenure, we found {{employee}} to be sincere, hardworking and professional. Their conduct and performance were satisfactory throughout.</p>
<p>We wish them the very best in their future endeavours.</p>
${SIGN_BLOCK}`,
  },
  {
    id: "warning-letter",
    title: "Warning Letter",
    category: "HR",
    description: "Formally document a performance or conduct issue.",
    fields: [
      { key: "employee", label: "Employee name" },
      { key: "reason", label: "Reason / incident", type: "textarea" },
      DATE, ...SIGNATORY,
    ],
    body: `<h1>Warning Letter</h1>
<p style="color:#64748b;margin-bottom:20px">{{date}}</p>
<p>Dear {{employee}},</p>
<p>This letter serves as a formal warning regarding the following matter: {{reason}}.</p>
<p>Such conduct is not in line with the standards expected at {{company}}. You are advised to take immediate corrective action.</p>
<p>Please treat this as a serious matter. Failure to improve may result in further disciplinary action, up to and including termination of employment.</p>
${SIGN_BLOCK}`,
  },
  {
    id: "salary-slip",
    title: "Salary Slip",
    category: "Payroll",
    description: "Monthly pay statement with earnings and deductions.",
    fields: [
      { key: "employee", label: "Employee name" },
      { key: "empId", label: "Employee ID", placeholder: "optional" },
      { key: "month", label: "Pay period", placeholder: "e.g. June 2026" },
      { key: "gross", label: "Gross earnings (₹)" },
      { key: "deductions", label: "Total deductions (₹)" },
      { key: "net", label: "Net pay (₹)" },
    ],
    body: `<h1>Salary Slip — {{month}}</h1>
<table style="margin-bottom:18px">
<tr><td style="background:#f8fafc;font-weight:600">Employee</td><td>{{employee}}</td><td style="background:#f8fafc;font-weight:600">Employee ID</td><td>{{empId}}</td></tr>
</table>
<table>
<tr><td style="background:#f8fafc;font-weight:600">Gross Earnings</td><td style="text-align:right">₹{{gross}}</td></tr>
<tr><td style="background:#f8fafc;font-weight:600">Total Deductions</td><td style="text-align:right">₹{{deductions}}</td></tr>
<tr><td style="font-weight:800">Net Pay</td><td style="text-align:right;font-weight:800">₹{{net}}</td></tr>
</table>
<p style="margin-top:20px;font-size:11px;color:#94a3b8">This is a computer-generated salary slip and does not require a signature.</p>`,
  },
  {
    id: "internship-certificate", title: "Internship Certificate", category: "HR",
    description: "Certify a completed internship with dates and project.",
    fields: [{ key: "employee", label: "Intern name" }, { key: "role", label: "Internship role" }, { key: "from", label: "From", type: "date" }, { key: "to", label: "To", type: "date" }, DATE, ...SIGNATORY],
    body: `<h1>Internship Certificate</h1><p style="color:#64748b;margin-bottom:20px">{{date}}</p><p><strong>To Whom It May Concern</strong></p>
<p>This is to certify that <strong>{{employee}}</strong> successfully completed an internship as <strong>{{role}}</strong> at {{company}} from <strong>{{from}}</strong> to <strong>{{to}}</strong>.</p>
<p>During the internship, {{employee}} demonstrated commitment, a willingness to learn, and a professional attitude. We wish them success ahead.</p>${SIGN_BLOCK}`,
  },
  {
    id: "promotion-letter", title: "Promotion Letter", category: "HR",
    description: "Announce a promotion with new role and effective date.",
    fields: [{ key: "employee", label: "Employee name" }, { key: "newRole", label: "New designation" }, { key: "effective", label: "Effective date", type: "date" }, DATE, ...SIGNATORY],
    body: `<h1>Letter of Promotion</h1><p style="color:#64748b;margin-bottom:20px">{{date}}</p><p>Dear {{employee}},</p>
<p>In recognition of your performance and contribution, we are pleased to promote you to the position of <strong>{{newRole}}</strong>, effective <strong>{{effective}}</strong>.</p>
<p>We congratulate you and look forward to your continued success at {{company}}.</p>${SIGN_BLOCK}`,
  },
  {
    id: "termination-letter", title: "Termination Letter", category: "HR",
    description: "Formal notice of employment termination.",
    fields: [{ key: "employee", label: "Employee name" }, { key: "role", label: "Designation" }, { key: "lastDay", label: "Last working day", type: "date" }, { key: "reason", label: "Reason", type: "textarea" }, DATE, ...SIGNATORY],
    body: `<h1>Termination of Employment</h1><p style="color:#64748b;margin-bottom:20px">{{date}}</p><p>Dear {{employee}},</p>
<p>This letter confirms the termination of your employment as <strong>{{role}}</strong> with {{company}}, effective <strong>{{lastDay}}</strong>. Reason: {{reason}}.</p>
<p>Please return any company property and complete exit formalities with HR. We wish you well.</p>${SIGN_BLOCK}`,
  },
  {
    id: "employment-verification", title: "Employment Verification", category: "HR",
    description: "Confirm a person's current employment and role.",
    fields: [{ key: "employee", label: "Employee name" }, { key: "role", label: "Designation" }, { key: "since", label: "Employed since", type: "date" }, DATE, ...SIGNATORY],
    body: `<h1>Employment Verification Letter</h1><p style="color:#64748b;margin-bottom:20px">{{date}}</p><p><strong>To Whom It May Concern</strong></p>
<p>This is to confirm that <strong>{{employee}}</strong> is employed at {{company}} as <strong>{{role}}</strong> since <strong>{{since}}</strong>, and remains in active service as of the date of this letter.</p>
<p>This letter is issued upon request for verification purposes.</p>${SIGN_BLOCK}`,
  },
  {
    id: "leave-policy", title: "Leave Policy", category: "HR",
    description: "Summarise the company leave entitlements.",
    fields: [{ key: "casual", label: "Casual leave (days/yr)" }, { key: "sick", label: "Sick leave (days/yr)" }, { key: "earned", label: "Earned leave (days/yr)" }, DATE],
    body: `<h1>Leave Policy</h1><p style="color:#64748b;margin-bottom:20px">Effective {{date}}</p>
<p>{{company}} provides the following annual leave entitlements to eligible employees:</p>
<table><tr><td style="background:#f8fafc;font-weight:600">Casual Leave</td><td>{{casual}} days / year</td></tr>
<tr><td style="background:#f8fafc;font-weight:600">Sick Leave</td><td>{{sick}} days / year</td></tr>
<tr><td style="background:#f8fafc;font-weight:600">Earned Leave</td><td>{{earned}} days / year</td></tr></table>
<p>Leave must be applied for in advance through the prescribed process, except in emergencies. Unused leave is governed by the company handbook.</p>`,
  },
  {
    id: "consultant-agreement", title: "Consultant Agreement", category: "Legal",
    description: "Engagement terms for an independent consultant.",
    fields: [{ key: "party", label: "Consultant name" }, { key: "scope", label: "Scope of work", type: "textarea" }, { key: "fee", label: "Fee (₹)" }, { key: "term", label: "Term" }, DATE],
    body: `<h1>Consulting Agreement</h1><p>This Agreement is made on <strong>{{date}}</strong> between <strong>{{company}}</strong> ("Company") and <strong>{{party}}</strong> ("Consultant").</p>
<p><strong>1. Services.</strong> The Consultant shall provide: {{scope}}.</p>
<p><strong>2. Term.</strong> {{term}}.</p>
<p><strong>3. Fees.</strong> The Company shall pay ₹{{fee}} as agreed. The Consultant is an independent contractor, responsible for their own taxes.</p>
<p><strong>4. Confidentiality.</strong> The Consultant shall keep all Company information confidential.</p>
<div style="display:flex;justify-content:space-between;margin-top:48px"><div>____________________<br/><span style="font-size:12px;color:#64748b">For {{company}}</span></div><div>____________________<br/><span style="font-size:12px;color:#64748b">{{party}}</span></div></div>`,
  },
  {
    id: "purchase-order", title: "Purchase Order", category: "Finance",
    description: "Order goods/services from a vendor.",
    fields: [{ key: "vendor", label: "Vendor name" }, { key: "poNo", label: "PO number" }, { key: "item", label: "Item / description", type: "textarea" }, { key: "qty", label: "Quantity" }, { key: "amount", label: "Amount (₹)" }, DATE],
    body: `<h1>Purchase Order</h1><p>PO No: <strong>{{poNo}}</strong> &nbsp; Date: {{date}}</p><p>To: <strong>{{vendor}}</strong></p>
<p>Please supply the following on behalf of {{company}}:</p>
<table><tr><td style="background:#f8fafc;font-weight:600">Item</td><td>{{item}}</td></tr>
<tr><td style="background:#f8fafc;font-weight:600">Quantity</td><td>{{qty}}</td></tr>
<tr><td style="background:#f8fafc;font-weight:600">Amount</td><td>₹{{amount}}</td></tr></table>
<p>Goods/services are subject to our standard terms. Please confirm acceptance.</p><p style="margin-top:32px">Authorised by,<br/>{{company}}</p>`,
  },
  {
    id: "office-memo", title: "Office Memo / Circular", category: "Other",
    description: "Internal announcement to all staff.",
    fields: [{ key: "subject", label: "Subject" }, { key: "message", label: "Message", type: "textarea" }, DATE],
    body: `<h1>Memorandum</h1><table><tr><td style="background:#f8fafc;font-weight:600;width:90px">Date</td><td>{{date}}</td></tr>
<tr><td style="background:#f8fafc;font-weight:600">From</td><td>{{company}} — Management</td></tr>
<tr><td style="background:#f8fafc;font-weight:600">Subject</td><td>{{subject}}</td></tr></table>
<p style="margin-top:16px">{{message}}</p><p style="margin-top:24px">— Management, {{company}}</p>`,
  },
  {
    id: "meeting-minutes", title: "Meeting Minutes", category: "Other",
    description: "Record decisions and action items from a meeting.",
    fields: [{ key: "title", label: "Meeting title" }, { key: "attendees", label: "Attendees", type: "textarea" }, { key: "notes", label: "Discussion & decisions", type: "textarea" }, DATE],
    body: `<h1>Minutes of Meeting</h1><p><strong>{{title}}</strong> &nbsp;·&nbsp; {{date}}</p>
<p><strong>Attendees:</strong> {{attendees}}</p><p><strong>Discussion & Decisions:</strong></p><p>{{notes}}</p>
<p style="margin-top:24px;font-size:12px;color:#64748b">Recorded for {{company}}.</p>`,
  },
];

export function templateCategories(): string[] {
  return [...new Set(DOC_TEMPLATES.map((t) => t.category))];
}

// Realistic sample values by field key, used to pre-fill the editor so a freshly
// opened template shows a complete-looking document instead of [placeholders].
const SAMPLE_BY_KEY: Record<string, string> = {
  employee: "Priya Sharma", party: "Rahul Mehta", vendor: "Acme Supplies Pvt Ltd",
  role: "Software Engineer", newRole: "Senior Software Engineer",
  ctc: "8,00,000", fee: "1,50,000", amount: "45,000", qty: "10",
  gross: "65,000", deductions: "8,500", net: "56,500",
  month: "June 2026", term: "6 months", empId: "EMP-0007", poNo: "PO-2026-014",
  casual: "12", sick: "8", earned: "15",
  signatory: "Anita Desai", designation: "HR Manager",
  purpose: "the evaluation of a potential business relationship",
  scope: "Advisory services on product strategy and go-to-market planning.",
  reason: "Repeated unauthorised absence from work without prior approval.",
  item: "Wireless keyboards (mechanical)", subject: "Revised Office Timings",
  message: "Effective next Monday, office hours will be 9:30 AM to 6:30 PM.",
  title: "Q3 Product Planning", attendees: "Priya, Rahul, Anita, Karan",
  notes: "Agreed to ship the billing module by end of quarter; Rahul to own QA.",
};

/** Pre-fill values for a template: sample data by key, today's date for dates. */
export function sampleValues(t: DocTemplate): Record<string, string> {
  const today = new Date().toISOString().slice(0, 10);
  const out: Record<string, string> = {};
  for (const f of t.fields) {
    if (f.type === "date") out[f.key] = today;
    else if (SAMPLE_BY_KEY[f.key]) out[f.key] = SAMPLE_BY_KEY[f.key];
    else if (f.key === "from" || f.key === "since") out[f.key] = "2024-04-01";
    else if (f.key === "to" || f.key === "joining" || f.key === "effective" || f.key === "lastDay") out[f.key] = today;
    else out[f.key] = "";
  }
  return out;
}

export function fillTemplate(body: string, values: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, k) =>
    values[k] && values[k].trim() ? values[k] : `<span style="color:#cbd5e1">[${k}]</span>`
  );
}

/** Shared CSS for the rendered document body (preview + print). Sized for a
 * readable A4 letter — larger body text, generous spacing, clear headings. */
export const DOC_CSS = `
.qg-doc{font-family:Georgia,'Times New Roman',serif;color:#1e293b}
.qg-doc .doc-body{line-height:1.85;font-size:15.5px}
.qg-doc .doc-body h1{font-size:26px;margin:0 0 18px;letter-spacing:-0.01em;line-height:1.25}
.qg-doc .doc-body h2{font-size:19px;margin:22px 0 10px;letter-spacing:-0.01em}
.qg-doc .doc-body h3{font-size:16px;margin:18px 0 8px}
.qg-doc .doc-body p{margin:0 0 14px}
.qg-doc .doc-body ul,.qg-doc .doc-body ol{margin:0 0 14px;padding-left:24px}
.qg-doc .doc-body li{margin:0 0 6px}
.qg-doc .doc-body table{width:100%;border-collapse:collapse;margin:14px 0}
.qg-doc .doc-body td{padding:10px 13px;border:1px solid #e2e8f0;font-size:14.5px}
.qg-doc .doc-foot{margin-top:40px;padding-top:14px;border-top:2px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif}
`;

/** A designated signatory rendered (stamped) into the document. */
export interface DocSignatory {
  name: string;
  role: string;
  imageUrl: string;
}

/** Renders a row of stamped signature images (name + role beneath each). */
export function renderSignatories(signatories: DocSignatory[]): string {
  const valid = signatories.filter((s) => s.imageUrl);
  if (valid.length === 0) return "";
  const cells = valid
    .map(
      (s) => `<div style="text-align:center;min-width:160px">
      <img src="${s.imageUrl}" alt="" style="height:56px;max-width:180px;object-fit:contain;display:block;margin:0 auto 4px"/>
      <div style="border-top:1px solid #1e293b;padding-top:4px;font-weight:700;font-size:13px;color:#0f172a">${s.name || ""}</div>
      ${s.role ? `<div style="font-size:11px;color:#64748b">${s.role}</div>` : ""}
    </div>`
    )
    .join("");
  return `<div style="display:flex;flex-wrap:wrap;gap:40px;margin-top:40px">${cells}</div>`;
}

/** Full branded document HTML: letterhead (logo + company) + body. Pass
 * `signatories` to stamp designated signature images at the foot of the page. */
export function renderDocument(t: DocTemplate, values: Record<string, string>, brand: Brand, signatories?: DocSignatory[]): string {
  const body = fillTemplate(t.body, { ...values, company: brand.name, companyAddress: brand.address ?? "" });
  const signBlock = signatories && signatories.length ? renderSignatories(signatories) : "";
  const logo =
    brand.showLogo && brand.logoUrl
      ? `<img src="${brand.logoUrl}" alt="" style="height:58px;max-width:190px;object-fit:contain"/>`
      : `<div style="font-size:23px;font-weight:800;color:${brand.accent}">${brand.name}</div>`;
  return `<div class="qg-doc">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:3px solid ${brand.accent};padding-bottom:16px;margin-bottom:30px">
    <div>${logo}</div>
    <div style="text-align:right;max-width:260px;font-family:Arial,Helvetica,sans-serif">
      <div style="font-size:16px;font-weight:800;color:#0f172a">${brand.name}</div>
      ${brand.address ? `<div style="font-size:11.5px;color:#64748b;line-height:1.5;margin-top:3px">${brand.address}</div>` : ""}
      ${brand.gstin ? `<div style="font-size:11px;color:#64748b;margin-top:2px">GSTIN: ${brand.gstin}</div>` : ""}
      ${brand.website ? `<div style="font-size:11.5px;color:${brand.accent};margin-top:2px">${brand.website}</div>` : ""}
    </div>
  </div>
  <div class="doc-body">${body}</div>
  ${signBlock}
  ${renderDocFooter(brand)}
</div>`;
}

/** Invoice/quote-style footer band: contact line + optional note. */
export function renderDocFooter(brand: Brand): string {
  const contacts = [
    brand.email ? `✉ ${brand.email}` : "",
    brand.phone ? `☎ ${brand.phone}` : "",
    brand.website ? `🌐 ${brand.website}` : "",
    brand.address || "",
  ].filter(Boolean);
  if (contacts.length === 0 && !brand.footer) return "";
  const note = brand.footer || "This is an electronically generated document.";
  return `<div class="doc-foot">
    ${contacts.length ? `<div style="display:flex;flex-wrap:wrap;gap:6px 18px;font-size:11.5px;color:#475569">${contacts.map((c) => `<span>${c}</span>`).join("")}</div>` : ""}
    <div style="font-size:10.5px;color:#94a3b8;margin-top:8px;text-align:center">${note}</div>
  </div>`;
}
