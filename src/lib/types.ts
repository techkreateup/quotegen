export interface Client {
  id: string;
  businessName: string;
  industry: string;
  country: string;
  state: string;
  city: string;
  phones: string[];
  email: string;
  gstin: string;
  pan: string;
  status: "Active" | "Inactive" | "At Risk";
  address: string;
  currency?: string;
  logoUrl: string;
  defaultCc?: string;
  defaultBcc?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LineItem {
  id: string;
  itemName: string;
  description: string;
  hsnSac: string;
  gstRate: number;
  quantity: number;
  rate: number;
  discountType: "fixed" | "percent";
  discountValue: number;
  discountAmount: number;
  amount: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

export interface RelatedDoc { kind: string; label: string; no: string; href: string; status: string; }
export interface DocumentLineageData { source: RelatedDoc[]; children: RelatedDoc[]; }

export interface Quotation {
  id: string;
  quotationNo: string;
  docType?: string; // "Quotation" | "Proforma"
  related?: DocumentLineageData;
  title: string;
  quotationDate: string;
  dueDate: string;
  clientId: string;
  clientName: string;
  items: LineItem[];
  subtotal: number;
  totalDiscount: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  additionalCharges: number;
  additionalChargesLabel: string;
  roundOff: number;
  totalAmount: number;
  currency?: string;
  exchangeRate?: number;
  status: "Draft" | "Created" | "Sent" | "Won" | "Lost" | "Cancelled";
  notes: string;
  termsAndConditions: string;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  related?: DocumentLineageData;
  salesOrderId?: string | null;
  deliveryChallanId?: string | null;
  title: string;
  invoiceDate: string;
  dueDate: string;
  clientId: string;
  clientName: string;
  items: LineItem[];
  subtotal: number;
  totalDiscount: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  additionalCharges: number;
  additionalChargesLabel: string;
  roundOff: number;
  totalAmount: number;
  currency?: string;
  exchangeRate?: number;
  status: "Draft" | "Unpaid" | "Paid" | "PartiallyPaid" | "Overdue" | "Cancelled";
  paymentDate: string;
  quotationId: string;
  notes: string;
  termsAndConditions: string;
  createdAt: string;
  updatedAt: string;
}

export interface SalesOrder {
  id: string;
  salesOrderNo: string;
  related?: DocumentLineageData;
  title: string;
  orderDate: string;
  dueDate: string;
  clientId: string;
  clientName: string;
  quotationId?: string | null;
  clientPoNumber: string;
  clientPoDate: string;
  clientPoFileUrl: string;
  items: LineItem[];
  subtotal: number;
  totalDiscount: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  additionalCharges: number;
  additionalChargesLabel: string;
  roundOff: number;
  totalAmount: number;
  currency?: string;
  exchangeRate?: number;
  status: "Draft" | "Open" | "PartiallyDelivered" | "Delivered" | "Invoiced" | "Closed" | "Cancelled" | "PendingApproval";
  notes: string;
  termsAndConditions: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryChallan {
  id: string;
  challanNo: string;
  related?: DocumentLineageData;
  title: string;
  challanDate: string;
  clientId: string;
  clientName: string;
  salesOrderId?: string | null;
  challanType: string;
  vehicleNo: string;
  items: LineItem[];
  subtotal: number;
  totalDiscount: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  additionalCharges: number;
  additionalChargesLabel: string;
  roundOff: number;
  totalAmount: number;
  currency?: string;
  exchangeRate?: number;
  status: "Draft" | "Issued" | "Delivered" | "Invoiced" | "Cancelled";
  notes: string;
  termsAndConditions: string;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrder {
  id: string;
  purchaseOrderNo: string;
  related?: DocumentLineageData;
  title: string;
  orderDate: string;
  expectedDate: string;
  vendorId: string;
  vendorName?: string;
  items: LineItem[];
  subtotal: number;
  totalDiscount: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  additionalCharges: number;
  additionalChargesLabel: string;
  roundOff: number;
  totalAmount: number;
  currency?: string;
  exchangeRate?: number;
  status: "Draft" | "Issued" | "PartiallyReceived" | "Received" | "Billed" | "Closed" | "Cancelled" | "PendingApproval";
  notes: string;
  termsAndConditions: string;
  createdAt: string;
  updatedAt: string;
}

export interface DebitNote {
  id: string;
  debitNoteNo: string;
  related?: DocumentLineageData;
  debitNoteDate: string;
  vendorId: string;
  vendorName?: string;
  purchaseBillId?: string | null;
  reason: string;
  items: LineItem[];
  subtotal: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalAmount: number;
  status: "Draft" | "Issued" | "Cancelled";
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoodsReceiptNote {
  id: string;
  grnNo: string;
  related?: DocumentLineageData;
  title: string;
  receiptDate: string;
  vendorId: string;
  vendorName?: string;
  purchaseOrderId?: string | null;
  vehicleNo: string;
  items: LineItem[];
  subtotal: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalAmount: number;
  status: "Draft" | "Posted" | "Cancelled";
  notes: string;
  termsAndConditions: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentReceipt {
  id: string;
  receiptNo: string;
  receiptDate: string;
  invoiceId: string;
  invoiceNo: string;
  clientId: string;
  clientName: string;
  amount: number;
  paymentMethod: string;
  referenceNo: string;
  status: "Settled" | "Pending";
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompanySettings {
  businessName: string;
  address: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  gstin: string;
  pan: string;
  email: string;
  phones: string[];
  bankName: string;
  accountName: string;
  accountNumber: string;
  ifsc: string;
  accountType: string;
  logoUrl: string;
  themeColor: string;
  contactFooter: string;
  documentFooter: string;
  website: string;
  quotationPrefix: string;
  invoicePrefix: string;
  receiptPrefix: string;
  voucherPrefix: string;
  nextQuotationNo: number;
  nextInvoiceNo: number;
  nextReceiptNo: number;
  nextVoucherNo: number;
  nextEmployeeNo: number;
  creditNotePrefix: string;
  nextCreditNoteNo: number;
  proformaPrefix?: string;
  nextProformaNo?: number;
  salesOrderPrefix?: string;
  nextSalesOrderNo?: number;
  challanPrefix?: string;
  nextChallanNo?: number;
  poPrefix?: string;
  nextPoNo?: number;
  grnPrefix?: string;
  nextGrnNo?: number;
  debitNotePrefix?: string;
  nextDebitNoteNo?: number;
  matchTolerancePct?: number;
  nonGstInvoicePrefix?: string;
  nextNonGstInvoiceNo?: number;
  separateGstInvoices?: boolean;
  gstEnabled: boolean;
  fiscalYearStart: number;
  checkedByName: string;
  checkedBySig: string;
  checkedByRole: string;
  approvedByName: string;
  approvedBySig: string;
  approvedByRole: string;
  paidByName: string;
  paidBySig: string;
  paidByRole: string;
  defaultCurrency?: string;
}

export interface Employee {
  id: string;
  employeeCode: string;
  name: string;
  email: string;
  phone: string;
  designation: string;
  department: string;
  dateOfJoining: string | null;
  salary: number;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  accountName: string;
  signatureUrl: string;
  photoUrl: string;
  status: "Active" | "Inactive";
  emergencyContact: string;
  address: string;
  pan: string;
  aadhar: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface SalaryRecord {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  month: number;
  year: number;
  basicSalary: number;
  deductions: number;
  bonuses: number;
  netSalary: number;
  paymentDate: string | null;
  paymentMode: string;
  status: "Pending" | "Processing" | "Paid";
  notes: string;
  voucherId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentVoucher {
  id: string;
  voucherNo: string;
  voucherDate: string;
  salaryRecordId: string | null;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  paidTo: string;
  amount: number;
  amountInWords: string;
  description: string;
  paymentMethod: string;
  checkedByName: string;
  checkedBySig: string;
  approvedByName: string;
  approvedBySig: string;
  paidByName: string;
  paidBySig: string;
  receivedByName: string;
  receivedBySig: string;
  isAcknowledged: boolean;
  acknowledgedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── PHASE 3: FINANCE MODULE ─────────────────────────────────────────────────

export interface Subscription {
  id: string;
  name: string;
  vendor: string;
  amount: number;
  billingCycle: "Monthly" | "Quarterly" | "Yearly";
  nextRenewalDate: string;
  status: "Active" | "Cancelled" | "Paused";
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionPayment {
  id: string;
  subscriptionId: string;
  subscriptionName?: string;
  amount: number;
  paidDate: string;
  notes: string;
  createdAt: string;
}

export interface Vendor {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  gstin: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface VendorPayment {
  id: string;
  vendorId: string;
  vendorName?: string;
  amount: number;
  paidDate: string;
  description: string;
  paymentMethod: string;
  notes: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  date: string;
  type: "Revenue" | "Salary" | "Subscription" | "VendorPayment" | "OfficeExpense" | "Miscellaneous";
  category: string;
  description: string;
  amount: number;
  direction: "IN" | "OUT";
  referenceType: string | null;
  referenceId: string | null;
  invoiceId: string | null;
  voucherId: string | null;
  subscriptionPaymentId: string | null;
  vendorPaymentId: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  clientId: string | null;
  clientName?: string;
  type: "ClientWork" | "Internal" | "Other";
  priority: "Low" | "Medium" | "High" | "Urgent";
  deadline: string | null;
  status: "Pending" | "InProgress" | "Completed" | "OnHold" | "Cancelled";
  tags: string[];
  notes: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  tasks?: ProjectTask[];
}

export interface ProjectTask {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: "Todo" | "InProgress" | "Done";
  priority: "Low" | "Medium" | "High" | "Urgent";
  dueDate: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalClients: number;
  totalQuotations: number;
  totalInvoices: number;
  totalRevenue: number;
  unpaidAmount: number;
  paidAmount: number;
  quotationsWon: number;
  quotationsCreated: number;
}

// ─── PHASE 4: PLATFORM INTELLIGENCE ────────────────────────────────────────

export interface Notification {
  id: string;
  userId: string;
  type: "OverdueInvoice" | "DeadlineReminder" | "RenewalReminder" | "SalaryDue" | "VoucherPending" | "General";
  title: string;
  body: string;
  isRead: boolean;
  link: string | null;
  createdAt: string;
}

// ─── PHASE 5: DATA QUALITY & GST COMPLIANCE ────────────────────────────────

export interface CreditNote {
  id: string;
  creditNoteNo: string;
  creditNoteDate: string;
  invoiceId: string | null;
  invoiceNo?: string;
  clientId: string;
  clientName: string;
  items: LineItem[];
  subtotal: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalAmount: number;
  reason: string;
  status: "Draft" | "Issued" | "Cancelled";
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  userName?: string;
  entity: string;
  entityId: string;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
}

// ─── PHASE 6: PRODUCTIVITY & UX ────────────────────────────────────────────

export interface CatalogItem {
  id: string;
  name: string;
  description: string;
  hsnSac: string;
  gstRate: number;
  rate: number;
  unit: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── PHASE 8: PLATFORM INTELLIGENCE ────────────────────────────────────────

export interface EntityActivity {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  description: string;
  metadata: Record<string, unknown> | null;
  userId: string | null;
  createdAt: string;
}

export interface EntityNote {
  id: string;
  entityType: string;
  entityId: string;
  content: string;
  authorId: string | null;
  authorName: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceReminder {
  id: string;
  invoiceId: string;
  invoiceNo?: string;
  clientName?: string;
  amount?: number;
  type: string;
  sentAt: string;
  sentTo: string;
  status: string;
  notes: string;
}

export interface RecurringInvoice {
  id: string;
  clientId: string;
  clientName?: string;
  title: string;
  frequency: "Weekly" | "Monthly" | "Quarterly" | "Yearly";
  nextDueDate: string;
  items: unknown;
  subtotal: number;
  totalAmount: number;
  notes: string;
  termsAndConditions: string;
  isActive: boolean;
  lastGeneratedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
