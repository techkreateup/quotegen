export const MODULES = [
  "dashboard",
  "clients",
  "quotations",
  "invoices",
  "receipts",
  "credit-notes",
  "catalog",
  "recurring-invoices",
  "reminders",
  "employees",
  "salary",
  "vouchers",
  "vendors",
  "subscriptions",
  "transactions",
  "projects",
  "settings",
  "audit-logs",
  "gst",
  "purchase-bills",
] as const;

export type Module = (typeof MODULES)[number];
export type Action = "view" | "create" | "edit" | "delete";
export type ModulePermissions = Record<Action, boolean>;
export type Permissions = Record<Module, ModulePermissions>;

export const MODULE_CATEGORIES: Record<string, Module[]> = {
  Sales: [
    "dashboard",
    "clients",
    "quotations",
    "invoices",
    "receipts",
    "credit-notes",
    "catalog",
    "recurring-invoices",
    "reminders",
  ],
  "HR & Payroll": ["employees", "salary", "vouchers"],
  Finance: ["transactions", "vendors", "subscriptions", "purchase-bills", "gst"],
  Admin: ["projects", "settings", "audit-logs"],
};

export const MODULE_LABELS: Record<Module, string> = {
  dashboard: "Dashboard",
  clients: "Clients",
  quotations: "Quotations",
  invoices: "Invoices",
  receipts: "Payment Receipts",
  "credit-notes": "Credit Notes",
  catalog: "Catalog",
  "recurring-invoices": "Recurring Invoices",
  reminders: "Reminders",
  employees: "Employees",
  salary: "Salary",
  vouchers: "Vouchers",
  vendors: "Vendors",
  subscriptions: "Subscriptions",
  transactions: "Transactions",
  projects: "Projects",
  settings: "Settings",
  "audit-logs": "Audit Logs",
  gst: "GST",
  "purchase-bills": "Purchase Bills",
};

function allPerms(value: boolean): ModulePermissions {
  return { view: value, create: value, edit: value, delete: value };
}

function viewOnly(): ModulePermissions {
  return { view: true, create: false, edit: false, delete: false };
}

function crudNoDelete(): ModulePermissions {
  return { view: true, create: true, edit: true, delete: false };
}

export function getAdminPermissions(): Permissions {
  return Object.fromEntries(MODULES.map((m) => [m, allPerms(true)])) as Permissions;
}

export function getEmployeePermissions(): Permissions {
  const salesModules: Module[] = [
    "dashboard",
    "clients",
    "quotations",
    "invoices",
    "receipts",
    "credit-notes",
    "catalog",
    "recurring-invoices",
    "reminders",
  ];
  const perms = Object.fromEntries(MODULES.map((m) => [m, allPerms(false)])) as Permissions;
  for (const m of salesModules) {
    perms[m] = crudNoDelete();
  }
  perms.dashboard = viewOnly();
  return perms;
}

export function getEmptyPermissions(): Permissions {
  return Object.fromEntries(MODULES.map((m) => [m, allPerms(false)])) as Permissions;
}

export function hasPermission(
  permissions: Permissions | undefined | null,
  module: Module,
  action: Action
): boolean {
  if (!permissions) return false;
  return permissions[module]?.[action] === true;
}

const PATH_TO_MODULE: Record<string, Module> = {
  "/clients": "clients",
  "/quotations": "quotations",
  "/invoices": "invoices",
  "/payment-receipts": "receipts",
  "/credit-notes": "credit-notes",
  "/catalog": "catalog",
  "/recurring-invoices": "recurring-invoices",
  "/reminders": "reminders",
  "/employees": "employees",
  "/salary": "salary",
  "/vouchers": "vouchers",
  "/vendors": "vendors",
  "/subscriptions": "subscriptions",
  "/transactions": "transactions",
  "/projects": "projects",
  "/settings": "settings",
  "/audit-logs": "audit-logs",
  "/gst-report": "gst",
  "/reports": "invoices",
  "/approvals": "dashboard",
};

const API_PATH_TO_MODULE: Record<string, Module> = {
  "/api/clients": "clients",
  "/api/quotations": "quotations",
  "/api/invoices": "invoices",
  "/api/receipts": "receipts",
  "/api/credit-notes": "credit-notes",
  "/api/catalog": "catalog",
  "/api/recurring-invoices": "recurring-invoices",
  "/api/reminders": "reminders",
  "/api/employees": "employees",
  "/api/salary": "salary",
  "/api/vouchers": "vouchers",
  "/api/vendors": "vendors",
  "/api/subscriptions": "subscriptions",
  "/api/transactions": "transactions",
  "/api/projects": "projects",
  "/api/settings": "settings",
  "/api/audit-logs": "audit-logs",
  "/api/gst-filings": "gst",
  "/api/gst-challans": "gst",
  "/api/gst-report": "gst",
  "/api/purchase-bills": "purchase-bills",
  "/api/dashboard": "dashboard",
  "/api/analytics": "invoices",
  "/api/approvals": "dashboard",
};

export function resolveModuleFromPath(pathname: string): Module | null {
  const map = pathname.startsWith("/api/") ? API_PATH_TO_MODULE : PATH_TO_MODULE;
  const sorted = Object.keys(map).sort((a, b) => b.length - a.length);
  for (const prefix of sorted) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      return map[prefix];
    }
  }
  return null;
}

export function httpMethodToAction(method: string): Action {
  switch (method.toUpperCase()) {
    case "POST":
      return "create";
    case "PUT":
    case "PATCH":
      return "edit";
    case "DELETE":
      return "delete";
    default:
      return "view";
  }
}
