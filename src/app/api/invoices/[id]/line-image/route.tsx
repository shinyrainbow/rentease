import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

interface LineItem {
  description: string;
  amount: number;
  previousReading?: number;
  currentReading?: number;
  unitPrice?: number;
}

// Primary teal color from NainaHub example
const TEAL_COLOR = "#2D8B8B";

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
    const companyNameTh = searchParams.get("companyNameTh") || "";
    const taxId = searchParams.get("taxId") || "";
    const tenantTaxId = searchParams.get("tenantTaxId") || "";
    const lang = searchParams.get("lang") || "th";
    const version = searchParams.get("version") || "original";

    // Additional details
    const subtotal = Number(searchParams.get("subtotal") || 0);
    const withholdingTax = Number(searchParams.get("withholdingTax") || 0);
    const discountAmount = Number(searchParams.get("discountAmount") || 0);
    const lineItemsStr = searchParams.get("lineItems") || "[]";
    const lineItems: LineItem[] = JSON.parse(lineItemsStr);

    // Bank info
    const bankName = searchParams.get("bankName") || "KBANK";
    const bankAccountName = searchParams.get("bankAccountName") || companyName;
    const bankAccountNumber = searchParams.get("bankAccountNumber") || "155-3-41841-7";

    const t = lang === "th" ? {
      taxInvoice: "Tax Invoice",
      invoiceNo: "Invoice ID",
      date: "Date",
      taxId: "เลขประจำตัวผู้เสียภาษี",
      projectDescription: "PROJECT DESCRIPTION:",
      description: "Description",
      price: "Price",
      subTotal: "Sub-Total",
      vat: "Vat 7%",
      totalAmount: "Total",
      termsTitle: "Terms & Conditions:",
      termsText: "Above information is not an invoice and only an estimate of goods/services.",
      paymentDueNote: "Payment is due within 3 days.",
      paymentMethod: "Payment Method: Bank Transfer",
      bankLabel: "Bank Name:",
      accountNumber: "Account Number:",
      accountName: "Account Name:",
      signatureOverPrintedName: "Signature over printed name",
      dateSigned: "Date signed",
      original: "ต้นฉบับ",
      copy: "สำเนา",
      previousReading: "เลขก่อน",
      currentReading: "เลขหลัง",
      units: "หน่วย",
    } : {
      taxInvoice: "Tax Invoice",
      invoiceNo: "Invoice ID",
      date: "Date",
      taxId: "Tax ID",
      projectDescription: "PROJECT DESCRIPTION:",
      description: "Description",
      price: "Price",
      subTotal: "Sub-Total",
      vat: "Vat 7%",
      totalAmount: "Total",
      termsTitle: "Terms & Conditions:",
      termsText: "Above information is not an invoice and only an estimate of goods/services.",
      paymentDueNote: "Payment is due within 3 days.",
      paymentMethod: "Payment Method: Bank Transfer",
      bankLabel: "Bank Name:",
      accountNumber: "Account Number:",
      accountName: "Account Name:",
      signatureOverPrintedName: "Signature over printed name",
      dateSigned: "Date signed",
      original: "Original",
      copy: "Copy",
      previousReading: "Previous",
      currentReading: "Current",
      units: "Units",
    };

    const formatCurrency = (amount: number) => amount.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    const formatDate = (dateStr: string) => {
      if (!dateStr) return "";
      return new Date(dateStr).toLocaleDateString(
        lang === "th" ? "th-TH" : "en-US",
        { year: "numeric", month: "short", day: "numeric" }
      );
    };

    // Calculate VAT (7%)
    const vatAmount = Math.round(subtotal * 0.07);
    const totalWithVat = subtotal + vatAmount;

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
            position: "relative",
          }}
        >
          {/* Top Left Diagonal Stripe */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "120px",
              height: "120px",
              overflow: "hidden",
              display: "flex",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "-40px",
                left: "-80px",
                width: "160px",
                height: "32px",
                backgroundColor: TEAL_COLOR,
                transform: "rotate(-45deg)",
                display: "flex",
              }}
            />
          </div>

          {/* Bottom Right Diagonal Stripe */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              width: "160px",
              height: "160px",
              overflow: "hidden",
              display: "flex",
            }}
          >
            <div
              style={{
                position: "absolute",
                bottom: "-24px",
                right: "-80px",
                width: "240px",
                height: "40px",
                backgroundColor: TEAL_COLOR,
                transform: "rotate(-45deg)",
                display: "flex",
              }}
            />
          </div>

          {/* Version Badge */}
          <div
            style={{
              position: "absolute",
              top: "16px",
              right: "16px",
              backgroundColor: version === "original" ? TEAL_COLOR : "#6B7280",
              color: "#ffffff",
              padding: "3px 12px",
              borderRadius: "4px",
              fontSize: "10px",
              fontWeight: "bold",
              display: "flex",
            }}
          >
            {version === "original" ? t.original : t.copy}
          </div>

          {/* Main Content */}
          <div style={{ display: "flex", flexDirection: "column", padding: "32px 40px", flex: 1 }}>

            {/* Header Section */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
              {/* Left - Company Info (Seller) */}
              <div style={{ display: "flex", flexDirection: "column", maxWidth: "45%" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      backgroundColor: TEAL_COLOR,
                      borderRadius: "4px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#ffffff",
                      fontSize: "16px",
                      fontWeight: "bold",
                    }}
                  >
                    {companyName.charAt(0)}
                  </div>
                  <span style={{ fontSize: "14px", fontWeight: "bold", color: TEAL_COLOR }}>
                    {companyName}
                  </span>
                </div>
                {companyNameTh && (
                  <span style={{ fontSize: "9px", color: "#4B5563", marginLeft: "40px" }}>
                    {companyNameTh}
                  </span>
                )}
                {taxId && (
                  <span style={{ fontSize: "9px", color: "#6B7280", marginTop: "2px", marginLeft: "40px" }}>
                    {t.taxId} {taxId}
                  </span>
                )}
              </div>

              {/* Right - Tax Invoice Title & Customer Info */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", maxWidth: "50%" }}>
                <span style={{ fontSize: "26px", fontWeight: "300", color: TEAL_COLOR, letterSpacing: "1px" }}>
                  {t.taxInvoice}
                </span>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", marginTop: "6px" }}>
                  <span style={{ fontSize: "10px", color: "#4B5563" }}>{tenantName}</span>
                  <span style={{ fontSize: "9px", color: "#6B7280" }}>{unitNumber}</span>
                  {tenantTaxId && (
                    <span style={{ fontSize: "9px", color: "#6B7280" }}>
                      {t.taxId} {tenantTaxId}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Date and Invoice ID */}
            <div style={{ display: "flex", flexDirection: "column", marginBottom: "12px" }}>
              <span style={{ fontSize: "10px", color: "#4B5563" }}>
                {t.date}: {formatDate(dueDate)}
              </span>
              <span style={{ fontSize: "10px", color: "#4B5563" }}>
                {t.invoiceNo}: {invoiceNo}
              </span>
            </div>

            {/* Project Description */}
            <div style={{ display: "flex", flexDirection: "column", marginBottom: "10px" }}>
              <span style={{ fontSize: "10px", fontWeight: "bold", color: "#4B5563" }}>
                {t.projectDescription}
              </span>
              <span style={{ fontSize: "10px", color: "#6B7280" }}>
                {billingMonth}
              </span>
            </div>

            {/* Table */}
            <div style={{ display: "flex", flexDirection: "column", marginBottom: "12px" }}>
              {/* Table Header */}
              <div
                style={{
                  display: "flex",
                  backgroundColor: TEAL_COLOR,
                  borderRadius: "4px 4px 0 0",
                }}
              >
                <div style={{ flex: 3, padding: "8px 10px", display: "flex" }}>
                  <span style={{ fontSize: "11px", fontWeight: "bold", color: "#ffffff" }}>
                    {t.description}
                  </span>
                </div>
                <div style={{ flex: 1, padding: "8px 10px", display: "flex", justifyContent: "flex-end" }}>
                  <span style={{ fontSize: "11px", fontWeight: "bold", color: "#ffffff" }}>
                    {t.price}
                  </span>
                </div>
              </div>

              {/* Table Rows */}
              {lineItems.map((item, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    borderBottom: "1px solid #E5E7EB",
                    backgroundColor: index % 2 === 0 ? "#ffffff" : "#F9FAFB",
                  }}
                >
                  <div style={{ flex: 3, padding: "8px 10px", display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: "10px", color: "#111827" }}>{item.description}</span>
                    {item.previousReading !== undefined && item.currentReading !== undefined && (
                      <span style={{ fontSize: "8px", color: "#6B7280", marginTop: "2px" }}>
                        ({t.previousReading}: {item.previousReading} → {t.currentReading}: {item.currentReading} = {item.currentReading - item.previousReading} {t.units})
                      </span>
                    )}
                  </div>
                  <div style={{ flex: 1, padding: "8px 10px", display: "flex", justifyContent: "flex-end" }}>
                    <span style={{ fontSize: "10px", color: "#111827" }}>{formatCurrency(item.amount)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals Section */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
              <div style={{ display: "flex", flexDirection: "column", width: "160px", gap: "3px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "10px", color: "#6B7280" }}>{t.subTotal}</span>
                  <span style={{ fontSize: "10px", color: "#111827" }}>{formatCurrency(subtotal)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "10px", color: "#6B7280" }}>{t.vat}</span>
                  <span style={{ fontSize: "10px", color: "#111827" }}>{formatCurrency(vatAmount)}</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    borderTop: "1px solid #E5E7EB",
                    paddingTop: "3px",
                    marginTop: "3px",
                  }}
                >
                  <span style={{ fontSize: "11px", fontWeight: "bold", color: "#111827" }}>{t.totalAmount}</span>
                  <span style={{ fontSize: "11px", fontWeight: "bold", color: "#111827" }}>{formatCurrency(totalWithVat)}</span>
                </div>
              </div>
            </div>

            {/* Terms & Conditions */}
            <div style={{ display: "flex", flexDirection: "column", marginBottom: "10px" }}>
              <span style={{ fontSize: "9px", color: TEAL_COLOR, fontWeight: "bold" }}>
                {t.termsTitle} <span style={{ fontWeight: "normal", color: "#6B7280" }}>{t.termsText}</span>
              </span>
              <span style={{ fontSize: "9px", color: "#6B7280" }}>
                {t.paymentDueNote}
              </span>
            </div>

            {/* Payment Method */}
            <div style={{ display: "flex", flexDirection: "column", marginBottom: "16px" }}>
              <span style={{ fontSize: "9px", color: "#4B5563" }}>{t.paymentMethod}</span>
              <span style={{ fontSize: "9px", color: "#4B5563" }}>{t.bankLabel} {bankName}</span>
              <span style={{ fontSize: "9px", color: "#4B5563" }}>{t.accountNumber} {bankAccountNumber}</span>
              <span style={{ fontSize: "9px", color: "#4B5563" }}>{t.accountName} {bankAccountName}</span>
            </div>

            {/* Signature Section */}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "auto" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "160px" }}>
                <div
                  style={{
                    width: "120px",
                    borderBottom: "1px solid #9CA3AF",
                    height: "24px",
                    display: "flex",
                  }}
                />
                <span style={{ fontSize: "9px", color: "#6B7280", marginTop: "3px" }}>
                  {t.signatureOverPrintedName}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "160px" }}>
                <div
                  style={{
                    width: "120px",
                    borderBottom: "1px solid #9CA3AF",
                    height: "24px",
                    display: "flex",
                  }}
                />
                <span style={{ fontSize: "9px", color: "#6B7280", marginTop: "3px" }}>
                  {t.dateSigned}
                </span>
              </div>
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
