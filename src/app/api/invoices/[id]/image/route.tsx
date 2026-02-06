import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

const translations = {
  en: {
    taxInvoice: "Tax Invoice",
    invoiceNo: "Invoice ID",
    date: "Date",
    taxId: "Tax ID",
    projectDescription: "PROJECT DESCRIPTION:",
    description: "Description",
    quantity: "Quantity",
    price: "Price",
    total: "Total",
    subTotal: "Sub-Total",
    withholdingTax: "Withholding Tax",
    totalAmount: "Total",
    rent: "Monthly Rent",
    utility: "Utilities",
    combined: "Rent & Utilities",
    waterUsage: "Water Usage",
    electricityUsage: "Electricity Usage",
    previousReading: "Previous",
    currentReading: "Current",
    units: "Units",
    unitPrice: "Price/Unit",
    termsTitle: "Terms & Conditions:",
    termsText: "Above information is not an invoice and only an estimate of goods/services.",
    paymentDueNote: "Payment is due within 3 days.",
    paymentMethod: "Payment Method: Bank Transfer",
    bankName: "Bank Name:",
    accountNumber: "Account Number:",
    accountName: "Account Name:",
    signatureOverPrintedName: "Signature over printed name",
    dateSigned: "Date signed",
    original: "Original",
    copy: "Copy",
  },
  th: {
    taxInvoice: "Tax Invoice",
    invoiceNo: "Invoice ID",
    date: "Date",
    taxId: "เลขประจำตัวผู้เสียภาษี",
    projectDescription: "PROJECT DESCRIPTION:",
    description: "Description",
    quantity: "Quantity",
    price: "Price",
    total: "Total",
    subTotal: "Sub-Total",
    withholdingTax: "ภาษีหัก ณ ที่จ่าย",
    totalAmount: "Total",
    rent: "ค่าเช่ารายเดือน",
    utility: "ค่าสาธารณูปโภค",
    combined: "ค่าเช่าและสาธารณูปโภค",
    waterUsage: "ค่าน้ำประปา",
    electricityUsage: "ค่าไฟฟ้า",
    previousReading: "เลขก่อน",
    currentReading: "เลขหลัง",
    units: "หน่วย",
    unitPrice: "ราคา/หน่วย",
    termsTitle: "Terms & Conditions:",
    termsText: "Above information is not an invoice and only an estimate of goods/services.",
    paymentDueNote: "Payment is due within 3 days.",
    paymentMethod: "Payment Method: Bank Transfer",
    bankName: "Bank Name:",
    accountNumber: "Account Number:",
    accountName: "Account Name:",
    signatureOverPrintedName: "Signature over printed name",
    dateSigned: "Date signed",
    original: "ต้นฉบับ",
    copy: "สำเนา",
  },
};

// Primary teal color from NainaHub example
const TEAL_COLOR = "#2D8B8B";
const TEAL_LIGHT = "#E8F4F4";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const lang = (searchParams.get("lang") as "en" | "th") || "th";
    const version = (searchParams.get("version") as "original" | "copy") || "original";
    const t = translations[lang] || translations.th;

    const invoice = await prisma.invoice.findFirst({
      where: { id },
      include: {
        project: true,
        unit: true,
        tenant: true,
      },
    });

    if (!invoice) {
      return new Response("Invoice not found", { status: 404 });
    }

    const formatDate = (date: Date) => {
      return new Date(date).toLocaleDateString(lang === "th" ? "th-TH" : "en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    };

    const formatCurrency = (amount: number) => {
      return amount.toLocaleString(lang === "th" ? "th-TH" : "en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
    };

    const getTypeLabel = (type: string) => {
      switch (type) {
        case "RENT": return t.rent;
        case "UTILITY": return t.utility;
        case "COMBINED": return t.combined;
        default: return type;
      }
    };

    // Parse line items
    const lineItems = (invoice.lineItems as Array<{
      description: string;
      amount: number;
      quantity?: number;
      previousReading?: number;
      currentReading?: number;
      unitPrice?: number;
    }>) || [
      { description: getTypeLabel(invoice.type), amount: invoice.subtotal, quantity: 1 },
    ];

    // Use withholdingTax from invoice (only for company tenants)
    const withholdingTaxAmount = invoice.withholdingTax || 0;

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
              width: "150px",
              height: "150px",
              overflow: "hidden",
              display: "flex",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "-50px",
                left: "-100px",
                width: "200px",
                height: "40px",
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
              width: "200px",
              height: "200px",
              overflow: "hidden",
              display: "flex",
            }}
          >
            <div
              style={{
                position: "absolute",
                bottom: "-30px",
                right: "-100px",
                width: "300px",
                height: "50px",
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
              top: "20px",
              right: "20px",
              backgroundColor: version === "original" ? TEAL_COLOR : "#6B7280",
              color: "#ffffff",
              padding: "4px 16px",
              borderRadius: "4px",
              fontSize: "12px",
              fontWeight: "bold",
              display: "flex",
            }}
          >
            {version === "original" ? t.original : t.copy}
          </div>

          {/* Main Content */}
          <div style={{ display: "flex", flexDirection: "column", padding: "40px 50px", flex: 1 }}>

            {/* Header Section */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
              {/* Left - Company Info (Seller) */}
              <div style={{ display: "flex", flexDirection: "column", maxWidth: "45%" }}>
                {/* Logo placeholder - using company icon */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      backgroundColor: TEAL_COLOR,
                      borderRadius: "4px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#ffffff",
                      fontSize: "20px",
                      fontWeight: "bold",
                    }}
                  >
                    {(invoice.project.companyName || invoice.project.name).charAt(0)}
                  </div>
                  <span style={{ fontSize: "18px", fontWeight: "bold", color: TEAL_COLOR }}>
                    {invoice.project.companyName || invoice.project.name}
                  </span>
                </div>
                <span style={{ fontSize: "11px", color: "#4B5563", marginLeft: "50px" }}>
                  {invoice.project.companyNameTh || ""}
                </span>
                {invoice.project.companyAddress && (
                  <span style={{ fontSize: "10px", color: "#6B7280", marginTop: "4px", marginLeft: "50px" }}>
                    {invoice.project.companyAddress}
                  </span>
                )}
                {invoice.project.taxId && (
                  <span style={{ fontSize: "10px", color: "#6B7280", marginTop: "2px", marginLeft: "50px" }}>
                    {t.taxId} {invoice.project.taxId}
                  </span>
                )}
              </div>

              {/* Right - Tax Invoice Title & Customer Info */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", maxWidth: "50%" }}>
                <span style={{ fontSize: "32px", fontWeight: "300", color: TEAL_COLOR, letterSpacing: "2px" }}>
                  {t.taxInvoice}
                </span>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", marginTop: "8px" }}>
                  <span style={{ fontSize: "11px", color: "#4B5563" }}>
                    {lang === "th" && invoice.tenant.nameTh ? invoice.tenant.nameTh : invoice.tenant.name}
                  </span>
                  <span style={{ fontSize: "10px", color: "#6B7280" }}>
                    {invoice.unit.unitNumber}
                  </span>
                  {invoice.tenant.taxId && (
                    <span style={{ fontSize: "10px", color: "#6B7280" }}>
                      {t.taxId} {invoice.tenant.taxId}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Date and Invoice ID */}
            <div style={{ display: "flex", flexDirection: "column", marginBottom: "16px" }}>
              <span style={{ fontSize: "11px", color: "#4B5563" }}>
                {t.date}: {formatDate(invoice.createdAt)}
              </span>
              <span style={{ fontSize: "11px", color: "#4B5563" }}>
                {t.invoiceNo}: {invoice.invoiceNo}
              </span>
            </div>

            {/* Project Description */}
            <div style={{ display: "flex", flexDirection: "column", marginBottom: "12px" }}>
              <span style={{ fontSize: "11px", fontWeight: "bold", color: "#4B5563" }}>
                {t.projectDescription}
              </span>
              <span style={{ fontSize: "11px", color: "#6B7280" }}>
                {invoice.project.name}: {invoice.notes || getTypeLabel(invoice.type)}
              </span>
            </div>

            {/* Table */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                marginBottom: "16px",
              }}
            >
              {/* Table Header */}
              <div
                style={{
                  display: "flex",
                  backgroundColor: TEAL_COLOR,
                  borderRadius: "4px 4px 0 0",
                }}
              >
                <div style={{ flex: 3, padding: "10px 12px", display: "flex" }}>
                  <span style={{ fontSize: "12px", fontWeight: "bold", color: "#ffffff" }}>
                    {t.description}
                  </span>
                </div>
                <div style={{ flex: 1, padding: "10px 12px", display: "flex", justifyContent: "flex-end" }}>
                  <span style={{ fontSize: "12px", fontWeight: "bold", color: "#ffffff" }}>
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
                  <div style={{ flex: 3, padding: "10px 12px", display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: "11px", color: "#111827" }}>{item.description}</span>
                    {/* Show meter readings if available */}
                    {item.previousReading !== undefined && item.currentReading !== undefined && (
                      <span style={{ fontSize: "9px", color: "#6B7280", marginTop: "2px" }}>
                        ({t.previousReading}: {item.previousReading} → {t.currentReading}: {item.currentReading} = {item.currentReading - item.previousReading} {t.units})
                      </span>
                    )}
                  </div>
                  <div style={{ flex: 1, padding: "10px 12px", display: "flex", justifyContent: "flex-end" }}>
                    <span style={{ fontSize: "11px", color: "#111827" }}>{formatCurrency(item.amount)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals Section */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
              <div style={{ display: "flex", flexDirection: "column", width: "200px", gap: "4px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "11px", color: "#6B7280" }}>{t.subTotal}</span>
                  <span style={{ fontSize: "11px", color: "#111827" }}>{formatCurrency(invoice.subtotal)}</span>
                </div>
                {withholdingTaxAmount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "11px", color: "#6B7280" }}>{t.withholdingTax}</span>
                    <span style={{ fontSize: "11px", color: "#111827" }}>-{formatCurrency(withholdingTaxAmount)}</span>
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    borderTop: "1px solid #E5E7EB",
                    paddingTop: "4px",
                    marginTop: "4px",
                  }}
                >
                  <span style={{ fontSize: "12px", fontWeight: "bold", color: "#111827" }}>{t.totalAmount}</span>
                  <span style={{ fontSize: "12px", fontWeight: "bold", color: "#111827" }}>{formatCurrency(invoice.totalAmount)}</span>
                </div>
              </div>
            </div>

            {/* Terms & Conditions */}
            <div style={{ display: "flex", flexDirection: "column", marginBottom: "12px" }}>
              <span style={{ fontSize: "10px", color: TEAL_COLOR, fontWeight: "bold" }}>
                {t.termsTitle} <span style={{ fontWeight: "normal", color: "#6B7280" }}>{t.termsText}</span>
              </span>
              <span style={{ fontSize: "10px", color: "#6B7280" }}>
                {t.paymentDueNote}
              </span>
            </div>

            {/* Payment Method */}
            <div style={{ display: "flex", flexDirection: "column", marginBottom: "20px" }}>
              <span style={{ fontSize: "10px", color: "#4B5563" }}>{t.paymentMethod}</span>
              <span style={{ fontSize: "10px", color: "#4B5563" }}>{t.bankName} KBANK</span>
              <span style={{ fontSize: "10px", color: "#4B5563" }}>{t.accountNumber} 155-3-41841-7</span>
              <span style={{ fontSize: "10px", color: "#4B5563" }}>{t.accountName} {invoice.project.companyName || invoice.project.name}</span>
            </div>

            {/* Signature Section */}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "auto" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "200px" }}>
                <div
                  style={{
                    width: "150px",
                    borderBottom: "1px solid #9CA3AF",
                    height: "30px",
                    display: "flex",
                  }}
                />
                <span style={{ fontSize: "10px", color: "#6B7280", marginTop: "4px" }}>
                  {t.signatureOverPrintedName}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "200px" }}>
                <div
                  style={{
                    width: "150px",
                    borderBottom: "1px solid #9CA3AF",
                    height: "30px",
                    display: "flex",
                  }}
                />
                <span style={{ fontSize: "10px", color: "#6B7280", marginTop: "4px" }}>
                  {t.dateSigned}
                </span>
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width: 800,
        height: 1000,
      }
    );
  } catch (error) {
    console.error("Error generating invoice image:", error);
    return new Response("Error generating image", { status: 500 });
  }
}
