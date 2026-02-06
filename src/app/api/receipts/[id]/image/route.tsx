import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { resolveLogoUrl } from "@/lib/s3";

export const runtime = "nodejs";

const translations = {
  en: {
    receipt: "RECEIPT",
    original: "Original",
    copy: "Copy",
    receiptNo: "Receipt No.",
    dateCreated: "Date",
    referenceInvoice: "Ref. Invoice",
    billingMonth: "Billing Month",
    taxId: "Tax ID",
    idCard: "ID Card",
    receivedFrom: "Received From",
    unit: "Unit",
    description: "Description",
    qtyUnit: "Units",
    unitPrice: "Unit Price",
    amount: "Amount",
    subtotal: "Subtotal",
    withholdingTax: "Withholding Tax",
    total: "Total",
    paymentInfo: "Payment Information",
    bankName: "Bank",
    accountName: "Account Name",
    accountNumber: "Account No.",
    receiver: "Receiver",
  },
  th: {
    receipt: "ใบเสร็จรับเงิน",
    original: "ต้นฉบับ",
    copy: "สำเนา",
    receiptNo: "เลขที่",
    dateCreated: "วันที่",
    referenceInvoice: "อ้างอิงใบแจ้งหนี้",
    billingMonth: "รอบบิล",
    taxId: "เลขประจำตัวผู้เสียภาษี",
    idCard: "เลขบัตรประชาชน",
    receivedFrom: "รับเงินจาก",
    unit: "ห้อง/ยูนิต",
    description: "รายการ",
    qtyUnit: "ยูนิต",
    unitPrice: "ราคา/หน่วย",
    amount: "จำนวนเงิน",
    subtotal: "รวม",
    withholdingTax: "หัก ณ ที่จ่าย",
    total: "ยอดรวมทั้งสิ้น",
    paymentInfo: "ข้อมูลการชำระเงิน",
    bankName: "ธนาคาร",
    accountName: "ชื่อบัญชี",
    accountNumber: "เลขที่บัญชี",
    receiver: "ผู้รับเงิน",
  },
};

const GREEN_COLOR = "#16a34a";

// Bank name mapping
const BANK_NAMES: Record<string, string> = {
  BBL: "Bangkok Bank",
  KBANK: "Kasikorn Bank",
  KTB: "Krungthai Bank",
  SCB: "SCB",
  BAY: "Bank of Ayudhya",
  TMB: "TTB",
  CIMB: "CIMB Thai",
  UOB: "UOB",
  TISCO: "TISCO Bank",
  KKP: "KKP",
  LH: "LH Bank",
  ICBC: "ICBC",
  GSB: "GSB",
  BAAC: "BAAC",
  GHB: "GHB",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const lang = (searchParams.get("lang") as "en" | "th") || "th";
    const version = (searchParams.get("version") as "original" | "copy") || "original";
    const t = translations[lang] || translations.th;

    const receipt = await prisma.receipt.findFirst({
      where: { id },
      include: {
        invoice: {
          include: {
            project: {
              include: {
                owner: { select: { name: true } },
              },
            },
            unit: true,
            tenant: true,
          },
        },
      },
    });

    if (!receipt) {
      return new Response("Receipt not found", { status: 404 });
    }

    const thaiMonths = ["มค", "กพ", "มีค", "เมย", "พค", "มิย", "กค", "สค", "กย", "ตค", "พย", "ธค"];
    const engMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const formatDate = (date: Date) => {
      const d = new Date(date);
      const day = d.getDate();
      const month = lang === "th" ? thaiMonths[d.getMonth()] : engMonths[d.getMonth()];
      const year = d.getFullYear();
      return `${day} ${month} ${year}`;
    };

    const formatCurrency = (amount: number) => {
      return amount.toLocaleString(lang === "th" ? "th-TH" : "en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    };

    // Parse line items from invoice
    const lineItems = (receipt.invoice.lineItems as Array<{
      description: string;
      amount: number;
      quantity?: number;
      unitPrice?: number;
      usage?: number;
      rate?: number;
    }>) || [];

    // Check if any line item has usage (utility items)
    const hasUtilityItems = lineItems.some(item => item.usage !== undefined);

    // Withholding tax
    const withholdingTaxAmount = receipt.invoice.withholdingTax || 0;

    // Resolve logo URL (generate fresh presigned URL if it's an S3 key)
    const logoUrl = await resolveLogoUrl(receipt.invoice.project.logoUrl);

    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            backgroundColor: "#ffffff",
            fontFamily: "sans-serif",
            padding: "40px",
          }}
        >
          {/* Header - Company Info & Receipt Title */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
            {/* Left - Company Info */}
            <div style={{ display: "flex", flexDirection: "column", maxWidth: "50%" }}>
              {/* Logo and Company Name */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Logo"
                    width={60}
                    height={60}
                    style={{ objectFit: "contain", borderRadius: "4px" }}
                  />
                ) : (
                  <div
                    style={{
                      width: "60px",
                      height: "60px",
                      backgroundColor: GREEN_COLOR,
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#ffffff",
                      fontSize: "24px",
                      fontWeight: "bold",
                    }}
                  >
                    {(receipt.invoice.project.companyName || receipt.invoice.project.name).charAt(0)}
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: "18px", fontWeight: "bold", color: "#111827" }}>
                    {receipt.invoice.project.companyName || receipt.invoice.project.name}
                  </span>
                  {receipt.invoice.project.companyNameTh && (
                    <span style={{ fontSize: "12px", color: "#6B7280" }}>
                      {receipt.invoice.project.companyNameTh}
                    </span>
                  )}
                </div>
              </div>
              {/* Company Address */}
              {receipt.invoice.project.companyAddress && (
                <span style={{ fontSize: "11px", color: "#6B7280", marginBottom: "4px" }}>
                  {receipt.invoice.project.companyAddress}
                </span>
              )}
              {/* Company Tax ID */}
              {receipt.invoice.project.taxId && (
                <span style={{ fontSize: "11px", color: "#6B7280" }}>
                  {t.taxId}: {receipt.invoice.project.taxId}
                </span>
              )}
            </div>

            {/* Right - Receipt Title & Badge */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                <span style={{ fontSize: "32px", fontWeight: "bold", color: GREEN_COLOR }}>
                  {t.receipt}
                </span>
                <div
                  style={{
                    backgroundColor: version === "original" ? GREEN_COLOR : "#6B7280",
                    color: "#ffffff",
                    padding: "4px 12px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    fontWeight: "bold",
                  }}
                >
                  {version === "original" ? t.original : t.copy}
                </div>
              </div>
              {/* Receipt Details */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
                <span style={{ fontSize: "12px", color: "#4B5563" }}>
                  {t.receiptNo}: <span style={{ fontWeight: "bold" }}>{receipt.receiptNo}</span>
                </span>
                <span style={{ fontSize: "11px", color: "#6B7280" }}>
                  {t.dateCreated}: {formatDate(receipt.issuedAt)}
                </span>
                <span style={{ fontSize: "11px", color: "#6B7280" }}>
                  {t.referenceInvoice}: {receipt.invoice.invoiceNo}
                </span>
                <span style={{ fontSize: "11px", color: "#6B7280" }}>
                  {t.billingMonth}: {receipt.invoice.billingMonth}
                </span>
              </div>
            </div>
          </div>

          {/* Separator Line */}
          <div
            style={{
              width: "100%",
              height: "1px",
              backgroundColor: "#E5E7EB",
              marginBottom: "20px",
            }}
          />

          {/* Received From Section */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              backgroundColor: "#F0FDF4",
              padding: "16px",
              borderRadius: "8px",
              marginBottom: "20px",
            }}
          >
            <span style={{ fontSize: "12px", fontWeight: "bold", color: GREEN_COLOR, marginBottom: "8px" }}>
              {t.receivedFrom}
            </span>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "14px", fontWeight: "bold", color: "#111827" }}>
                  {lang === "th" && receipt.invoice.tenant.nameTh ? receipt.invoice.tenant.nameTh : receipt.invoice.tenant.name}
                </span>
                {receipt.invoice.tenant.address && (
                  <span style={{ fontSize: "11px", color: "#6B7280", marginTop: "2px" }}>
                    {receipt.invoice.tenant.address}
                  </span>
                )}
                {receipt.invoice.tenant.taxId && (
                  <span style={{ fontSize: "11px", color: "#6B7280", marginTop: "2px" }}>
                    {t.taxId}: {receipt.invoice.tenant.taxId}
                  </span>
                )}
                {receipt.invoice.tenant.idCard && !receipt.invoice.tenant.taxId && (
                  <span style={{ fontSize: "11px", color: "#6B7280", marginTop: "2px" }}>
                    {t.idCard}: {receipt.invoice.tenant.idCard}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <span style={{ fontSize: "12px", color: "#6B7280" }}>
                  {t.unit}: <span style={{ fontWeight: "bold", color: "#111827" }}>{receipt.invoice.unit.unitNumber}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div style={{ display: "flex", flexDirection: "column", marginBottom: "16px" }}>
            {/* Table Header */}
            <div
              style={{
                display: "flex",
                backgroundColor: GREEN_COLOR,
                borderRadius: "4px 4px 0 0",
                padding: "8px 12px",
              }}
            >
              <div style={{ flex: hasUtilityItems ? 4 : 6, display: "flex" }}>
                <span style={{ fontSize: "12px", fontWeight: "bold", color: "#ffffff" }}>{t.description}</span>
              </div>
              {hasUtilityItems && (
                <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
                  <span style={{ fontSize: "12px", fontWeight: "bold", color: "#ffffff" }}>{t.qtyUnit}</span>
                </div>
              )}
              {hasUtilityItems && (
                <div style={{ flex: 1.5, display: "flex", justifyContent: "flex-end" }}>
                  <span style={{ fontSize: "12px", fontWeight: "bold", color: "#ffffff" }}>{t.unitPrice}</span>
                </div>
              )}
              <div style={{ flex: 1.5, display: "flex", justifyContent: "flex-end" }}>
                <span style={{ fontSize: "12px", fontWeight: "bold", color: "#ffffff" }}>{t.amount}</span>
              </div>
            </div>

            {/* Table Rows */}
            {lineItems.map((item, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  padding: "6px 12px",
                  borderBottom: "1px solid #E5E7EB",
                  backgroundColor: index % 2 === 0 ? "#ffffff" : "#F0FDF4",
                }}
              >
                <div style={{ flex: hasUtilityItems ? 4 : 6, display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: "11px", color: "#111827" }}>{item.description}</span>
                </div>
                {hasUtilityItems && (
                  <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
                    <span style={{ fontSize: "11px", color: "#111827" }}>
                      {item.usage !== undefined ? item.usage : "-"}
                    </span>
                  </div>
                )}
                {hasUtilityItems && (
                  <div style={{ flex: 1.5, display: "flex", justifyContent: "flex-end" }}>
                    <span style={{ fontSize: "11px", color: "#111827" }}>
                      {item.usage !== undefined ? formatCurrency(item.rate || item.unitPrice || 0) : "-"}
                    </span>
                  </div>
                )}
                <div style={{ flex: 1.5, display: "flex", justifyContent: "flex-end" }}>
                  <span style={{ fontSize: "11px", color: "#111827" }}>{formatCurrency(item.amount)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Totals Section */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "20px" }}>
            <div style={{ display: "flex", flexDirection: "column", width: "250px", gap: "4px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                <span style={{ fontSize: "12px", color: "#6B7280" }}>{t.subtotal}</span>
                <span style={{ fontSize: "12px", color: "#111827" }}>{formatCurrency(receipt.invoice.subtotal)}</span>
              </div>
              {withholdingTaxAmount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                  <span style={{ fontSize: "12px", color: "#6B7280" }}>{t.withholdingTax} ({Math.round((withholdingTaxAmount / receipt.invoice.subtotal) * 100)}%)</span>
                  <span style={{ fontSize: "12px", color: "#DC2626" }}>-{formatCurrency(withholdingTaxAmount)}</span>
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  borderTop: "2px solid #E5E7EB",
                  marginTop: "4px",
                }}
              >
                <span style={{ fontSize: "14px", fontWeight: "bold", color: "#111827" }}>{t.total}</span>
                <span style={{ fontSize: "14px", fontWeight: "bold", color: GREEN_COLOR }}>
                  ฿{formatCurrency(receipt.amount)}
                </span>
              </div>
            </div>
          </div>

          {/* Footer - Bank Info & Signature */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              borderTop: "1px solid #E5E7EB",
              paddingTop: "16px",
            }}
          >
            {/* Bank Info */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "11px", fontWeight: "bold", color: "#4B5563", marginBottom: "4px" }}>
                {t.paymentInfo}
              </span>
              {receipt.invoice.project.bankName && (
                <span style={{ fontSize: "10px", color: "#6B7280" }}>
                  {t.bankName}: {BANK_NAMES[receipt.invoice.project.bankName] || receipt.invoice.project.bankName}
                </span>
              )}
              {receipt.invoice.project.bankAccountName && (
                <span style={{ fontSize: "10px", color: "#6B7280" }}>
                  {t.accountName}: {receipt.invoice.project.bankAccountName}
                </span>
              )}
              {receipt.invoice.project.bankAccountNumber && (
                <span style={{ fontSize: "10px", color: "#6B7280" }}>
                  {t.accountNumber}: {receipt.invoice.project.bankAccountNumber}
                </span>
              )}
            </div>

            {/* Signature */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "180px" }}>
              <div
                style={{
                  width: "140px",
                  height: "40px",
                  borderBottom: "1px solid #9CA3AF",
                  display: "flex",
                }}
              />
              <span style={{ fontSize: "10px", color: "#6B7280", marginTop: "4px" }}>
                {t.receiver}
              </span>
              {receipt.invoice.project.owner?.name && (
                <span style={{ fontSize: "10px", color: "#4B5563", fontWeight: "500" }}>
                  ({receipt.invoice.project.owner.name})
                </span>
              )}
            </div>
          </div>
        </div>
      ),
      {
        width: 800,
        height: 1000,
      }
    );
  } catch (error) {
    console.error("Error generating receipt image:", error);
    return new Response("Error generating image", { status: 500 });
  }
}
