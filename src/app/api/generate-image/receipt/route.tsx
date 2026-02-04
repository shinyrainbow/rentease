import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { receipt, lang = "th" } = data;

    const t = lang === "th" ? {
      receipt: "ใบเสร็จรับเงิน",
      receiptNo: "เลขที่",
      date: "วันที่",
      invoiceRef: "อ้างอิง",
      unit: "ห้อง",
      total: "รวมเงินที่รับ",
      thankYou: "ขอบคุณที่ชำระเงิน",
    } : {
      receipt: "RECEIPT",
      receiptNo: "Receipt No",
      date: "Date",
      invoiceRef: "Reference",
      unit: "Unit",
      total: "Total Received",
      thankYou: "Thank you for your payment",
    };

    const formatCurrency = (amount: number) => `฿${amount.toLocaleString()}`;
    const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString(
      lang === "th" ? "th-TH" : "en-US",
      { year: "numeric", month: "short", day: "numeric" }
    );

    const tenantName = lang === "th" && receipt.tenantNameTh ? receipt.tenantNameTh : receipt.tenantName;
    const companyName = receipt.companyName || receipt.projectName;

    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            backgroundColor: "white",
            padding: 40,
          }}
        >
          {/* Company Name */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: "#1f2937" }}>{companyName}</span>
          </div>

          {/* Receipt Title (green) */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 30 }}>
            <div style={{ display: "flex", backgroundColor: "#f0fdf4", padding: "12px 32px", borderRadius: 8 }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: "#16a34a" }}>{t.receipt}</span>
            </div>
          </div>

          {/* Receipt Info Box */}
          <div style={{ display: "flex", flexDirection: "column", backgroundColor: "#f0fdf4", padding: 24, borderRadius: 12, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 16, color: "#6b7280" }}>{t.receiptNo}:</span>
              <span style={{ fontSize: 16, fontWeight: 700 }}>{receipt.receiptNo}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 16, color: "#6b7280" }}>{t.invoiceRef}:</span>
              <span style={{ fontSize: 16 }}>{receipt.invoiceNo}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 16, color: "#6b7280" }}>{t.unit}:</span>
              <span style={{ fontSize: 16 }}>{receipt.unitNumber}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 16, color: "#6b7280" }}>{t.date}:</span>
              <span style={{ fontSize: 16 }}>{formatDate(receipt.issuedAt)}</span>
            </div>
          </div>

          {/* Tenant Name */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 30 }}>
            <span style={{ fontSize: 18, color: "#4b5563" }}>{tenantName}</span>
          </div>

          {/* Total Amount Box (green) */}
          <div style={{ display: "flex", justifyContent: "center", marginTop: "auto" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", backgroundColor: "#16a34a", padding: "24px 48px", borderRadius: 12 }}>
              <span style={{ fontSize: 14, color: "white", marginBottom: 8 }}>{t.total}</span>
              <span style={{ fontSize: 36, fontWeight: 700, color: "white" }}>{formatCurrency(receipt.amount)}</span>
            </div>
          </div>

          {/* Thank You */}
          <div style={{ display: "flex", justifyContent: "center", marginTop: 20 }}>
            <span style={{ fontSize: 14, color: "#6b7280" }}>{t.thankYou}</span>
          </div>
        </div>
      ),
      { width: 600, height: 650 }
    );
  } catch (error) {
    console.error("Error generating receipt image:", error);
    return new Response("Error generating image", { status: 500 });
  }
}
