// Premade, professional document templates. Rendered client-side (print → PDF),
// so they cost zero storage. Placeholders {{key}} are filled from a small form;
// {{company}} / {{companyAddress}} come from the company's settings.

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
  /** HTML body with {{placeholders}}. */
  body: string;
}

const COMMON_DATE: TemplateField = { key: "date", label: "Date", type: "date" };

export const DOC_TEMPLATES: DocTemplate[] = [
  {
    id: "offer-letter",
    title: "Offer Letter",
    category: "Onboarding",
    description: "Extend a job offer with role, salary and joining date.",
    fields: [
      { key: "employee", label: "Candidate name", placeholder: "Full name" },
      { key: "role", label: "Job title", placeholder: "e.g. Software Engineer" },
      { key: "ctc", label: "Annual CTC (₹)", placeholder: "e.g. 6,00,000" },
      { key: "joining", label: "Joining date", type: "date" },
      COMMON_DATE,
    ],
    body: `<h1>Offer of Employment</h1>
<p>Date: {{date}}</p>
<p>Dear {{employee}},</p>
<p>We are pleased to offer you the position of <strong>{{role}}</strong> at <strong>{{company}}</strong>. Your annual cost to company (CTC) will be <strong>₹{{ctc}}</strong>, and your expected date of joining is <strong>{{joining}}</strong>.</p>
<p>This offer is subject to verification of your documents and our standard terms of employment. We look forward to you joining our team.</p>
<p>Warm regards,<br/>{{company}}</p>`,
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
      COMMON_DATE,
    ],
    body: `<h1>Letter of Appointment</h1>
<p>Date: {{date}}</p>
<p>Dear {{employee}},</p>
<p>With reference to your application and subsequent interview, we are pleased to appoint you as <strong>{{role}}</strong> at <strong>{{company}}</strong> with effect from <strong>{{joining}}</strong>.</p>
<p>You will be governed by the rules, regulations and policies of the company as applicable from time to time. We welcome you and wish you a long and successful association.</p>
<p>For {{company}}</p>`,
  },
  {
    id: "nda",
    title: "Non-Disclosure Agreement",
    category: "Legal",
    description: "Protect confidential information shared with an individual.",
    fields: [
      { key: "party", label: "Other party / employee" },
      { key: "purpose", label: "Purpose", placeholder: "e.g. employment, consulting", type: "textarea" },
      COMMON_DATE,
    ],
    body: `<h1>Non-Disclosure Agreement</h1>
<p>This Agreement is made on {{date}} between <strong>{{company}}</strong> ("Disclosing Party") and <strong>{{party}}</strong> ("Receiving Party").</p>
<p>The Receiving Party agrees to keep confidential all proprietary information disclosed in connection with {{purpose}}, and not to use or disclose such information to any third party without prior written consent.</p>
<p>This obligation survives the termination of any relationship between the parties.</p>
<p>Signed,<br/>{{company}} &nbsp;&nbsp;&nbsp;&nbsp; {{party}}</p>`,
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
      COMMON_DATE,
    ],
    body: `<h1>Experience Certificate</h1>
<p>Date: {{date}}</p>
<p>This is to certify that <strong>{{employee}}</strong> was employed with <strong>{{company}}</strong> as <strong>{{role}}</strong> from <strong>{{from}}</strong> to <strong>{{to}}</strong>.</p>
<p>During the tenure, their conduct and performance were found to be satisfactory. We wish them success in their future endeavours.</p>
<p>For {{company}}</p>`,
  },
  {
    id: "warning-letter",
    title: "Warning Letter",
    category: "HR",
    description: "Formally document a performance or conduct issue.",
    fields: [
      { key: "employee", label: "Employee name" },
      { key: "reason", label: "Reason / incident", type: "textarea" },
      COMMON_DATE,
    ],
    body: `<h1>Warning Letter</h1>
<p>Date: {{date}}</p>
<p>Dear {{employee}},</p>
<p>This letter serves as a formal warning regarding the following: {{reason}}.</p>
<p>You are advised to take immediate corrective action. Failure to improve may lead to further disciplinary measures, up to and including termination.</p>
<p>For {{company}}</p>`,
  },
  {
    id: "salary-slip",
    title: "Salary Slip",
    category: "Payroll",
    description: "Monthly pay statement with earnings and deductions.",
    fields: [
      { key: "employee", label: "Employee name" },
      { key: "month", label: "Pay period", placeholder: "e.g. June 2026" },
      { key: "gross", label: "Gross (₹)" },
      { key: "deductions", label: "Deductions (₹)" },
      { key: "net", label: "Net pay (₹)" },
    ],
    body: `<h1>Salary Slip — {{month}}</h1>
<p><strong>{{company}}</strong></p>
<p>Employee: <strong>{{employee}}</strong></p>
<table style="width:100%;border-collapse:collapse;margin-top:12px">
<tr><td style="padding:6px;border:1px solid #ddd">Gross Earnings</td><td style="padding:6px;border:1px solid #ddd;text-align:right">₹{{gross}}</td></tr>
<tr><td style="padding:6px;border:1px solid #ddd">Total Deductions</td><td style="padding:6px;border:1px solid #ddd;text-align:right">₹{{deductions}}</td></tr>
<tr><td style="padding:6px;border:1px solid #ddd"><strong>Net Pay</strong></td><td style="padding:6px;border:1px solid #ddd;text-align:right"><strong>₹{{net}}</strong></td></tr>
</table>
<p style="margin-top:16px;font-size:12px;color:#666">This is a computer-generated salary slip and does not require a signature.</p>`,
  },
];

export function templateCategories(): string[] {
  return [...new Set(DOC_TEMPLATES.map((t) => t.category))];
}

export function fillTemplate(body: string, values: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, k) => values[k] ?? `<span style="color:#cbd5e1">[${k}]</span>`);
}
