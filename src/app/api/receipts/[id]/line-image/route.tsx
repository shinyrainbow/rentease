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

export async function GET(request: NextRequest) {
  try {
    // Load Noto Sans Thai font for proper Thai character rendering
    const fontData = await fetch(
      new URL("https://fonts.gstatic.com/s/notosansthai/v25/iJWnBXeUZi_OHPqn4wq6hQ2_hbJ1xyN9wd43SofNWcd1MKVQt_So_9CdU5RspzF-QRvzzXg.ttf")
    ).then((res) => res.arrayBuffer());

    const fontDataBold = await fetch(
      new URL("https://fonts.gstatic.com/s/notosansthai/v25/iJWnBXeUZi_OHPqn4wq6hQ2_hbJ1xyN9wd43SofNWcd1MKVQt_So_9CdU5RtpDF-QRvzzXg.ttf")
    ).then((res) => res.arrayBuffer());

    const { searchParams } = new URL(request.url);

    // Get data from query params (passed by send route)
    const receiptNo = searchParams.get("receiptNo") || "";
    const invoiceNo = searchParams.get("invoiceNo") || "";
    const billingMonth = searchParams.get("billingMonth") || "";
    const issuedAt = searchParams.get("issuedAt") || "";
    const totalAmount = Number(searchParams.get("amount") || 0);
    const unitNumber = searchParams.get("unitNumber") || "";
    const tenantName = searchParams.get("tenantName") || "";
    const tenantAddress = searchParams.get("tenantAddress") || "";
    const tenantTaxId = searchParams.get("tenantTaxId") || "";
    const tenantIdCard = searchParams.get("tenantIdCard") || "";
    const companyName = searchParams.get("companyName") || "";
    const companyNameTh = searchParams.get("companyNameTh") || "";
    const companyAddress = searchParams.get("companyAddress") || "";
    const companyTaxId = searchParams.get("companyTaxId") || "";
    const logoUrl = searchParams.get("logoUrl") || "";
    const ownerName = searchParams.get("ownerName") || "";
    const lang = (searchParams.get("lang") as "en" | "th") || "th";
    const version = (searchParams.get("version") as "original" | "copy") || "original";

    // Additional details
    const subtotal = Number(searchParams.get("subtotal") || 0);
    const withholdingTax = Number(searchParams.get("withholdingTax") || 0);
    const withholdingTaxPercent = Number(searchParams.get("withholdingTaxPercent") || 0);
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

    const thaiMonths = ["มค", "กพ", "มีค", "เมย", "พค", "มิย", "กค", "สค", "กย", "ตค", "พย", "ธค"];
    const engMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const formatDate = (dateStr: string) => {
      if (!dateStr) return "";
      const d = new Date(dateStr);
      const day = d.getDate();
      const month = lang === "th" ? thaiMonths[d.getMonth()] : engMonths[d.getMonth()];
      const year = d.getFullYear();
      return `${day} ${month} ${year}`;
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
            fontFamily: "'Noto Sans Thai', sans-serif",
          }}
        >
          {/* Top accent bar */}
          <div
            style={{
              display: "flex",
              height: "10px",
              backgroundColor: GREEN_COLOR,
            }}
          />

          <div style={{ display: "flex", flexDirection: "column", padding: "48px 64px" }}>
            {/* Header - Company Info & Receipt Title */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "40px" }}>
              {/* Left - Company Info */}
              <div style={{ display: "flex", flexDirection: "column", maxWidth: "55%" }}>
                {/* Logo and Company Name */}
                <div style={{ display: "flex", alignItems: "center", gap: "24px", marginBottom: "16px" }}>
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Logo"
                      width={100}
                      height={100}
                      style={{ objectFit: "contain", borderRadius: "12px", border: "2px solid #E5E7EB" }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100px",
                        height: "100px",
                        backgroundColor: GREEN_COLOR,
                        borderRadius: "16px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#ffffff",
                        fontSize: "44px",
                        fontWeight: "bold",
                      }}
                    >
                      {companyName.charAt(0)}
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: "32px", fontWeight: "bold", color: "#111827" }}>
                      {companyName}
                    </span>
                    {companyNameTh && companyName !== companyNameTh && (
                      <span style={{ fontSize: "22px", color: "#6B7280", marginTop: "4px" }}>
                        {companyNameTh}
                      </span>
                    )}
                  </div>
                </div>
                {/* Company Address */}
                {companyAddress && (
                  <span style={{ fontSize: "18px", color: "#6B7280", marginBottom: "4px", lineHeight: 1.4 }}>
                    {companyAddress}
                  </span>
                )}
                {/* Company Tax ID */}
                {companyTaxId && (
                  <span style={{ fontSize: "18px", color: "#6B7280" }}>
                    {t.taxId}: {companyTaxId}
                  </span>
                )}
              </div>

              {/* Right - Receipt Title & Badge */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "16px" }}>
                  <span style={{ fontSize: "52px", fontWeight: "bold", color: GREEN_COLOR, letterSpacing: "-1px" }}>
                    {t.receipt}
                  </span>
                  <div
                    style={{
                      backgroundColor: version === "original" ? GREEN_COLOR : "#6B7280",
                      color: "#ffffff",
                      padding: "8px 24px",
                      borderRadius: "24px",
                      fontSize: "18px",
                      fontWeight: "bold",
                    }}
                  >
                    {version === "original" ? t.original : t.copy}
                  </div>
                </div>
                {/* Receipt Details */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: "6px",
                  }}
                >
                  <span style={{ fontSize: "22px", color: "#111827", fontWeight: "600" }}>
                    {t.receiptNo}: {receiptNo}
                  </span>
                  <span style={{ fontSize: "18px", color: "#6B7280" }}>
                    {t.dateCreated}: {formatDate(issuedAt)}
                  </span>
                  <span style={{ fontSize: "18px", color: "#6B7280" }}>
                    {t.referenceInvoice}: {invoiceNo}
                  </span>
                  <span style={{ fontSize: "18px", color: "#6B7280" }}>
                    {t.billingMonth}: {billingMonth}
                  </span>
                </div>
              </div>
            </div>

            {/* Received From Section */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                padding: "24px 0",
                marginBottom: "32px",
                borderTop: "2px solid #E5E7EB",
                borderBottom: "2px solid #E5E7EB",
              }}
            >
              <span style={{ fontSize: "16px", fontWeight: "bold", color: GREEN_COLOR, marginBottom: "12px", textTransform: "uppercase", letterSpacing: "1px" }}>
                {t.receivedFrom}
              </span>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: "28px", fontWeight: "bold", color: "#111827" }}>
                    {tenantName}
                  </span>
                  {tenantAddress && (
                    <span style={{ fontSize: "18px", color: "#6B7280", marginTop: "8px" }}>
                      {tenantAddress}
                    </span>
                  )}
                  {tenantTaxId && (
                    <span style={{ fontSize: "18px", color: "#6B7280", marginTop: "6px" }}>
                      {t.taxId}: {tenantTaxId}
                    </span>
                  )}
                  {tenantIdCard && !tenantTaxId && (
                    <span style={{ fontSize: "18px", color: "#6B7280", marginTop: "6px" }}>
                      {t.idCard}: {tenantIdCard}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                  <span style={{ fontSize: "16px", color: "#6B7280", marginBottom: "4px" }}>
                    {t.unit}
                  </span>
                  <span style={{ fontSize: "32px", fontWeight: "bold", color: GREEN_COLOR }}>
                    {unitNumber}
                  </span>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div style={{ display: "flex", flexDirection: "column", marginBottom: "48px" }}>
              {/* Table Header */}
              <div
                style={{
                  display: "flex",
                  backgroundColor: GREEN_COLOR,
                  borderRadius: "8px 8px 0 0",
                  padding: "18px 24px",
                }}
              >
                <div style={{ flex: hasUtilityItems ? 4 : 6, display: "flex" }}>
                  <span style={{ fontSize: "20px", fontWeight: "bold", color: "#ffffff" }}>{t.description}</span>
                </div>
                {hasUtilityItems && (
                  <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
                    <span style={{ fontSize: "20px", fontWeight: "bold", color: "#ffffff" }}>{t.qtyUnit}</span>
                  </div>
                )}
                {hasUtilityItems && (
                  <div style={{ flex: 1.5, display: "flex", justifyContent: "flex-end" }}>
                    <span style={{ fontSize: "20px", fontWeight: "bold", color: "#ffffff" }}>{t.unitPrice}</span>
                  </div>
                )}
                <div style={{ flex: 1.5, display: "flex", justifyContent: "flex-end" }}>
                  <span style={{ fontSize: "20px", fontWeight: "bold", color: "#ffffff" }}>{t.amount}</span>
                </div>
              </div>

              {/* Table Rows */}
              {lineItems.map((item, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    padding: "18px 24px",
                    borderBottom: "1px solid #E5E7EB",
                    borderLeft: "1px solid #E5E7EB",
                    borderRight: "1px solid #E5E7EB",
                    ...(index === lineItems.length - 1 ? { borderRadius: "0 0 8px 8px" } : {}),
                  }}
                >
                  <div style={{ flex: hasUtilityItems ? 4 : 6, display: "flex" }}>
                    <span style={{ fontSize: "20px", color: "#111827" }}>{item.description}</span>
                  </div>
                  {hasUtilityItems && (
                    <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
                      <span style={{ fontSize: "20px", color: "#111827" }}>
                        {item.usage !== undefined ? item.usage : "-"}
                      </span>
                    </div>
                  )}
                  {hasUtilityItems && (
                    <div style={{ flex: 1.5, display: "flex", justifyContent: "flex-end" }}>
                      <span style={{ fontSize: "20px", color: "#111827" }}>
                        {item.usage !== undefined ? formatCurrency(item.rate || item.unitPrice || 0) : "-"}
                      </span>
                    </div>
                  )}
                  <div style={{ flex: 1.5, display: "flex", justifyContent: "flex-end" }}>
                    <span style={{ fontSize: "20px", color: "#111827", fontWeight: "500" }}>{formatCurrency(item.amount)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals Section */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "36px" }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  width: "420px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #E5E7EB" }}>
                  <span style={{ fontSize: "20px", color: "#6B7280" }}>{t.subtotal}</span>
                  <span style={{ fontSize: "20px", color: "#111827", fontWeight: "500" }}>{formatCurrency(subtotal)}</span>
                </div>
                {withholdingTax > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #E5E7EB" }}>
                    <span style={{ fontSize: "20px", color: "#6B7280" }}>{t.withholdingTax} ({withholdingTaxPercent}%)</span>
                    <span style={{ fontSize: "20px", color: "#DC2626", fontWeight: "500" }}>-{formatCurrency(withholdingTax)}</span>
                  </div>
                )}
                {/* Total */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "16px 0",
                    borderBottom: `3px solid ${GREEN_COLOR}`,
                  }}
                >
                  <span style={{ fontSize: "24px", fontWeight: "bold", color: "#111827" }}>{t.total}</span>
                  <span style={{ fontSize: "32px", fontWeight: "bold", color: GREEN_COLOR }}>
                    {formatCurrency(totalAmount)}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer - Bank Info & Signature */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                borderTop: "2px solid #E5E7EB",
                paddingTop: "28px",
                marginTop: "auto",
              }}
            >
              {/* Bank Info */}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "18px", fontWeight: "bold", color: GREEN_COLOR, marginBottom: "12px" }}>
                  {t.paymentInfo}
                </span>
                {bankName && (
                  <div style={{ display: "flex", gap: "8px", marginBottom: "6px" }}>
                    <span style={{ fontSize: "17px", color: "#6B7280" }}>{t.bankName}:</span>
                    <span style={{ fontSize: "17px", color: "#111827", fontWeight: "500" }}>{BANK_NAMES[bankName] || bankName}</span>
                  </div>
                )}
                {bankAccountName && (
                  <div style={{ display: "flex", gap: "8px", marginBottom: "6px" }}>
                    <span style={{ fontSize: "17px", color: "#6B7280" }}>{t.accountName}:</span>
                    <span style={{ fontSize: "17px", color: "#111827", fontWeight: "500" }}>{bankAccountName}</span>
                  </div>
                )}
                {bankAccountNumber && (
                  <div style={{ display: "flex", gap: "8px" }}>
                    <span style={{ fontSize: "17px", color: "#6B7280" }}>{t.accountNumber}:</span>
                    <span style={{ fontSize: "17px", color: "#111827", fontWeight: "600", letterSpacing: "1px" }}>{bankAccountNumber}</span>
                  </div>
                )}
              </div>

              {/* Signature */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "280px" }}>
                <div
                  style={{
                    width: "200px",
                    height: "70px",
                    borderBottom: "2px solid #9CA3AF",
                    display: "flex",
                  }}
                />
                <span style={{ fontSize: "17px", color: "#6B7280", marginTop: "10px" }}>
                  {t.receiver}
                </span>
                {ownerName && (
                  <span style={{ fontSize: "17px", color: "#111827", fontWeight: "600", marginTop: "4px" }}>
                    {ownerName}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 1600,
        fonts: [
          {
            name: "Noto Sans Thai",
            data: fontData,
            weight: 400,
            style: "normal",
          },
          {
            name: "Noto Sans Thai",
            data: fontDataBold,
            weight: 700,
            style: "normal",
          },
        ],
      }
    );
  } catch (error) {
    console.error("Error generating receipt image:", error);
    return new Response("Error generating image", { status: 500 });
  }
}
