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

const PRIMARY_COLOR = "#16a34a"; // green-600

const BANK_NAMES: Record<string, string> = {
  kbank: "ธนาคารกสิกรไทย",
  scb: "ธนาคารไทยพาณิชย์",
  bbl: "ธนาคารกรุงเทพ",
  ktb: "ธนาคารกรุงไทย",
  bay: "ธนาคารกรุงศรีอยุธยา",
  ttb: "ธนาคารทหารไทยธนชาต",
  gsb: "ธนาคารออมสิน",
  uob: "ธนาคารยูโอบี",
  cimb: "ธนาคารซีไอเอ็มบี ไทย",
  lhbank: "ธนาคารแลนด์ แอนด์ เฮ้าส์",
  tisco: "ธนาคารทิสโก้",
  kkp: "ธนาคารเกียรตินาคินภัทร",
  icbc: "ธนาคารไอซีบีซี (ไทย)",
  baac: "ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร",
  ghb: "ธนาคารอาคารสงเคราะห์",
};

const translations = {
  en: {
    receipt: "RECEIPT",
    receiptNo: "Receipt No",
    date: "Date",
    invoiceRef: "Ref. Invoice",
    billingMonth: "Billing Month",
    taxId: "Tax ID",
    unit: "Unit",
    name: "Name",
    address: "Address",
    description: "Description",
    amount: "Amount (THB)",
    subtotal: "Subtotal",
    withholdingTax: "Withholding Tax",
    total: "Total",
    thankYou: "Thank you for your payment",
    paymentInfo: "Payment Information",
    bankNameLabel: "Bank",
    accountName: "Account Name",
    accountNumber: "Account Number",
    receiver: "Receiver",
  },
  th: {
    receipt: "ใบเสร็จรับเงิน",
    receiptNo: "เลขที่",
    date: "วันที่",
    invoiceRef: "อ้างอิงใบแจ้งหนี้",
    billingMonth: "รอบบิล",
    taxId: "เลขประจำตัวผู้เสียภาษี",
    unit: "ห้อง",
    name: "ชื่อ",
    address: "ที่อยู่",
    description: "รายการ",
    amount: "จำนวนเงิน (บาท)",
    subtotal: "รวม",
    withholdingTax: "หัก ณ ที่จ่าย",
    total: "ยอดรวมทั้งสิ้น",
    thankYou: "ขอบคุณที่ชำระเงิน",
    paymentInfo: "ข้อมูลการชำระเงิน",
    bankNameLabel: "ธนาคาร",
    accountName: "ชื่อบัญชี",
    accountNumber: "เลขที่บัญชี",
    receiver: "ผู้รับเงิน",
  },
};

export async function GET(request: NextRequest) {
  try {
    // Load THSarabun font for proper Thai character rendering
    let fontData: ArrayBuffer | null = null;
    let fontDataBold: ArrayBuffer | null = null;

    try {
      // Get base URL from request
      const url = new URL(request.url);
      const baseUrl = `${url.protocol}//${url.host}`;

      // Using IBM Plex Sans Thai from our own public folder
      const fontPromise = fetch(
        `${baseUrl}/fonts/IBMPlexSansThai-Regular.ttf`
      ).then((res) => {
        if (!res.ok) throw new Error(`Font fetch failed: ${res.status}`);
        return res.arrayBuffer();
      });

      const fontBoldPromise = fetch(
        `${baseUrl}/fonts/IBMPlexSansThai-Bold.ttf`
      ).then((res) => {
        if (!res.ok) throw new Error(`Font bold fetch failed: ${res.status}`);
        return res.arrayBuffer();
      });

      const results = await Promise.race([
        Promise.all([fontPromise, fontBoldPromise]),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
      ]);

      if (results) {
        [fontData, fontDataBold] = results as [ArrayBuffer, ArrayBuffer];
      }
    } catch (fontError) {
      console.error("Font loading failed:", fontError);
    }

    const { searchParams } = new URL(request.url);

    const receiptNo = searchParams.get("receiptNo") || "";
    const invoiceNo = searchParams.get("invoiceNo") || "";
    const billingMonth = searchParams.get("billingMonth") || "";
    const issuedAt = searchParams.get("issuedAt") || "";
    const totalAmount = Number(searchParams.get("amount") || 0);
    const unitNumber = searchParams.get("unitNumber") || "";
    const tenantName = searchParams.get("tenantName") || "";
    const tenantAddress = searchParams.get("tenantAddress") || "";
    const tenantTaxId = searchParams.get("tenantTaxId") || "";
    const companyName = searchParams.get("companyName") || "";
    const companyAddress = searchParams.get("companyAddress") || "";
    const companyTaxId = searchParams.get("companyTaxId") || "";
    const logoUrl = searchParams.get("logoUrl") || "";
    const lang = (searchParams.get("lang") as "en" | "th") || "th";
    const isCopy = searchParams.get("copy") === "true";

    const subtotal = Number(searchParams.get("subtotal") || 0);
    const withholdingTax = Number(searchParams.get("withholdingTax") || 0);
    const withholdingTaxPercent = Number(searchParams.get("withholdingTaxPercent") || 0);
    const lineItemsStr = searchParams.get("lineItems") || "[]";
    const lineItems: LineItem[] = JSON.parse(lineItemsStr);

    // Payment info
    const bankName = searchParams.get("bankName") || "";
    const bankAccountName = searchParams.get("bankAccountName") || "";
    const bankAccountNumber = searchParams.get("bankAccountNumber") || "";
    const ownerName = searchParams.get("ownerName") || "";

    const displayBankName = bankName ? (BANK_NAMES[bankName] || bankName) : "";

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
            fontFamily: "IBM Plex Sans Thai, sans-serif",
            padding: "60px 80px",
          }}
        >
          {/* Company Header - Logo on Left, Details on Right */}
          <div style={{ display: "flex", alignItems: "flex-start", marginBottom: "40px" }}>
            {logoUrl && (
              <img
                src={logoUrl}
                alt="Logo"
                width={100}
                height={100}
                style={{ objectFit: "contain", borderRadius: "8px", marginRight: "24px" }}
              />
            )}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "15px", fontWeight: "bold", color: "#111827" }}>
                {companyName}
              </span>
              {companyAddress && (
                <span style={{ fontSize: "14px", color: "#6B7280", marginTop: "8px" }}>
                  {companyAddress}
                </span>
              )}
              {companyTaxId && (
                <span style={{ fontSize: "14px", color: "#6B7280", marginTop: "4px" }}>
                  {t.taxId}: {companyTaxId}
                </span>
              )}
            </div>
          </div>

          {/* Separator line */}
          <div style={{ width: "100%", height: "1px", backgroundColor: "#E5E7EB", marginBottom: "24px" }} />

          {/* Receipt Title - Centered */}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "16px", marginBottom: "32px" }}>
            <span style={{ fontSize: "30px", fontWeight: "bold", color: PRIMARY_COLOR }}>
              {t.receipt} {isCopy ? (lang === "th" ? "(สำเนา)" : "(Copy)") : (lang === "th" ? "(ต้นฉบับ)" : "(Original)")}
            </span>
          </div>

          {/* Receipt Details */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontSize: "15px", color: "#111827" }}>{t.receiptNo}: {receiptNo}</span>
            <span style={{ fontSize: "15px", color: "#111827" }}>{t.date}: {formatDate(issuedAt)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "24px" }}>
            <span style={{ fontSize: "15px", color: "#111827" }}>{t.invoiceRef}: {invoiceNo}</span>
            <span style={{ fontSize: "15px", color: "#111827" }}>{t.billingMonth}: {billingMonth}</span>
          </div>

          {/* Received From Section */}
          <div style={{ display: "flex", flexDirection: "column", marginBottom: "32px" }}>
            <div style={{ display: "flex", marginBottom: "4px" }}>
              <span style={{ fontSize: "14px", color: "#6B7280", width: "220px" }}>{t.unit}:</span>
              <span style={{ fontSize: "14px", color: "#111827" }}>{unitNumber}</span>
            </div>
            <div style={{ display: "flex", marginBottom: "4px" }}>
              <span style={{ fontSize: "14px", color: "#6B7280", width: "220px" }}>{t.name}:</span>
              <span style={{ fontSize: "14px", color: "#111827" }}>{tenantName}</span>
            </div>
            {tenantAddress && (
              <div style={{ display: "flex", marginBottom: "4px" }}>
                <span style={{ fontSize: "14px", color: "#6B7280", width: "220px" }}>{t.address}:</span>
                <span style={{ fontSize: "14px", color: "#111827", flex: 1 }}>{tenantAddress}</span>
              </div>
            )}
            {tenantTaxId && (
              <div style={{ display: "flex", marginBottom: "4px" }}>
                <span style={{ fontSize: "14px", color: "#6B7280", width: "220px" }}>{t.taxId}:</span>
                <span style={{ fontSize: "14px", color: "#111827" }}>{tenantTaxId}</span>
              </div>
            )}
          </div>

          {/* Table Header */}
          <div
            style={{
              display: "flex",
              backgroundColor: PRIMARY_COLOR,
              padding: "16px 24px",
              borderRadius: "8px 8px 0 0",
            }}
          >
            <div style={{ flex: 1, display: "flex" }}>
              <span style={{ fontSize: "15px", fontWeight: "bold", color: "#ffffff" }}>{t.description}</span>
            </div>
            <div style={{ width: "200px", display: "flex", justifyContent: "flex-end" }}>
              <span style={{ fontSize: "15px", fontWeight: "bold", color: "#ffffff" }}>{t.amount}</span>
            </div>
          </div>

          {/* Table Rows */}
          {lineItems.map((item, index) => (
            <div
              key={index}
              style={{
                display: "flex",
                padding: "16px 24px",
                backgroundColor: index % 2 === 0 ? "#F9FAFB" : "#ffffff",
                borderLeft: "1px solid #E5E7EB",
                borderRight: "1px solid #E5E7EB",
                borderBottom: "1px solid #E5E7EB",
                ...(index === lineItems.length - 1 ? { borderRadius: "0 0 8px 8px" } : {}),
              }}
            >
              <div style={{ flex: 1, display: "flex" }}>
                <span style={{ fontSize: "15px", color: "#111827" }}>{item.description}</span>
              </div>
              <div style={{ width: "200px", display: "flex", justifyContent: "flex-end" }}>
                <span style={{ fontSize: "15px", color: "#111827" }}>{formatCurrency(item.amount)}</span>
              </div>
            </div>
          ))}

          {/* Totals Section */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", marginTop: "24px" }}>
            <div style={{ display: "flex", width: "300px", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "15px", color: "#6B7280" }}>{t.subtotal}</span>
              <span style={{ fontSize: "15px", color: "#111827" }}>{formatCurrency(subtotal)}</span>
            </div>
            {withholdingTax > 0 && (
              <div style={{ display: "flex", width: "300px", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontSize: "15px", color: "#6B7280" }}>{t.withholdingTax} ({withholdingTaxPercent}%)</span>
                <span style={{ fontSize: "15px", color: "#DC2626" }}>-{formatCurrency(withholdingTax)}</span>
              </div>
            )}
            {/* Separator line */}
            <div style={{ width: "300px", height: "1px", backgroundColor: "#E5E7EB", marginTop: "8px", marginBottom: "12px" }} />
            {/* Total */}
            <div
              style={{
                display: "flex",
                width: "300px",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: "14px", fontWeight: "bold", color: "#111827" }}>{t.total}</span>
              <span style={{ fontSize: "14px", fontWeight: "bold", color: PRIMARY_COLOR }}>{formatCurrency(totalAmount)}</span>
            </div>
          </div>

          {/* Payment Info and Signature Section */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "40px" }}>
            {/* Payment Information */}
            {(displayBankName || bankAccountName || bankAccountNumber) && (
              <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                <span style={{ fontSize: "15px", fontWeight: "bold", color: "#111827", marginBottom: "12px" }}>
                  {t.paymentInfo}
                </span>
                {displayBankName && (
                  <div style={{ display: "flex", marginBottom: "6px" }}>
                    <span style={{ fontSize: "14px", color: "#6B7280", width: "140px" }}>{t.bankNameLabel}:</span>
                    <span style={{ fontSize: "14px", color: "#111827" }}>{displayBankName}</span>
                  </div>
                )}
                {bankAccountName && (
                  <div style={{ display: "flex", marginBottom: "6px" }}>
                    <span style={{ fontSize: "14px", color: "#6B7280", width: "140px" }}>{t.accountName}:</span>
                    <span style={{ fontSize: "14px", color: "#111827" }}>{bankAccountName}</span>
                  </div>
                )}
                {bankAccountNumber && (
                  <div style={{ display: "flex", marginBottom: "6px" }}>
                    <span style={{ fontSize: "14px", color: "#6B7280", width: "140px" }}>{t.accountNumber}:</span>
                    <span style={{ fontSize: "14px", color: "#111827" }}>{bankAccountNumber}</span>
                  </div>
                )}
              </div>
            )}

            {/* Signature Section */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "300px" }}>
              <div style={{ width: "200px", borderBottom: "2px solid #111827", marginBottom: "12px", marginTop: "60px" }} />
              <span style={{ fontSize: "14px", color: "#111827" }}>{t.receiver}</span>
              {ownerName && (
                <span style={{ fontSize: "15px", color: "#6B7280", marginTop: "4px" }}>({ownerName})</span>
              )}
            </div>
          </div>

          {/* Footer */}
          <div style={{ display: "flex", justifyContent: "center", marginTop: "auto", paddingTop: "40px" }}>
            <span style={{ fontSize: "14px", color: "#6B7280" }}>{t.thankYou}</span>
          </div>
        </div>
      ),
      {
        width: 1024,
        height: 1366,
        ...(fontData && fontDataBold ? {
          fonts: [
            {
              name: "IBM Plex Sans Thai",
              data: fontData,
              weight: 400 as const,
              style: "normal" as const,
            },
            {
              name: "IBM Plex Sans Thai",
              data: fontDataBold,
              weight: 700 as const,
              style: "normal" as const,
            },
          ],
        } : {}),
      }
    );
  } catch (error) {
    console.error("Error generating receipt image:", error);
    return new Response("Error generating image", { status: 500 });
  }
}
