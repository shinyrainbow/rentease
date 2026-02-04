import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

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
    const lang = searchParams.get("lang") || "th";

    // Additional details
    const billingMonth = searchParams.get("billingMonth") || "";
    const paymentMethod = searchParams.get("paymentMethod") || "";
    const paymentDate = searchParams.get("paymentDate") || "";

    const t = lang === "th" ? {
      receipt: "ใบเสร็จรับเงิน",
      receiptNo: "เลขที่",
      date: "วันที่ออก",
      invoiceRef: "อ้างอิงใบแจ้งหนี้",
      billingMonth: "รอบบิล",
      unit: "ห้อง",
      tenant: "ผู้ชำระ",
      paymentMethod: "ช่องทางชำระ",
      paymentDate: "วันที่ชำระ",
      total: "รวมเงินที่รับ",
      thankYou: "ขอบคุณที่ชำระเงิน",
      methods: {
        TRANSFER: "โอนเงิน",
        CASH: "เงินสด",
        CHECK: "เช็ค",
      } as Record<string, string>,
    } : {
      receipt: "RECEIPT",
      receiptNo: "Receipt No",
      date: "Issue Date",
      invoiceRef: "Invoice Ref",
      billingMonth: "Billing Month",
      unit: "Unit",
      tenant: "Paid By",
      paymentMethod: "Payment Method",
      paymentDate: "Payment Date",
      total: "Total Received",
      thankYou: "Thank you for your payment",
      methods: {
        TRANSFER: "Bank Transfer",
        CASH: "Cash",
        CHECK: "Check",
      } as Record<string, string>,
    };

    const formatCurrency = (amt: number) => `฿${amt.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const formatDate = (dateStr: string) => {
      if (!dateStr) return "";
      return new Date(dateStr).toLocaleDateString(
        lang === "th" ? "th-TH" : "en-US",
        { year: "numeric", month: "short", day: "numeric" }
      );
    };

    const getPaymentMethodLabel = (method: string) => {
      return t.methods[method] || method;
    };

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
          {/* Company Name */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 24, fontWeight: 700, color: "#1f2937" }}>{companyName}</span>
          </div>

          {/* Receipt Title (green) */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <div style={{ display: "flex", backgroundColor: "#f0fdf4", padding: "8px 24px", borderRadius: 8 }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: "#16a34a" }}>{t.receipt}</span>
            </div>
          </div>

          {/* Receipt Info Box */}
          <div style={{ display: "flex", flexDirection: "column", backgroundColor: "#f0fdf4", padding: 16, borderRadius: 12, marginBottom: 16 }}>
            {/* Row 1: Receipt No & Date */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: 13 }}>
              <div style={{ display: "flex" }}>
                <span style={{ color: "#6b7280" }}>{t.receiptNo}: </span>
                <span style={{ fontWeight: 700, marginLeft: 4 }}>{receiptNo}</span>
              </div>
              <div style={{ display: "flex" }}>
                <span style={{ color: "#6b7280" }}>{t.date}: </span>
                <span style={{ marginLeft: 4 }}>{formatDate(issuedAt)}</span>
              </div>
            </div>

            {/* Row 2: Invoice Ref & Billing Month */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: 13 }}>
              <div style={{ display: "flex" }}>
                <span style={{ color: "#6b7280" }}>{t.invoiceRef}: </span>
                <span style={{ marginLeft: 4 }}>{invoiceNo}</span>
              </div>
              {billingMonth && (
                <div style={{ display: "flex" }}>
                  <span style={{ color: "#6b7280" }}>{t.billingMonth}: </span>
                  <span style={{ marginLeft: 4 }}>{billingMonth}</span>
                </div>
              )}
            </div>

            {/* Row 3: Unit */}
            <div style={{ display: "flex", fontSize: 13 }}>
              <span style={{ color: "#6b7280" }}>{t.unit}: </span>
              <span style={{ marginLeft: 4 }}>{unitNumber}</span>
            </div>
          </div>

          {/* Tenant Name */}
          <div style={{ display: "flex", marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: "#6b7280" }}>{t.tenant}: </span>
            <span style={{ fontSize: 13, fontWeight: 500, marginLeft: 4 }}>{tenantName}</span>
          </div>

          {/* Payment Info */}
          {paymentMethod && (
            <div style={{ display: "flex", flexDirection: "column", backgroundColor: "#f9fafb", borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: paymentDate ? 8 : 0 }}>
                <span style={{ color: "#6b7280" }}>{t.paymentMethod}:</span>
                <span style={{ fontWeight: 500 }}>{getPaymentMethodLabel(paymentMethod)}</span>
              </div>
              {paymentDate && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "#6b7280" }}>{t.paymentDate}:</span>
                  <span>{formatDate(paymentDate)}</span>
                </div>
              )}
            </div>
          )}

          {/* Total Amount Box (green) */}
          <div style={{ display: "flex", justifyContent: "center", marginTop: "auto", marginBottom: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", backgroundColor: "#16a34a", padding: "20px 48px", borderRadius: 12 }}>
              <span style={{ fontSize: 12, color: "white", marginBottom: 4 }}>{t.total}</span>
              <span style={{ fontSize: 32, fontWeight: 700, color: "white" }}>{formatCurrency(amount)}</span>
            </div>
          </div>

          {/* Thank You */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <span style={{ fontSize: 14, color: "#16a34a", fontWeight: 500 }}>{t.thankYou}</span>
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
