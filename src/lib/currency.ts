export const CURRENCIES = [
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar" },
] as const;

export type CurrencyCode = typeof CURRENCIES[number]["code"];

export function getCurrencySymbol(code: string): string {
  return CURRENCIES.find(c => c.code === code)?.symbol ?? "₹";
}

export function formatCurrency(amount: number, code: string = "INR"): string {
  const symbol = getCurrencySymbol(code);
  if (code === "INR") return symbol + amount.toLocaleString("en-IN");
  return symbol + amount.toLocaleString("en-US", { minimumFractionDigits: 2 });
}
