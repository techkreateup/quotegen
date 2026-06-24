import { z } from "zod";
import { emailField, gstinField, phoneField, optionalString } from "./helpers";

export { parse } from "./helpers";

// ─── Client ──────────────────────────────────────────────────────────────────
export const clientSchema = z.object({
  businessName: z.string().min(1, "Business name is required").max(200),
  email: emailField,
  gstin: gstinField,
  city: optionalString(120),
  state: optionalString(120),
}).passthrough();

// Optional date that tolerates "" / null from form inputs (treated as absent).
// z.coerce.date() turns "" into an Invalid Date which fails validation — this
// preprocess avoids the spurious 400 when a date field is left blank.
const optionalDate = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.coerce.date().optional()
);

// ─── Line item (shared by invoice/quotation/credit note) ─────────────────────
// The editor's primary text field is the item NAME; "description" is an optional
// secondary line. The DB column is itemName, so validate that and let an empty
// description through (a blank optional field must not block document creation).
const lineItemSchema = z.object({
  itemName: z.string().min(1, "Item name is required").max(500),
  description: optionalString(1000),
  quantity: z.coerce.number().nonnegative("Quantity must be ≥ 0"),
  rate: z.coerce.number().nonnegative("Rate must be ≥ 0"),
}).passthrough();

// ─── Invoice ─────────────────────────────────────────────────────────────────
export const invoiceSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  items: z.array(lineItemSchema).min(1, "Add at least one line item"),
  invoiceDate: optionalDate,
  dueDate: optionalDate,
}).passthrough();

// ─── Quotation ───────────────────────────────────────────────────────────────
export const quotationSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  items: z.array(lineItemSchema).min(1, "Add at least one line item"),
  quotationDate: optionalDate,
  dueDate: optionalDate,
}).passthrough();

// ─── Credit Note ─────────────────────────────────────────────────────────────
export const creditNoteSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  items: z.array(lineItemSchema).min(1, "Add at least one line item"),
}).passthrough();

// ─── Employee ────────────────────────────────────────────────────────────────
export const employeeSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: emailField,
  phone: phoneField,
  salary: z.coerce.number().nonnegative("Salary must be ≥ 0").optional(),
  designation: optionalString(160),
}).passthrough();

// ─── Vendor ──────────────────────────────────────────────────────────────────
export const vendorSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: emailField,
  phone: phoneField,
  gstin: gstinField,
}).passthrough();

// ─── Salary ──────────────────────────────────────────────────────────────────
export const salarySchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
  basicSalary: z.coerce.number().nonnegative("Must be ≥ 0"),
  deductions: z.coerce.number().nonnegative().optional(),
  bonuses: z.coerce.number().nonnegative().optional(),
}).passthrough();

// ─── Project ─────────────────────────────────────────────────────────────────
export const projectSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  clientId: z.string().optional(),
  deadline: optionalDate,
}).passthrough();

// ─── Catalog item ────────────────────────────────────────────────────────────
export const catalogSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  rate: z.coerce.number().nonnegative("Rate must be ≥ 0").optional(),
  unit: optionalString(40),
}).passthrough();

// ─── Transaction ─────────────────────────────────────────────────────────────
export const transactionSchema = z.object({
  amount: z.coerce.number().positive("Amount must be > 0"),
  type: z.string().min(1).optional(),
}).passthrough();

// ─── Recurring invoice ───────────────────────────────────────────────────────
export const recurringInvoiceSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
}).passthrough();

// ─── Update (PUT/PATCH) variants ─────────────────────────────────────────────
// All fields optional — an update may send only the changed fields. Validation
// still rejects malformed values (bad email/GSTIN/phone, negative amounts, etc.).
export const clientUpdateSchema = clientSchema.partial();
export const invoiceUpdateSchema = invoiceSchema.partial();
export const quotationUpdateSchema = quotationSchema.partial();
export const creditNoteUpdateSchema = creditNoteSchema.partial();
export const employeeUpdateSchema = employeeSchema.partial();
export const vendorUpdateSchema = vendorSchema.partial();
export const salaryUpdateSchema = salarySchema.partial();
export const projectUpdateSchema = projectSchema.partial();
export const catalogUpdateSchema = catalogSchema.partial();
export const transactionUpdateSchema = transactionSchema.partial();
export const recurringInvoiceUpdateSchema = recurringInvoiceSchema.partial();
