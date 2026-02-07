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

const translations = {
  en: {
    invoice: "INVOICE",
    invoiceNo: "Invoice No",
    date: "Date",
    dueDate: "Due Date",
    billingMonth: "Billing Month",
    taxId: "Tax ID",
    billTo: "Bill To",
    unit: "Unit",
    description: "Description",
    amount: "Amount (THB)",
    subtotal: "Subtotal",
    withholdingTax: "Withholding Tax",
    total: "Total",
    pleasePayBy: "Please pay by the due date",
  },
  th: {
    invoice: "ใบแจ้งหนี้",
    invoiceNo: "เลขที่",
    date: "วันที่",
    dueDate: "กำหนดชำระ",
    billingMonth: "รอบบิล",
    taxId: "เลขประจำตัวผู้เสียภาษี",
    billTo: "เรียกเก็บจาก",
    unit: "ห้อง",
    description: "รายการ",
    amount: "จำนวนเงิน (บาท)",
    subtotal: "รวม",
    withholdingTax: "หัก ณ ที่จ่าย",
    total: "ยอดรวมทั้งสิ้น",
    pleasePayBy: "กรุณาชำระภายในกำหนด",
  },
};

export async function GET(request: NextRequest) {
  try {
    // Load Noto Sans Thai font for proper Thai character rendering
    let fontData: ArrayBuffer | null = null;
    let fontDataBold: ArrayBuffer | null = null;

    try {
      const fontPromise = fetch(
        new URL("https://fonts.gstatic.com/s/notosansthai/v25/iJWnBXeUZi_OHPqn4wq6hQ2_hbJ1xyN9wd43SofNWcd1MKVQt_So_9CdU5RspzF-QRvzzXg.ttf")
      ).then((res) => res.arrayBuffer());

      const fontBoldPromise = fetch(
        new URL("https://fonts.gstatic.com/s/notosansthai/v25/iJWnBXeUZi_OHPqn4wq6hQ2_hbJ1xyN9wd43SofNWcd1MKVQt_So_9CdU5RtpDF-QRvzzXg.ttf")
      ).then((res) => res.arrayBuffer());

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

    const invoiceNo = searchParams.get("invoiceNo") || "";
    const billingMonth = searchParams.get("billingMonth") || "";
    const dueDate = searchParams.get("dueDate") || "";
    const dateCreated = searchParams.get("dateCreated") || "";
    const totalAmount = Number(searchParams.get("totalAmount") || 0);
    const unitNumber = searchParams.get("unitNumber") || "";
    const tenantName = searchParams.get("tenantName") || "";
    const companyName = searchParams.get("companyName") || "";
    const companyAddress = searchParams.get("companyAddress") || "";
    const taxId = searchParams.get("taxId") || "";
    const logoKey = searchParams.get("logoKey") || "";
    const lang = (searchParams.get("lang") as "en" | "th") || "th";

    // Resolve logo S3 key to presigned URL if needed
    let logoUrl = "";
    if (logoKey) {
      try {
        // Check if it's an S3 key (not a full URL)
        if (!logoKey.startsWith("http://") && !logoKey.startsWith("https://")) {
          const { getPresignedUrl } = await import("@/lib/s3");
          logoUrl = await getPresignedUrl(logoKey, 3600);
        } else {
          logoUrl = logoKey;
        }
      } catch (logoError) {
        console.error("Error resolving logo URL:", logoError);
      }
    }

    const subtotal = Number(searchParams.get("subtotal") || 0);
    const withholdingTax = Number(searchParams.get("withholdingTax") || 0);
    const withholdingTaxPercent = Number(searchParams.get("withholdingTaxPercent") || 0);
    const lineItemsStr = searchParams.get("lineItems") || "[]";
    const lineItems: LineItem[] = JSON.parse(lineItemsStr);

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
            padding: "60px 80px",
          }}
        >
          {/* Company Header - Centered with Logo */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "40px" }}>
            {logoUrl && (
              <img
                src={logoUrl}
                alt="Logo"
                width={100}
                height={100}
                style={{ objectFit: "contain", marginBottom: "16px", borderRadius: "8px" }}
              />
            )}
            <span style={{ fontSize: "28px", fontWeight: "bold", color: "#111827" }}>
              {companyName}
            </span>
            {companyAddress && (
              <span style={{ fontSize: "16px", color: "#6B7280", marginTop: "8px", textAlign: "center" }}>
                {companyAddress}
              </span>
            )}
            {taxId && (
              <span style={{ fontSize: "16px", color: "#6B7280", marginTop: "4px" }}>
                {t.taxId}: {taxId}
              </span>
            )}
          </div>

          {/* Invoice Title - Centered */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "32px" }}>
            <span style={{ fontSize: "40px", fontWeight: "bold", color: TEAL_COLOR }}>
              {t.invoice}
            </span>
          </div>

          {/* Invoice Details */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontSize: "22px", color: "#111827" }}>{t.invoiceNo}: {invoiceNo}</span>
            <span style={{ fontSize: "22px", color: "#111827" }}>{t.date}: {formatDate(dateCreated)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "24px" }}>
            <span style={{ fontSize: "22px", color: "#111827" }}>{t.billingMonth}: {billingMonth}</span>
            <span style={{ fontSize: "22px", color: "#111827" }}>{t.dueDate}: {formatDate(dueDate)}</span>
          </div>

          {/* Bill To Section */}
          <div style={{ display: "flex", flexDirection: "column", marginBottom: "32px" }}>
            <span style={{ fontSize: "22px", fontWeight: "bold", color: "#111827", marginBottom: "8px" }}>
              {t.billTo}:
            </span>
            <span style={{ fontSize: "24px", color: "#111827" }}>{tenantName}</span>
            <span style={{ fontSize: "22px", color: "#6B7280" }}>{t.unit}: {unitNumber}</span>
          </div>

          {/* Table Header */}
          <div
            style={{
              display: "flex",
              backgroundColor: TEAL_COLOR,
              padding: "16px 24px",
              borderRadius: "8px 8px 0 0",
            }}
          >
            <div style={{ flex: 1, display: "flex" }}>
              <span style={{ fontSize: "22px", fontWeight: "bold", color: "#ffffff" }}>{t.description}</span>
            </div>
            <div style={{ width: "200px", display: "flex", justifyContent: "flex-end" }}>
              <span style={{ fontSize: "22px", fontWeight: "bold", color: "#ffffff" }}>{t.amount}</span>
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
                <span style={{ fontSize: "22px", color: "#111827" }}>{item.description}</span>
              </div>
              <div style={{ width: "200px", display: "flex", justifyContent: "flex-end" }}>
                <span style={{ fontSize: "22px", color: "#111827" }}>{formatCurrency(item.amount)}</span>
              </div>
            </div>
          ))}

          {/* Totals Section */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", marginTop: "24px" }}>
            <div style={{ display: "flex", width: "400px", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "22px", color: "#6B7280" }}>{t.subtotal}</span>
              <span style={{ fontSize: "22px", color: "#111827" }}>{formatCurrency(subtotal)}</span>
            </div>
            {withholdingTax > 0 && (
              <div style={{ display: "flex", width: "400px", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontSize: "22px", color: "#6B7280" }}>{t.withholdingTax} ({withholdingTaxPercent}%)</span>
                <span style={{ fontSize: "22px", color: "#DC2626" }}>-{formatCurrency(withholdingTax)}</span>
              </div>
            )}
            {/* Total Box */}
            <div
              style={{
                display: "flex",
                width: "400px",
                justifyContent: "space-between",
                backgroundColor: TEAL_COLOR,
                padding: "16px 24px",
                borderRadius: "8px",
                marginTop: "8px",
              }}
            >
              <span style={{ fontSize: "24px", fontWeight: "bold", color: "#ffffff" }}>{t.total}</span>
              <span style={{ fontSize: "24px", fontWeight: "bold", color: "#ffffff" }}>{formatCurrency(totalAmount)}</span>
            </div>
          </div>

          {/* Footer */}
          <div style={{ display: "flex", justifyContent: "center", marginTop: "auto", paddingTop: "80px" }}>
            <span style={{ fontSize: "20px", color: "#6B7280" }}>{t.pleasePayBy}</span>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 1600,
        ...(fontData && fontDataBold ? {
          fonts: [
            {
              name: "Noto Sans Thai",
              data: fontData,
              weight: 400 as const,
              style: "normal" as const,
            },
            {
              name: "Noto Sans Thai",
              data: fontDataBold,
              weight: 700 as const,
              style: "normal" as const,
            },
          ],
        } : {}),
      }
    );
  } catch (error) {
    console.error("Error generating invoice image:", error);
    return new Response("Error generating image", { status: 500 });
  }
}
