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
];

export function templateCategories(): string[] {
  return [...new Set(DOC_TEMPLATES.map((t) => t.category))];
}

export function fillTemplate(body: string, values: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, k) =>
    values[k] && values[k].trim() ? values[k] : `<span style="color:#cbd5e1">[${k}]</span>`
  );
}

/** Shared CSS for the rendered document body (preview + print). */
export const DOC_CSS = `
.qg-doc{font-family:Georgia,'Times New Roman',serif;color:#1e293b}
.qg-doc .doc-body{line-height:1.75;font-size:14px}
.qg-doc .doc-body h1{font-size:21px;margin:0 0 14px;letter-spacing:-0.01em}
.qg-doc .doc-body p{margin:0 0 12px}
.qg-doc .doc-body table{width:100%;border-collapse:collapse;margin:10px 0}
.qg-doc .doc-body td{padding:8px 11px;border:1px solid #e2e8f0;font-size:13px}
`;

/** Full branded document HTML: letterhead (logo + company) + body. */
export function renderDocument(t: DocTemplate, values: Record<string, string>, brand: Brand): string {
  const body = fillTemplate(t.body, { ...values, company: brand.name, companyAddress: brand.address ?? "" });
  const logo =
    brand.showLogo && brand.logoUrl
      ? `<img src="${brand.logoUrl}" alt="" style="height:50px;max-width:170px;object-fit:contain"/>`
      : `<div style="font-size:20px;font-weight:800;color:${brand.accent}">${brand.name}</div>`;
  return `<div class="qg-doc">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:3px solid ${brand.accent};padding-bottom:14px;margin-bottom:26px">
    <div>${logo}</div>
    <div style="text-align:right;max-width:240px">
      <div style="font-size:15px;font-weight:800;color:#0f172a">${brand.name}</div>
      ${brand.address ? `<div style="font-size:11px;color:#64748b;line-height:1.5;margin-top:2px">${brand.address}</div>` : ""}
      ${brand.website ? `<div style="font-size:11px;color:${brand.accent};margin-top:2px">${brand.website}</div>` : ""}
    </div>
  </div>
  <div class="doc-body">${body}</div>
</div>`;
}
