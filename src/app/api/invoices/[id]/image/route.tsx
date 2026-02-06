import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

const translations = {
  en: {
    invoice: "INVOICE",
    original: "Original",
    copy: "Copy",
    invoiceNo: "Invoice No.",
    dateCreated: "Date",
    dueDate: "Due Date",
    billingMonth: "Billing Month",
    taxId: "Tax ID",
    idCard: "ID Card",
    billTo: "Bill To",
    unit: "Unit",
    description: "Description",
    qtyUnit: "Units",
    unitPrice: "Unit Price",
    amount: "Amount",
    subtotal: "Subtotal",
    withholdingTax: "Withholding Tax",
    total: "Total",
    rent: "Monthly Rent",
    commonFee: "Common Fee",
    utility: "Utilities",
    combined: "Rent & Utilities",
    waterUsage: "Water",
    electricityUsage: "Electricity",
    paymentInfo: "Payment Information",
    bankName: "Bank",
    accountName: "Account Name",
    accountNumber: "Account No.",
    biller: "Biller",
  },
  th: {
    invoice: "ใบแจ้งหนี้",
    original: "ต้นฉบับ",
    copy: "สำเนา",
    invoiceNo: "เลขที่",
    dateCreated: "วันที่",
    dueDate: "กำหนดชำระ",
    billingMonth: "รอบบิล",
    taxId: "เลขประจำตัวผู้เสียภาษี",
    idCard: "เลขบัตรประชาชน",
    billTo: "เรียกเก็บจาก",
    unit: "ห้อง/ยูนิต",
    description: "รายการ",
    qtyUnit: "ยูนิต",
    unitPrice: "ราคา/หน่วย",
    amount: "จำนวนเงิน",
    subtotal: "รวม",
    withholdingTax: "หัก ณ ที่จ่าย",
    total: "ยอดรวมทั้งสิ้น",
    rent: "ค่าเช่า",
    commonFee: "ค่าส่วนกลาง",
    utility: "ค่าสาธารณูปโภค",
    combined: "ค่าเช่าและสาธารณูปโภค",
    waterUsage: "ค่าน้ำ",
    electricityUsage: "ค่าไฟ",
    paymentInfo: "ข้อมูลการชำระเงิน",
    bankName: "ธนาคาร",
    accountName: "ชื่อบัญชี",
    accountNumber: "เลขที่บัญชี",
    biller: "ผู้วางบิล",
  },
};

const TEAL_COLOR = "#2D8B8B";

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

    const invoice = await prisma.invoice.findFirst({
      where: { id },
      include: {
        project: {
          include: {
            owner: { select: { name: true } },
          },
        },
        unit: true,
        tenant: true,
      },
    });

    if (!invoice) {
      return new Response("Invoice not found", { status: 404 });
    }

    const formatDate = (date: Date) => {
      return new Date(date).toLocaleDateString(lang === "th" ? "th-TH" : "en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    };

    const formatCurrency = (amount: number) => {
      return amount.toLocaleString(lang === "th" ? "th-TH" : "en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    };

    // Parse line items
    const lineItems = (invoice.lineItems as Array<{
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
    const withholdingTaxAmount = invoice.withholdingTax || 0;

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
          {/* Header - Company Info & Invoice Title */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "24px" }}>
            {/* Left - Company Info */}
            <div style={{ display: "flex", flexDirection: "column", maxWidth: "50%" }}>
              {/* Logo and Company Name */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                {invoice.project.logoUrl ? (
                  <img
                    src={invoice.project.logoUrl}
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
                      backgroundColor: TEAL_COLOR,
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#ffffff",
                      fontSize: "24px",
                      fontWeight: "bold",
                    }}
                  >
                    {(invoice.project.companyName || invoice.project.name).charAt(0)}
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: "18px", fontWeight: "bold", color: "#111827" }}>
                    {invoice.project.companyName || invoice.project.name}
                  </span>
                  {invoice.project.companyNameTh && (
                    <span style={{ fontSize: "12px", color: "#6B7280" }}>
                      {invoice.project.companyNameTh}
                    </span>
                  )}
                </div>
              </div>
              {/* Company Address */}
              {invoice.project.companyAddress && (
                <span style={{ fontSize: "11px", color: "#6B7280", marginBottom: "4px" }}>
                  {invoice.project.companyAddress}
                </span>
              )}
              {/* Company Tax ID */}
              {invoice.project.taxId && (
                <span style={{ fontSize: "11px", color: "#6B7280" }}>
                  {t.taxId}: {invoice.project.taxId}
                </span>
              )}
            </div>

            {/* Right - Invoice Title & Badge */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                <span style={{ fontSize: "32px", fontWeight: "bold", color: TEAL_COLOR }}>
                  {t.invoice}
                </span>
                <div
                  style={{
                    backgroundColor: version === "original" ? TEAL_COLOR : "#6B7280",
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
              {/* Invoice Details */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
                <span style={{ fontSize: "12px", color: "#4B5563" }}>
                  {t.invoiceNo}: <span style={{ fontWeight: "bold" }}>{invoice.invoiceNo}</span>
                </span>
                <span style={{ fontSize: "11px", color: "#6B7280" }}>
                  {t.dateCreated}: {formatDate(invoice.createdAt)}
                </span>
                <span style={{ fontSize: "11px", color: "#6B7280" }}>
                  {t.dueDate}: {formatDate(invoice.dueDate)}
                </span>
                <span style={{ fontSize: "11px", color: "#6B7280" }}>
                  {t.billingMonth}: {invoice.billingMonth}
                </span>
              </div>
            </div>
          </div>

          {/* Bill To Section */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              backgroundColor: "#F9FAFB",
              padding: "16px",
              borderRadius: "8px",
              marginBottom: "20px",
            }}
          >
            <span style={{ fontSize: "12px", fontWeight: "bold", color: TEAL_COLOR, marginBottom: "8px" }}>
              {t.billTo}
            </span>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "14px", fontWeight: "bold", color: "#111827" }}>
                  {lang === "th" && invoice.tenant.nameTh ? invoice.tenant.nameTh : invoice.tenant.name}
                </span>
                {invoice.tenant.address && (
                  <span style={{ fontSize: "11px", color: "#6B7280", marginTop: "2px" }}>
                    {invoice.tenant.address}
                  </span>
                )}
                {invoice.tenant.taxId && (
                  <span style={{ fontSize: "11px", color: "#6B7280", marginTop: "2px" }}>
                    {t.taxId}: {invoice.tenant.taxId}
                  </span>
                )}
                {invoice.tenant.idCard && !invoice.tenant.taxId && (
                  <span style={{ fontSize: "11px", color: "#6B7280", marginTop: "2px" }}>
                    {t.idCard}: {invoice.tenant.idCard}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <span style={{ fontSize: "12px", color: "#6B7280" }}>
                  {t.unit}: <span style={{ fontWeight: "bold", color: "#111827" }}>{invoice.unit.unitNumber}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div style={{ display: "flex", flexDirection: "column", marginBottom: "16px", flex: 1 }}>
            {/* Table Header */}
            <div
              style={{
                display: "flex",
                backgroundColor: TEAL_COLOR,
                borderRadius: "4px 4px 0 0",
                padding: "10px 12px",
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
                  padding: "10px 12px",
                  borderBottom: "1px solid #E5E7EB",
                  backgroundColor: index % 2 === 0 ? "#ffffff" : "#F9FAFB",
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
                <span style={{ fontSize: "12px", color: "#111827" }}>{formatCurrency(invoice.subtotal)}</span>
              </div>
              {withholdingTaxAmount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                  <span style={{ fontSize: "12px", color: "#6B7280" }}>{t.withholdingTax}</span>
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
                <span style={{ fontSize: "14px", fontWeight: "bold", color: TEAL_COLOR }}>
                  ฿{formatCurrency(invoice.totalAmount)}
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
              {invoice.project.bankName && (
                <span style={{ fontSize: "10px", color: "#6B7280" }}>
                  {t.bankName}: {BANK_NAMES[invoice.project.bankName] || invoice.project.bankName}
                </span>
              )}
              {invoice.project.bankAccountName && (
                <span style={{ fontSize: "10px", color: "#6B7280" }}>
                  {t.accountName}: {invoice.project.bankAccountName}
                </span>
              )}
              {invoice.project.bankAccountNumber && (
                <span style={{ fontSize: "10px", color: "#6B7280" }}>
                  {t.accountNumber}: {invoice.project.bankAccountNumber}
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
                {t.biller}
              </span>
              {invoice.project.owner?.name && (
                <span style={{ fontSize: "10px", color: "#4B5563", fontWeight: "500" }}>
                  ({invoice.project.owner.name})
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
    console.error("Error generating invoice image:", error);
    return new Response("Error generating image", { status: 500 });
  }
}
