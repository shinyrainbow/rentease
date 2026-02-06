import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

const translations = {
  en: {
    receipt: "RECEIPT",
    original: "(Original)",
    receiptNo: "No.",
    date: "Date",
    reference: "Reference",
    room: "Room",
    name: "Name",
    address: "Address",
    taxId: "TAX ID",
    no: "#",
    description: "Description",
    price: "Price",
    whTax: "WH 5%",
    total: "Total",
    grandTotal: "Grand Total",
    receiver: "Receiver",
  },
  th: {
    receipt: "ใบเสร็จรับเงิน",
    original: "(ต้นฉบับ)",
    receiptNo: "เลขที่",
    date: "วันที่",
    reference: "อ้างอิง",
    room: "ห้อง",
    name: "ชื่อ",
    address: "ที่อยู่",
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
  },
};

// Convert number to Thai baht text
function numberToThaiText(num: number): string {
  const thaiNumbers = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const thaiPositions = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];

  if (num === 0) return "ศูนย์บาทถ้วน";

  const intPart = Math.floor(num);
  const decimalPart = Math.round((num - intPart) * 100);

  let result = "";

  // Process integer part
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const lang = (searchParams.get("lang") as "en" | "th") || "th";
    const t = translations[lang] || translations.th;

    const receipt = await prisma.receipt.findFirst({
      where: { id },
      include: {
        invoice: {
          include: {
            project: true,
            unit: true,
            tenant: true,
          },
        },
      },
    });

    if (!receipt) {
      return new Response("Receipt not found", { status: 404 });
    }

    const formatDate = (date: Date) => {
      const d = new Date(date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const formatCurrency = (amount: number) => {
      return amount.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    };

    // Calculate values
    const withholdingTax = receipt.invoice.withholdingTax || 0;
    const subtotal = receipt.amount + withholdingTax; // Price before WH
    const totalAmount = receipt.amount; // Amount after WH deduction

    // Get billing month for description
    const billingMonth = receipt.invoice.billingMonth;
    const billingDate = billingMonth ? new Date(billingMonth + "-01") : new Date();
    const monthName = billingDate.toLocaleDateString("th-TH", { month: "long", year: "numeric" });
    const monthNameEn = billingDate.toLocaleDateString("en-US", { month: "long" });

    // Get tenant info
    const tenantName = lang === "th" && receipt.invoice.tenant.nameTh
      ? receipt.invoice.tenant.nameTh
      : receipt.invoice.tenant.name;
    const tenantTaxId = receipt.invoice.tenant.taxId || "";

    // Get company info
    const companyName = lang === "th" && receipt.invoice.project.companyNameTh
      ? receipt.invoice.project.companyNameTh
      : (receipt.invoice.project.companyName || receipt.invoice.project.name);
    const companyAddress = receipt.invoice.project.companyAddress || "";
    const companyTaxId = receipt.invoice.project.taxId || "";

    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            backgroundColor: "#ffffff",
            padding: "40px",
            fontFamily: "sans-serif",
          }}
        >
          {/* Header Row */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "24px" }}>
            {/* Company Info - Left */}
            <div style={{ display: "flex", flexDirection: "column", maxWidth: "50%" }}>
              <span style={{ fontSize: "18px", fontWeight: "bold", color: "#111827", marginBottom: "4px" }}>
                {companyName}
              </span>
              {companyAddress && (
                <span style={{ fontSize: "11px", color: "#4b5563", lineHeight: "1.4" }}>
                  {companyAddress}
                </span>
              )}
              {companyTaxId && (
                <span style={{ fontSize: "11px", color: "#4b5563", marginTop: "2px" }}>
                  เลขผู้เสียภาษี {companyTaxId}
                </span>
              )}
            </div>

            {/* Receipt Info - Right */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <span style={{ fontSize: "18px", fontWeight: "bold", color: "#111827", marginBottom: "8px" }}>
                {t.receipt} {t.original}
              </span>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  border: "1px solid #d1d5db",
                  borderRadius: "4px",
                  padding: "8px 12px",
                  fontSize: "11px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ color: "#6b7280", marginRight: "16px" }}>{t.receiptNo}</span>
                  <span style={{ color: "#111827" }}>{receipt.receiptNo}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ color: "#6b7280", marginRight: "16px" }}>{t.date}</span>
                  <span style={{ color: "#111827" }}>{formatDate(receipt.issuedAt)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#6b7280", marginRight: "16px" }}>{t.reference}</span>
                  <span style={{ color: "#111827" }}>{receipt.invoice.invoiceNo}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tenant Info */}
          <div style={{ display: "flex", flexDirection: "column", marginBottom: "20px", fontSize: "12px" }}>
            <div style={{ display: "flex", marginBottom: "2px" }}>
              <span style={{ color: "#6b7280", width: "50px" }}>{t.room}:</span>
              <span style={{ color: "#111827" }}>{receipt.invoice.unit.unitNumber}</span>
            </div>
            <div style={{ display: "flex", marginBottom: "2px" }}>
              <span style={{ color: "#6b7280", width: "50px" }}>{t.name}:</span>
              <span style={{ color: "#111827" }}>{tenantName}</span>
            </div>
            {tenantTaxId && (
              <div style={{ display: "flex" }}>
                <span style={{ color: "#6b7280", width: "50px" }}>{t.taxId}</span>
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
              marginBottom: "16px",
            }}
          >
            {/* Table Header */}
            <div
              style={{
                display: "flex",
                borderBottom: "1px solid #e5e7eb",
                backgroundColor: "#f9fafb",
                padding: "8px 12px",
                fontSize: "11px",
                fontWeight: "bold",
              }}
            >
              <span style={{ width: "30px", color: "#374151" }}>{t.no}</span>
              <span style={{ flex: 1, color: "#374151" }}>
                {lang === "th" ? `${t.description}` : t.description}
                {lang === "th" && <span style={{ display: "block", fontWeight: "normal", color: "#6b7280" }}>{translations.th.descriptionTh}</span>}
              </span>
              <span style={{ width: "90px", textAlign: "right", color: "#374151" }}>
                {lang === "th" ? t.price : t.price}
                {lang === "th" && <span style={{ display: "block", fontWeight: "normal", color: "#6b7280" }}>{translations.th.priceTh}</span>}
              </span>
              <span style={{ width: "90px", textAlign: "right", color: "#374151" }}>
                {t.whTax}
                {lang === "th" && <span style={{ display: "block", fontWeight: "normal", color: "#6b7280" }}>{translations.th.whTaxTh}</span>}
              </span>
              <span style={{ width: "100px", textAlign: "right", color: "#374151" }}>
                {lang === "th" ? t.total : t.total}
                {lang === "th" && <span style={{ display: "block", fontWeight: "normal", color: "#6b7280" }}>{translations.th.totalTh}</span>}
              </span>
            </div>

            {/* Table Row */}
            <div
              style={{
                display: "flex",
                padding: "10px 12px",
                fontSize: "11px",
                alignItems: "center",
              }}
            >
              <span style={{ width: "30px", color: "#374151" }}>1</span>
              <span style={{ flex: 1, color: "#374151" }}>
                ค่าเช่า เดือน{monthName} / Rental fee {monthNameEn}
              </span>
              <span style={{ width: "90px", textAlign: "right", color: "#374151" }}>
                {formatCurrency(subtotal)}
              </span>
              <span style={{ width: "90px", textAlign: "right", color: "#374151" }}>
                {formatCurrency(withholdingTax)}
              </span>
              <span style={{ width: "100px", textAlign: "right", color: "#374151" }}>
                {formatCurrency(totalAmount)}
              </span>
            </div>
          </div>

          {/* Total Section */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
            {/* Thai Text Total */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                backgroundColor: "#dcfce7",
                padding: "8px 16px",
                borderRadius: "4px",
              }}
            >
              <span style={{ fontSize: "12px", color: "#166534", fontWeight: "500" }}>
                {numberToThaiText(totalAmount)}
              </span>
            </div>

            {/* Grand Total Box */}
            <div style={{ display: "flex", alignItems: "center" }}>
              <span style={{ fontSize: "12px", color: "#6b7280", marginRight: "12px" }}>{t.grandTotal}</span>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#dcfce7",
                  border: "1px solid #86efac",
                  padding: "8px 16px",
                  borderRadius: "4px",
                  minWidth: "120px",
                }}
              >
                <span style={{ fontSize: "16px", fontWeight: "bold", color: "#166534" }}>
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
              paddingTop: "20px",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                width: "150px",
              }}
            >
              <div
                style={{
                  width: "120px",
                  borderBottom: "1px solid #9ca3af",
                  marginBottom: "8px",
                  height: "40px",
                }}
              />
              <span style={{ fontSize: "11px", color: "#6b7280" }}>{t.receiver}</span>
            </div>
          </div>
        </div>
      ),
      {
        width: 800,
        height: 600,
      }
    );
  } catch (error) {
    console.error("Error generating receipt image:", error);
    return new Response("Error generating image", { status: 500 });
  }
}
