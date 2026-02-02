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

export function formatDate(date: Date, locale: string = "th-TH"): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
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
