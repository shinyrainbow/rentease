import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

interface LineItem {
  description: string;
  amount: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Get data from query params (passed by send route)
    const invoiceNo = searchParams.get("invoiceNo") || "";
    const billingMonth = searchParams.get("billingMonth") || "";
    const dueDate = searchParams.get("dueDate") || "";
    const totalAmount = Number(searchParams.get("totalAmount") || 0);
    const unitNumber = searchParams.get("unitNumber") || "";
    const tenantName = searchParams.get("tenantName") || "";
    const companyName = searchParams.get("companyName") || "";
    const lang = searchParams.get("lang") || "th";

    // Additional details
    const subtotal = Number(searchParams.get("subtotal") || 0);
    const withholdingTax = Number(searchParams.get("withholdingTax") || 0);
    const discountAmount = Number(searchParams.get("discountAmount") || 0);
    const lineItemsStr = searchParams.get("lineItems") || "[]";
    const lineItems: LineItem[] = JSON.parse(lineItemsStr);

    // Bank info
    const bankName = searchParams.get("bankName") || "";
    const bankAccountName = searchParams.get("bankAccountName") || "";
    const bankAccountNumber = searchParams.get("bankAccountNumber") || "";

    const t = lang === "th" ? {
      invoice: "ใบแจ้งหนี้",
      invoiceNo: "เลขที่",
      billingMonth: "รอบบิล",
      dueDate: "กำหนดชำระ",
      unit: "ห้อง",
      tenant: "ผู้เช่า",
      subtotal: "รวม",
      discount: "ส่วนลด",
      withholdingTax: "หัก ณ ที่จ่าย",
      total: "ยอดชำระ",
      paymentInfo: "ข้อมูลการชำระเงิน",
      bank: "ธนาคาร",
      accountName: "ชื่อบัญชี",
      accountNumber: "เลขบัญชี",
    } : {
      invoice: "INVOICE",
      invoiceNo: "Invoice No",
      billingMonth: "Billing Month",
      dueDate: "Due Date",
      unit: "Unit",
      tenant: "Tenant",
      subtotal: "Subtotal",
      discount: "Discount",
      withholdingTax: "Withholding Tax",
      total: "Total",
      paymentInfo: "Payment Info",
      bank: "Bank",
      accountName: "Account Name",
      accountNumber: "Account No",
    };

    const formatCurrency = (amount: number) => `฿${amount.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const formatDate = (dateStr: string) => {
      if (!dateStr) return "";
      return new Date(dateStr).toLocaleDateString(
        lang === "th" ? "th-TH" : "en-US",
        { year: "numeric", month: "short", day: "numeric" }
      );
    };

    const hasDeductions = withholdingTax > 0 || discountAmount > 0;
    const hasBankInfo = bankName && bankAccountNumber;

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

          {/* Invoice Title */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <div style={{ display: "flex", backgroundColor: "#eff6ff", padding: "8px 24px", borderRadius: 8 }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: "#3b82f6" }}>{t.invoice}</span>
            </div>
          </div>

          {/* Invoice Info Row */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, fontSize: 13 }}>
            <div style={{ display: "flex" }}>
              <span style={{ color: "#6b7280" }}>{t.invoiceNo}: </span>
              <span style={{ fontWeight: 600, marginLeft: 4 }}>{invoiceNo}</span>
            </div>
            <div style={{ display: "flex" }}>
              <span style={{ color: "#6b7280" }}>{t.billingMonth}: </span>
              <span style={{ marginLeft: 4 }}>{billingMonth}</span>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, fontSize: 13 }}>
            <div style={{ display: "flex" }}>
              <span style={{ color: "#6b7280" }}>{t.unit}: </span>
              <span style={{ marginLeft: 4 }}>{unitNumber}</span>
            </div>
            <div style={{ display: "flex" }}>
              <span style={{ color: "#6b7280" }}>{t.dueDate}: </span>
              <span style={{ marginLeft: 4, color: "#dc2626", fontWeight: 600 }}>{formatDate(dueDate)}</span>
            </div>
          </div>

          {/* Tenant Name */}
          <div style={{ display: "flex", marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: "#6b7280" }}>{t.tenant}: </span>
            <span style={{ fontSize: 13, fontWeight: 500, marginLeft: 4 }}>{tenantName}</span>
          </div>

          {/* Line Items */}
          {lineItems.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", backgroundColor: "#f9fafb", borderRadius: 8, padding: 12, marginBottom: 12 }}>
              {lineItems.map((item, index) => (
                <div key={index} style={{ display: "flex", justifyContent: "space-between", marginBottom: index < lineItems.length - 1 ? 8 : 0, fontSize: 13 }}>
                  <span style={{ color: "#374151", flex: 1 }}>{item.description}</span>
                  <span style={{ fontWeight: 500 }}>{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Totals Section */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", marginBottom: 12 }}>
            {hasDeductions && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", width: 200, marginBottom: 4, fontSize: 13 }}>
                  <span style={{ color: "#6b7280" }}>{t.subtotal}</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", width: 200, marginBottom: 4, fontSize: 13 }}>
                    <span style={{ color: "#6b7280" }}>{t.discount}</span>
                    <span style={{ color: "#16a34a" }}>-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                {withholdingTax > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", width: 200, marginBottom: 4, fontSize: 13 }}>
                    <span style={{ color: "#6b7280" }}>{t.withholdingTax}</span>
                    <span>-{formatCurrency(withholdingTax)}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Total Amount Box */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", backgroundColor: "#3b82f6", padding: "16px 40px", borderRadius: 12 }}>
              <span style={{ fontSize: 12, color: "white", marginBottom: 4 }}>{t.total}</span>
              <span style={{ fontSize: 28, fontWeight: 700, color: "white" }}>{formatCurrency(totalAmount)}</span>
            </div>
          </div>

          {/* Bank Info */}
          {hasBankInfo && (
            <div style={{ display: "flex", flexDirection: "column", backgroundColor: "#fef3c7", borderRadius: 8, padding: 12, marginTop: "auto" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#92400e", marginBottom: 8 }}>{t.paymentInfo}</span>
              <div style={{ display: "flex", fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: "#78716c", width: 80 }}>{t.bank}:</span>
                <span style={{ color: "#1f2937" }}>{bankName}</span>
              </div>
              {bankAccountName && (
                <div style={{ display: "flex", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: "#78716c", width: 80 }}>{t.accountName}:</span>
                  <span style={{ color: "#1f2937" }}>{bankAccountName}</span>
                </div>
              )}
              <div style={{ display: "flex", fontSize: 12 }}>
                <span style={{ color: "#78716c", width: 80 }}>{t.accountNumber}:</span>
                <span style={{ color: "#1f2937", fontWeight: 600, fontFamily: "monospace" }}>{bankAccountNumber}</span>
              </div>
            </div>
          )}
        </div>
      ),
      { width: 600, height: hasBankInfo ? 750 : 650 }
    );
  } catch (error) {
    console.error("Error generating invoice image:", error);
    return new Response("Error generating image", { status: 500 });
  }
}
