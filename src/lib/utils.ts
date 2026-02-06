import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, locale: string = "th-TH"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 2,
  }).format(amount);
}

// Thai short month names
const thaiMonths = ["มค", "กพ", "มีค", "เมย", "พค", "มิย", "กค", "สค", "กย", "ตค", "พย", "ธค"];
// English short month names
const engMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Format date as "7 มค 2025" (Thai) or "7 Jan 2025" (English)
export function formatDate(date: Date | string | null | undefined, lang: "th" | "en" = "th"): string {
  if (!date) return "-";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "-";
  const day = d.getDate();
  const month = lang === "th" ? thaiMonths[d.getMonth()] : engMonths[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

// Format date and time as "7 มค 2025 14:30" (Thai) or "7 Jan 2025 14:30" (English)
export function formatDateTime(date: Date | string | null | undefined, lang: "th" | "en" = "th"): string {
  if (!date) return "-";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "-";
  const day = d.getDate();
  const month = lang === "th" ? thaiMonths[d.getMonth()] : engMonths[d.getMonth()];
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year} ${hours}:${minutes}`;
}

export function generateInvoiceNo(projectCode: string, date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `INV-${projectCode}-${year}${month}-${random}`;
}

export function generateReceiptNo(projectCode: string, date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `RCP-${projectCode}-${year}${month}-${random}`;
}

export function calculateWithholdingTax(amount: number, percentage: number): number {
  return (amount * percentage) / 100;
}

export function calculateMeterUsage(previous: number, current: number): number {
  return Math.max(0, current - previous);
}

export function calculateMeterCost(usage: number, rate: number): number {
  return usage * rate;
}
