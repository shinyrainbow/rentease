import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { invoice, lang = "th" } = data;

    const t = lang === "th" ? {
      invoice: "ใบแจ้งหนี้",
      invoiceNo: "เลขที่",
      billingMonth: "รอบบิล",
      dueDate: "กำหนดชำระ",
      unit: "ห้อง",
      total: "ยอดชำระ",
    } : {
      invoice: "INVOICE",
      invoiceNo: "Invoice No",
      billingMonth: "Billing Month",
      dueDate: "Due Date",
      unit: "Unit",
      total: "Total",
    };

    const formatCurrency = (amount: number) => `฿${amount.toLocaleString()}`;
    const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString(
      lang === "th" ? "th-TH" : "en-US",
      { year: "numeric", month: "short", day: "numeric" }
    );

    const tenantName = lang === "th" && invoice.tenantNameTh ? invoice.tenantNameTh : invoice.tenantName;
    const companyName = invoice.companyName || invoice.projectName;

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

          {/* Invoice Title */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 30 }}>
            <div style={{ display: "flex", backgroundColor: "#eff6ff", padding: "12px 32px", borderRadius: 8 }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: "#3b82f6" }}>{t.invoice}</span>
            </div>
          </div>

          {/* Invoice Info Box */}
          <div style={{ display: "flex", flexDirection: "column", backgroundColor: "#f9fafb", padding: 24, borderRadius: 12, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 16, color: "#6b7280" }}>{t.invoiceNo}:</span>
              <span style={{ fontSize: 16, fontWeight: 700 }}>{invoice.invoiceNo}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 16, color: "#6b7280" }}>{t.unit}:</span>
              <span style={{ fontSize: 16 }}>{invoice.unitNumber}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 16, color: "#6b7280" }}>{t.billingMonth}:</span>
              <span style={{ fontSize: 16 }}>{invoice.billingMonth}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 16, color: "#6b7280" }}>{t.dueDate}:</span>
              <span style={{ fontSize: 16, color: "#dc2626" }}>{formatDate(invoice.dueDate)}</span>
            </div>
          </div>

          {/* Tenant Name */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 30 }}>
            <span style={{ fontSize: 18, color: "#4b5563" }}>{tenantName}</span>
          </div>

          {/* Total Amount Box */}
          <div style={{ display: "flex", justifyContent: "center", marginTop: "auto" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", backgroundColor: "#3b82f6", padding: "24px 48px", borderRadius: 12 }}>
              <span style={{ fontSize: 14, color: "white", marginBottom: 8 }}>{t.total}</span>
              <span style={{ fontSize: 36, fontWeight: 700, color: "white" }}>{formatCurrency(invoice.totalAmount)}</span>
            </div>
          </div>
        </div>
      ),
      { width: 600, height: 700 }
    );
  } catch (error) {
    console.error("Error generating invoice image:", error);
    return new Response("Error generating image", { status: 500 });
  }
}
