import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

// Convert number to Thai baht text
function numberToThaiText(num: number): string {
  const thaiNumbers = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const thaiPositions = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];

  if (num === 0) return "ศูนย์บาทถ้วน";

  const intPart = Math.floor(num);
  const decimalPart = Math.round((num - intPart) * 100);

  let result = "";

  const numStr = intPart.toString();
  const len = numStr.length;

  for (let i = 0; i < len; i++) {
    const digit = parseInt(numStr[i]);
    const position = len - i - 1;
    const posInGroup = position % 6;

    if (position >= 6 && posInGroup === 0 && digit !== 0) {
      result += "ล้าน";
    }

    if (digit === 0) continue;

    if (posInGroup === 1 && digit === 1) {
      result += "สิบ";
    } else if (posInGroup === 1 && digit === 2) {
      result += "ยี่สิบ";
    } else if (posInGroup === 0 && digit === 1 && len > 1) {
      result += "เอ็ด";
    } else {
      result += thaiNumbers[digit] + thaiPositions[posInGroup];
    }
  }

  result += "บาท";

  if (decimalPart > 0) {
    const decStr = decimalPart.toString().padStart(2, "0");
    const d1 = parseInt(decStr[0]);
    const d2 = parseInt(decStr[1]);

    if (d1 === 1) {
      result += "สิบ";
    } else if (d1 === 2) {
      result += "ยี่สิบ";
    } else if (d1 > 0) {
      result += thaiNumbers[d1] + "สิบ";
    }

    if (d2 === 1 && d1 > 0) {
      result += "เอ็ด";
    } else if (d2 > 0) {
      result += thaiNumbers[d2];
    }

    result += "สตางค์";
  } else {
    result += "ถ้วน";
  }

  return result;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Get data from query params (passed by send route)
    const receiptNo = searchParams.get("receiptNo") || "";
    const invoiceNo = searchParams.get("invoiceNo") || "";
    const amount = Number(searchParams.get("amount") || 0);
    const issuedAt = searchParams.get("issuedAt") || "";
    const unitNumber = searchParams.get("unitNumber") || "";
    const tenantName = searchParams.get("tenantName") || "";
    const companyName = searchParams.get("companyName") || "";
    const companyAddress = searchParams.get("companyAddress") || "";
    const companyTaxId = searchParams.get("companyTaxId") || "";
    const tenantTaxId = searchParams.get("tenantTaxId") || "";
    const withholdingTax = Number(searchParams.get("withholdingTax") || 0);
    const lang = searchParams.get("lang") || "th";

    // Additional details
    const billingMonth = searchParams.get("billingMonth") || "";

    const t = lang === "th" ? {
      receipt: "ใบเสร็จรับเงิน",
      original: "(ต้นฉบับ)",
      receiptNo: "เลขที่",
      date: "วันที่",
      reference: "อ้างอิง",
      room: "ห้อง",
      name: "ชื่อ",
      taxId: "TAX ID",
      no: "#",
      description: "Description",
      descriptionTh: "รายละเอียด",
      price: "Price",
      priceTh: "ราคา",
      whTax: "WH 5%",
      whTaxTh: "ณ ที่จ่าย WH 5%",
      total: "Total",
      totalTh: "จำนวนเงิน",
      grandTotal: "จำนวนเงินทั้งสิ้น",
      receiver: "ผู้รับเงิน",
    } : {
      receipt: "RECEIPT",
      original: "(Original)",
      receiptNo: "No.",
      date: "Date",
      reference: "Reference",
      room: "Room",
      name: "Name",
      taxId: "TAX ID",
      no: "#",
      description: "Description",
      descriptionTh: "",
      price: "Price",
      priceTh: "",
      whTax: "WH 5%",
      whTaxTh: "",
      total: "Total",
      totalTh: "",
      grandTotal: "Grand Total",
      receiver: "Receiver",
    };

    const formatCurrency = (amt: number) => amt.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const formatDate = (dateStr: string) => {
      if (!dateStr) return "";
      const d = new Date(dateStr);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    // Calculate values
    const subtotal = amount + withholdingTax;
    const totalAmount = amount;

    // Get billing month for description
    const billingDate = billingMonth ? new Date(billingMonth + "-01") : new Date();
    const monthName = billingDate.toLocaleDateString("th-TH", { month: "long", year: "numeric" });
    const monthNameEn = billingDate.toLocaleDateString("en-US", { month: "long" });

    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            backgroundColor: "white",
            padding: 32,
          }}
        >
          {/* Header Row */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
            {/* Company Info - Left */}
            <div style={{ display: "flex", flexDirection: "column", maxWidth: "50%" }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#1f2937", marginBottom: 4 }}>
                {companyName}
              </span>
              {companyAddress && (
                <span style={{ fontSize: 10, color: "#4b5563", lineHeight: 1.4 }}>
                  {companyAddress}
                </span>
              )}
              {companyTaxId && (
                <span style={{ fontSize: 10, color: "#4b5563", marginTop: 2 }}>
                  เลขผู้เสียภาษี {companyTaxId}
                </span>
              )}
            </div>

            {/* Receipt Info - Right */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#1f2937", marginBottom: 6 }}>
                {t.receipt} {t.original}
              </span>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  border: "1px solid #d1d5db",
                  borderRadius: 4,
                  padding: "6px 10px",
                  fontSize: 10,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ color: "#6b7280", marginRight: 12 }}>{t.receiptNo}</span>
                  <span style={{ color: "#111827" }}>{receiptNo}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ color: "#6b7280", marginRight: 12 }}>{t.date}</span>
                  <span style={{ color: "#111827" }}>{formatDate(issuedAt)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#6b7280", marginRight: 12 }}>{t.reference}</span>
                  <span style={{ color: "#111827" }}>{invoiceNo}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tenant Info */}
          <div style={{ display: "flex", flexDirection: "column", marginBottom: 16, fontSize: 11 }}>
            <div style={{ display: "flex", marginBottom: 2 }}>
              <span style={{ color: "#6b7280", width: 40 }}>{t.room}:</span>
              <span style={{ color: "#111827" }}>{unitNumber}</span>
            </div>
            <div style={{ display: "flex", marginBottom: 2 }}>
              <span style={{ color: "#6b7280", width: 40 }}>{t.name}:</span>
              <span style={{ color: "#111827" }}>{tenantName}</span>
            </div>
            {tenantTaxId && (
              <div style={{ display: "flex" }}>
                <span style={{ color: "#6b7280", width: 40 }}>{t.taxId}</span>
                <span style={{ color: "#111827" }}>{tenantTaxId}</span>
              </div>
            )}
          </div>

          {/* Items Table */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              border: "1px solid #e5e7eb",
              marginBottom: 12,
            }}
          >
            {/* Table Header */}
            <div
              style={{
                display: "flex",
                borderBottom: "1px solid #e5e7eb",
                backgroundColor: "#f9fafb",
                padding: "6px 10px",
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              <span style={{ width: 24, color: "#374151" }}>{t.no}</span>
              <span style={{ flex: 1, color: "#374151" }}>
                {t.description}
                {lang === "th" && <span style={{ display: "block", fontWeight: 400, color: "#6b7280" }}>{t.descriptionTh}</span>}
              </span>
              <span style={{ width: 70, textAlign: "right", color: "#374151" }}>
                {t.price}
                {lang === "th" && <span style={{ display: "block", fontWeight: 400, color: "#6b7280" }}>{t.priceTh}</span>}
              </span>
              <span style={{ width: 70, textAlign: "right", color: "#374151" }}>
                {t.whTax}
                {lang === "th" && <span style={{ display: "block", fontWeight: 400, color: "#6b7280" }}>{t.whTaxTh}</span>}
              </span>
              <span style={{ width: 80, textAlign: "right", color: "#374151" }}>
                {t.total}
                {lang === "th" && <span style={{ display: "block", fontWeight: 400, color: "#6b7280" }}>{t.totalTh}</span>}
              </span>
            </div>

            {/* Table Row */}
            <div
              style={{
                display: "flex",
                padding: "8px 10px",
                fontSize: 10,
                alignItems: "center",
              }}
            >
              <span style={{ width: 24, color: "#374151" }}>1</span>
              <span style={{ flex: 1, color: "#374151" }}>
                ค่าเช่า เดือน{monthName} / Rental fee {monthNameEn}
              </span>
              <span style={{ width: 70, textAlign: "right", color: "#374151" }}>
                {formatCurrency(subtotal)}
              </span>
              <span style={{ width: 70, textAlign: "right", color: "#374151" }}>
                {formatCurrency(withholdingTax)}
              </span>
              <span style={{ width: 80, textAlign: "right", color: "#374151" }}>
                {formatCurrency(totalAmount)}
              </span>
            </div>
          </div>

          {/* Total Section */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            {/* Thai Text Total */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                backgroundColor: "#dcfce7",
                padding: "6px 12px",
                borderRadius: 4,
              }}
            >
              <span style={{ fontSize: 10, color: "#166534", fontWeight: 500 }}>
                {numberToThaiText(totalAmount)}
              </span>
            </div>

            {/* Grand Total Box */}
            <div style={{ display: "flex", alignItems: "center" }}>
              <span style={{ fontSize: 10, color: "#6b7280", marginRight: 10 }}>{t.grandTotal}</span>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#dcfce7",
                  border: "1px solid #86efac",
                  padding: "6px 12px",
                  borderRadius: 4,
                  minWidth: 100,
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 700, color: "#166534" }}>
                  {formatCurrency(totalAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* Signature Section */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              marginTop: "auto",
              paddingTop: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                width: 120,
              }}
            >
              <div
                style={{
                  width: 100,
                  borderBottom: "1px solid #9ca3af",
                  marginBottom: 6,
                  height: 30,
                }}
              />
              <span style={{ fontSize: 10, color: "#6b7280" }}>{t.receiver}</span>
            </div>
          </div>
        </div>
      ),
      { width: 600, height: 600 }
    );
  } catch (error) {
    console.error("Error generating receipt image:", error);
    return new Response("Error generating image", { status: 500 });
  }
}
