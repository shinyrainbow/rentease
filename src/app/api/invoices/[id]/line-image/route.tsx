import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

interface LineItem {
  description: string;
  amount: number;
  quantity?: number;
  unitPrice?: number;
  usage?: number;
  rate?: number;
}

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
    paymentInfo: "ข้อมูลการชำระเงิน",
    bankName: "ธนาคาร",
    accountName: "ชื่อบัญชี",
    accountNumber: "เลขที่บัญชี",
    biller: "ผู้วางบิล",
  },
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Get data from query params (passed by send route)
    const invoiceNo = searchParams.get("invoiceNo") || "";
    const billingMonth = searchParams.get("billingMonth") || "";
    const dueDate = searchParams.get("dueDate") || "";
    const dateCreated = searchParams.get("dateCreated") || "";
    const totalAmount = Number(searchParams.get("totalAmount") || 0);
    const unitNumber = searchParams.get("unitNumber") || "";
    const tenantName = searchParams.get("tenantName") || "";
    const tenantAddress = searchParams.get("tenantAddress") || "";
    const tenantTaxId = searchParams.get("tenantTaxId") || "";
    const tenantIdCard = searchParams.get("tenantIdCard") || "";
    const companyName = searchParams.get("companyName") || "";
    const companyNameTh = searchParams.get("companyNameTh") || "";
    const companyAddress = searchParams.get("companyAddress") || "";
    const taxId = searchParams.get("taxId") || "";
    const logoUrl = searchParams.get("logoUrl") || "";
    const ownerName = searchParams.get("ownerName") || "";
    const lang = (searchParams.get("lang") as "en" | "th") || "th";
    const version = (searchParams.get("version") as "original" | "copy") || "original";

    // Additional details
    const subtotal = Number(searchParams.get("subtotal") || 0);
    const withholdingTax = Number(searchParams.get("withholdingTax") || 0);
    const lineItemsStr = searchParams.get("lineItems") || "[]";
    const lineItems: LineItem[] = JSON.parse(lineItemsStr);

    // Check if any line item has usage (utility items)
    const hasUtilityItems = lineItems.some(item => item.usage !== undefined);

    // Bank info
    const bankName = searchParams.get("bankName") || "";
    const bankAccountName = searchParams.get("bankAccountName") || "";
    const bankAccountNumber = searchParams.get("bankAccountNumber") || "";

    const t = translations[lang] || translations.th;

    const formatCurrency = (amount: number) => {
      return amount.toLocaleString(lang === "th" ? "th-TH" : "en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    };

    const formatDate = (dateStr: string) => {
      if (!dateStr) return "";
      return new Date(dateStr).toLocaleDateString(
        lang === "th" ? "th-TH" : "en-US",
        { year: "numeric", month: "short", day: "numeric" }
      );
    };

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
            padding: "32px",
          }}
        >
          {/* Header - Company Info & Invoice Title */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
            {/* Left - Company Info */}
            <div style={{ display: "flex", flexDirection: "column", maxWidth: "50%" }}>
              {/* Logo and Company Name */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Logo"
                    width={48}
                    height={48}
                    style={{ objectFit: "contain", borderRadius: "4px" }}
                  />
                ) : (
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      backgroundColor: TEAL_COLOR,
                      borderRadius: "6px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#ffffff",
                      fontSize: "20px",
                      fontWeight: "bold",
                    }}
                  >
                    {companyName.charAt(0)}
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: "14px", fontWeight: "bold", color: "#111827" }}>
                    {companyName}
                  </span>
                  {companyNameTh && (
                    <span style={{ fontSize: "10px", color: "#6B7280" }}>
                      {companyNameTh}
                    </span>
                  )}
                </div>
              </div>
              {/* Company Address */}
              {companyAddress && (
                <span style={{ fontSize: "9px", color: "#6B7280", marginBottom: "2px" }}>
                  {companyAddress}
                </span>
              )}
              {/* Company Tax ID */}
              {taxId && (
                <span style={{ fontSize: "9px", color: "#6B7280" }}>
                  {t.taxId}: {taxId}
                </span>
              )}
            </div>

            {/* Right - Invoice Title & Badge */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                <span style={{ fontSize: "24px", fontWeight: "bold", color: TEAL_COLOR }}>
                  {t.invoice}
                </span>
                <div
                  style={{
                    backgroundColor: version === "original" ? TEAL_COLOR : "#6B7280",
                    color: "#ffffff",
                    padding: "3px 10px",
                    borderRadius: "4px",
                    fontSize: "10px",
                    fontWeight: "bold",
                  }}
                >
                  {version === "original" ? t.original : t.copy}
                </div>
              </div>
              {/* Invoice Details */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "1px" }}>
                <span style={{ fontSize: "10px", color: "#4B5563" }}>
                  {t.invoiceNo}: <span style={{ fontWeight: "bold" }}>{invoiceNo}</span>
                </span>
                <span style={{ fontSize: "9px", color: "#6B7280" }}>
                  {t.dateCreated}: {formatDate(dateCreated)}
                </span>
                <span style={{ fontSize: "9px", color: "#6B7280" }}>
                  {t.dueDate}: {formatDate(dueDate)}
                </span>
                <span style={{ fontSize: "9px", color: "#6B7280" }}>
                  {t.billingMonth}: {billingMonth}
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
              padding: "12px",
              borderRadius: "6px",
              marginBottom: "16px",
            }}
          >
            <span style={{ fontSize: "10px", fontWeight: "bold", color: TEAL_COLOR, marginBottom: "6px" }}>
              {t.billTo}
            </span>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "12px", fontWeight: "bold", color: "#111827" }}>
                  {tenantName}
                </span>
                {tenantAddress && (
                  <span style={{ fontSize: "9px", color: "#6B7280", marginTop: "2px" }}>
                    {tenantAddress}
                  </span>
                )}
                {tenantTaxId && (
                  <span style={{ fontSize: "9px", color: "#6B7280", marginTop: "2px" }}>
                    {t.taxId}: {tenantTaxId}
                  </span>
                )}
                {tenantIdCard && !tenantTaxId && (
                  <span style={{ fontSize: "9px", color: "#6B7280", marginTop: "2px" }}>
                    {t.idCard}: {tenantIdCard}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <span style={{ fontSize: "10px", color: "#6B7280" }}>
                  {t.unit}: <span style={{ fontWeight: "bold", color: "#111827" }}>{unitNumber}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div style={{ display: "flex", flexDirection: "column", marginBottom: "12px", flex: 1 }}>
            {/* Table Header */}
            <div
              style={{
                display: "flex",
                backgroundColor: TEAL_COLOR,
                borderRadius: "4px 4px 0 0",
                padding: "8px 10px",
              }}
            >
              <div style={{ flex: 4, display: "flex" }}>
                <span style={{ fontSize: "10px", fontWeight: "bold", color: "#ffffff" }}>{t.description}</span>
              </div>
              <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
                <span style={{ fontSize: "10px", fontWeight: "bold", color: "#ffffff" }}>{t.qty}</span>
              </div>
              <div style={{ flex: 1.5, display: "flex", justifyContent: "flex-end" }}>
                <span style={{ fontSize: "10px", fontWeight: "bold", color: "#ffffff" }}>{t.unitPrice}</span>
              </div>
              <div style={{ flex: 1.5, display: "flex", justifyContent: "flex-end" }}>
                <span style={{ fontSize: "10px", fontWeight: "bold", color: "#ffffff" }}>{t.amount}</span>
              </div>
            </div>

            {/* Table Rows */}
            {lineItems.map((item, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  padding: "8px 10px",
                  borderBottom: "1px solid #E5E7EB",
                  backgroundColor: index % 2 === 0 ? "#ffffff" : "#F9FAFB",
                }}
              >
                <div style={{ flex: 4, display: "flex" }}>
                  <span style={{ fontSize: "9px", color: "#111827" }}>{item.description}</span>
                </div>
                <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
                  <span style={{ fontSize: "9px", color: "#111827" }}>
                    {item.quantity || item.usage || 1}
                  </span>
                </div>
                <div style={{ flex: 1.5, display: "flex", justifyContent: "flex-end" }}>
                  <span style={{ fontSize: "9px", color: "#111827" }}>
                    {formatCurrency(item.unitPrice || item.rate || item.amount)}
                  </span>
                </div>
                <div style={{ flex: 1.5, display: "flex", justifyContent: "flex-end" }}>
                  <span style={{ fontSize: "9px", color: "#111827" }}>{formatCurrency(item.amount)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Totals Section */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
            <div style={{ display: "flex", flexDirection: "column", width: "200px", gap: "3px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                <span style={{ fontSize: "10px", color: "#6B7280" }}>{t.subtotal}</span>
                <span style={{ fontSize: "10px", color: "#111827" }}>{formatCurrency(subtotal)}</span>
              </div>
              {withholdingTax > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                  <span style={{ fontSize: "10px", color: "#6B7280" }}>{t.withholdingTax}</span>
                  <span style={{ fontSize: "10px", color: "#DC2626" }}>-{formatCurrency(withholdingTax)}</span>
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "6px 0",
                  borderTop: "2px solid #E5E7EB",
                  marginTop: "3px",
                }}
              >
                <span style={{ fontSize: "12px", fontWeight: "bold", color: "#111827" }}>{t.total}</span>
                <span style={{ fontSize: "12px", fontWeight: "bold", color: TEAL_COLOR }}>
                  ฿{formatCurrency(totalAmount)}
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
              paddingTop: "12px",
            }}
          >
            {/* Bank Info */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "9px", fontWeight: "bold", color: "#4B5563", marginBottom: "3px" }}>
                {t.paymentInfo}
              </span>
              {bankName && (
                <span style={{ fontSize: "8px", color: "#6B7280" }}>
                  {t.bankName}: {BANK_NAMES[bankName] || bankName}
                </span>
              )}
              {bankAccountName && (
                <span style={{ fontSize: "8px", color: "#6B7280" }}>
                  {t.accountName}: {bankAccountName}
                </span>
              )}
              {bankAccountNumber && (
                <span style={{ fontSize: "8px", color: "#6B7280" }}>
                  {t.accountNumber}: {bankAccountNumber}
                </span>
              )}
            </div>

            {/* Signature */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "140px" }}>
              <div
                style={{
                  width: "100px",
                  height: "30px",
                  borderBottom: "1px solid #9CA3AF",
                  display: "flex",
                }}
              />
              <span style={{ fontSize: "8px", color: "#6B7280", marginTop: "3px" }}>
                {t.biller}
              </span>
              {ownerName && (
                <span style={{ fontSize: "8px", color: "#4B5563", fontWeight: "500" }}>
                  ({ownerName})
                </span>
              )}
            </div>
          </div>
        </div>
      ),
      { width: 600, height: 800 }
    );
  } catch (error) {
    console.error("Error generating invoice image:", error);
    return new Response("Error generating image", { status: 500 });
  }
}
