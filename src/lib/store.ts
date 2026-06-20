import { Client, Quotation, Invoice, PaymentReceipt, CompanySettings, LineItem } from "./types";
import { v4 as uuidv4 } from "uuid";

const STORAGE_KEYS = {
  clients: "qg_clients",
  quotations: "qg_quotations",
  invoices: "qg_invoices",
  paymentReceipts: "qg_payment_receipts",
  settings: "qg_settings",
};

function getFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : fallback;
}

function saveToStorage<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(data));
}

// Date formatting
export function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// Settings
const defaultSettings: CompanySettings = {
  businessName: "", address: "", city: "", state: "", country: "India", pincode: "",
  gstin: "", pan: "", email: "", phones: [""], bankName: "", accountName: "",
  accountNumber: "", ifsc: "", accountType: "Current", logoUrl: "",
  themeColor: "#7c3aed", contactFooter: "", documentFooter: "This is an electronically generated document, no signature is required.", website: "",
  quotationPrefix: "Q", invoicePrefix: "INV", receiptPrefix: "PR", voucherPrefix: "VCH",
  nextQuotationNo: 1, nextInvoiceNo: 1, nextReceiptNo: 1, nextVoucherNo: 1, nextEmployeeNo: 1,
  creditNotePrefix: "CN", nextCreditNoteNo: 1,
  gstEnabled: true,
  fiscalYearStart: 4,
  checkedByName: "", checkedBySig: "", approvedByName: "", approvedBySig: "", paidByName: "", paidBySig: "",
};

export function getSettings(): CompanySettings {
  const s = getFromStorage<CompanySettings>(STORAGE_KEYS.settings, defaultSettings);
  return { ...defaultSettings, ...s };
}

export function saveSettings(settings: CompanySettings): void {
  saveToStorage(STORAGE_KEYS.settings, settings);
}

function getNextDocNumber(type: "quotation" | "invoice" | "receipt"): string {
  const s = getSettings();
  let prefix = "", num = 1;
  if (type === "quotation") { prefix = s.quotationPrefix; num = s.nextQuotationNo; }
  else if (type === "invoice") { prefix = s.invoicePrefix; num = s.nextInvoiceNo; }
  else { prefix = s.receiptPrefix; num = s.nextReceiptNo; }
  const docNo = `${prefix}${String(num).padStart(5, "0")}`;
  if (type === "quotation") s.nextQuotationNo = num + 1;
  else if (type === "invoice") s.nextInvoiceNo = num + 1;
  else s.nextReceiptNo = num + 1;
  saveSettings(s);
  return docNo;
}

// Clients
export function getClients(): Client[] {
  return getFromStorage<Client[]>(STORAGE_KEYS.clients, []).map((c) => ({
    ...c,
    phones: c.phones || (c as unknown as { phone?: string }).phone ? (c.phones || [(c as unknown as { phone?: string }).phone as string]) : [""],
    logoUrl: c.logoUrl || "",
  }));
}

export function getClient(id: string): Client | undefined {
  return getClients().find((c) => c.id === id);
}

export function saveClient(client: Omit<Client, "id" | "createdAt" | "updatedAt">): Client {
  const clients = getClients();
  const newClient: Client = { ...client, id: uuidv4(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  clients.push(newClient);
  saveToStorage(STORAGE_KEYS.clients, clients);
  return newClient;
}

export function updateClient(id: string, data: Partial<Client>): Client | undefined {
  const clients = getClients();
  const index = clients.findIndex((c) => c.id === id);
  if (index === -1) return undefined;
  clients[index] = { ...clients[index], ...data, updatedAt: new Date().toISOString() };
  saveToStorage(STORAGE_KEYS.clients, clients);
  return clients[index];
}

export function deleteClient(id: string): void {
  saveToStorage(STORAGE_KEYS.clients, getClients().filter((c) => c.id !== id));
}

// Quotations
export function getQuotations(): Quotation[] {
  return getFromStorage<Quotation[]>(STORAGE_KEYS.quotations, []).map((q) => ({
    ...q, totalDiscount: q.totalDiscount || 0, additionalCharges: q.additionalCharges || 0,
    additionalChargesLabel: q.additionalChargesLabel || "", roundOff: q.roundOff || 0,
  }));
}
export function getQuotation(id: string): Quotation | undefined { return getQuotations().find((q) => q.id === id); }

export function saveQuotation(quotation: Omit<Quotation, "id" | "createdAt" | "updatedAt"> & { quotationNo?: string }): Quotation {
  const quotations = getQuotations();
  const newQ: Quotation = {
    ...quotation, id: uuidv4(),
    quotationNo: quotation.quotationNo || getNextDocNumber("quotation"),
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  quotations.push(newQ);
  saveToStorage(STORAGE_KEYS.quotations, quotations);
  return newQ;
}

export function updateQuotation(id: string, data: Partial<Quotation>): Quotation | undefined {
  const quotations = getQuotations();
  const index = quotations.findIndex((q) => q.id === id);
  if (index === -1) return undefined;
  quotations[index] = { ...quotations[index], ...data, updatedAt: new Date().toISOString() };
  saveToStorage(STORAGE_KEYS.quotations, quotations);
  return quotations[index];
}

export function deleteQuotation(id: string): void {
  saveToStorage(STORAGE_KEYS.quotations, getQuotations().filter((q) => q.id !== id));
}

// Invoices
export function getInvoices(): Invoice[] {
  return getFromStorage<Invoice[]>(STORAGE_KEYS.invoices, []).map((i) => ({
    ...i, totalDiscount: i.totalDiscount || 0, additionalCharges: i.additionalCharges || 0,
    additionalChargesLabel: i.additionalChargesLabel || "", roundOff: i.roundOff || 0,
  }));
}
export function getInvoice(id: string): Invoice | undefined { return getInvoices().find((i) => i.id === id); }

export function saveInvoice(invoice: Omit<Invoice, "id" | "createdAt" | "updatedAt"> & { invoiceNo?: string }): Invoice {
  const invoices = getInvoices();
  const newI: Invoice = {
    ...invoice, id: uuidv4(),
    invoiceNo: invoice.invoiceNo || getNextDocNumber("invoice"),
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  invoices.push(newI);
  saveToStorage(STORAGE_KEYS.invoices, invoices);
  return newI;
}

export function updateInvoice(id: string, data: Partial<Invoice>): Invoice | undefined {
  const invoices = getInvoices();
  const index = invoices.findIndex((i) => i.id === id);
  if (index === -1) return undefined;
  invoices[index] = { ...invoices[index], ...data, updatedAt: new Date().toISOString() };
  saveToStorage(STORAGE_KEYS.invoices, invoices);
  return invoices[index];
}

export function deleteInvoice(id: string): void {
  saveToStorage(STORAGE_KEYS.invoices, getInvoices().filter((i) => i.id !== id));
}

// Payment Receipts
export function getPaymentReceipts(): PaymentReceipt[] {
  return getFromStorage<PaymentReceipt[]>(STORAGE_KEYS.paymentReceipts, []);
}
export function getPaymentReceipt(id: string): PaymentReceipt | undefined { return getPaymentReceipts().find((p) => p.id === id); }

export function savePaymentReceipt(receipt: Omit<PaymentReceipt, "id" | "receiptNo" | "createdAt" | "updatedAt">): PaymentReceipt {
  const receipts = getPaymentReceipts();
  const newR: PaymentReceipt = {
    ...receipt, id: uuidv4(), receiptNo: getNextDocNumber("receipt"),
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  receipts.push(newR);
  saveToStorage(STORAGE_KEYS.paymentReceipts, receipts);
  return newR;
}

export function updatePaymentReceipt(id: string, data: Partial<PaymentReceipt>): PaymentReceipt | undefined {
  const receipts = getPaymentReceipts();
  const index = receipts.findIndex((p) => p.id === id);
  if (index === -1) return undefined;
  receipts[index] = { ...receipts[index], ...data, updatedAt: new Date().toISOString() };
  saveToStorage(STORAGE_KEYS.paymentReceipts, receipts);
  return receipts[index];
}

export function deletePaymentReceipt(id: string): void {
  saveToStorage(STORAGE_KEYS.paymentReceipts, getPaymentReceipts().filter((p) => p.id !== id));
}

// Auto-generate receipt when invoice marked Paid
export function markInvoicePaid(invoiceId: string, paymentMethod: string = "Bank Transfer"): PaymentReceipt | undefined {
  const inv = getInvoice(invoiceId);
  if (!inv) return undefined;
  updateInvoice(invoiceId, { status: "Paid", paymentDate: new Date().toISOString().split("T")[0] });
  const existing = getPaymentReceipts().find((r) => r.invoiceId === invoiceId);
  if (existing) return existing;
  return savePaymentReceipt({
    receiptDate: new Date().toISOString().split("T")[0],
    invoiceId, invoiceNo: inv.invoiceNo,
    clientId: inv.clientId, clientName: inv.clientName,
    amount: inv.totalAmount, paymentMethod,
    referenceNo: "", notes: "Auto-generated on payment", status: "Settled",
  });
}

// Utility
export function createEmptyLineItem(): LineItem {
  return {
    id: uuidv4(), itemName: "", description: "", hsnSac: "", gstRate: 0,
    quantity: 1, rate: 0, discountType: "percent", discountValue: 0, discountAmount: 0,
    amount: 0, cgst: 0, sgst: 0, igst: 0, total: 0,
  };
}

export function calculateLineItem(item: LineItem, isInterState: boolean = false): LineItem {
  const grossAmount = item.quantity * item.rate;
  let discountAmount = 0;
  if (item.discountType === "percent") {
    discountAmount = (grossAmount * item.discountValue) / 100;
  } else {
    discountAmount = item.discountValue;
  }
  const amount = grossAmount - discountAmount;
  const gstAmount = (amount * item.gstRate) / 100;
  let cgst = 0, sgst = 0, igst = 0;
  if (isInterState) {
    igst = gstAmount;
  } else {
    cgst = gstAmount / 2;
    sgst = gstAmount / 2;
  }
  return { ...item, discountAmount, amount, cgst, sgst, igst, total: amount + gstAmount };
}

export function calculateTotals(items: LineItem[], additionalCharges: number = 0, roundOff: number = 0) {
  const subtotal = items.reduce((s, i) => s + (i.quantity * i.rate), 0);
  const totalDiscount = items.reduce((s, i) => s + i.discountAmount, 0);
  const taxableAmount = items.reduce((s, i) => s + i.amount, 0);
  const totalCgst = items.reduce((s, i) => s + i.cgst, 0);
  const totalSgst = items.reduce((s, i) => s + i.sgst, 0);
  const totalIgst = items.reduce((s, i) => s + i.igst, 0);
  const totalAmount = taxableAmount + totalCgst + totalSgst + totalIgst + additionalCharges + roundOff;
  return { subtotal, totalDiscount, totalCgst, totalSgst, totalIgst, totalAmount };
}

export function roundTotal(amount: number, direction: "up" | "down"): number {
  const rounded = direction === "up" ? Math.ceil(amount) : Math.floor(amount);
  return +(rounded - amount).toFixed(2);
}

export function numberToWords(num: number): string {
  if (num === 0) return "Zero Only";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function convertGroup(n: number): string {
    if (n === 0) return "";
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
    return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " and " + convertGroup(n % 100) : "");
  }

  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);
  let result = "";
  if (rupees >= 10000000) {
    result += convertGroup(Math.floor(rupees / 10000000)) + " Crore ";
    const rem = rupees % 10000000;
    if (rem >= 100000) result += convertGroup(Math.floor(rem / 100000)) + " Lakh ";
    const rem2 = rem % 100000;
    if (rem2 >= 1000) result += convertGroup(Math.floor(rem2 / 1000)) + " Thousand ";
    if (rem2 % 1000 > 0) result += convertGroup(rem2 % 1000);
  } else if (rupees >= 100000) {
    result += convertGroup(Math.floor(rupees / 100000)) + " Lakh ";
    const rem = rupees % 100000;
    if (rem >= 1000) result += convertGroup(Math.floor(rem / 1000)) + " Thousand ";
    if (rem % 1000 > 0) result += convertGroup(rem % 1000);
  } else {
    if (rupees >= 1000) {
      result += convertGroup(Math.floor(rupees / 1000)) + " Thousand ";
      if (rupees % 1000 > 0) result += convertGroup(rupees % 1000);
    } else {
      result = convertGroup(rupees);
    }
  }
  result = result.trim() + " Rupees";
  if (paise > 0) result += " and " + convertGroup(paise) + " Paise";
  return result.trim() + " Only";
}
