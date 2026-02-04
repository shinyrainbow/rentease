import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

const translations = {
  en: {
    invoice: "INVOICE",
    invoiceNo: "Invoice No",
    date: "Date",
    billingMonth: "Billing Month",
    dueDate: "Due Date",
    billTo: "Bill To",
    unit: "Unit",
    phone: "Phone",
    taxId: "Tax ID",
    description: "Description",
    amount: "Amount",
    subtotal: "Subtotal",
    discount: "Discount",
    tax: "Withholding Tax",
    total: "Total",
    rent: "Monthly Rent",
    utility: "Utilities",
    combined: "Rent & Utilities",
    status: "Status",
    paid: "PAID",
    pending: "PENDING",
    overdue: "OVERDUE",
    partial: "PARTIAL",
    thankYou: "Thank you for your business",
  },
  th: {
    invoice: "ใบแจ้งหนี้",
    invoiceNo: "เลขที่",
    date: "วันที่",
    billingMonth: "รอบบิล",
    dueDate: "กำหนดชำระ",
    billTo: "เรียกเก็บจาก",
    unit: "ห้อง",
    phone: "โทร",
    taxId: "เลขประจำตัวผู้เสียภาษี",
    description: "รายการ",
    amount: "จำนวนเงิน",
    subtotal: "รวม",
    discount: "ส่วนลด",
    tax: "หัก ณ ที่จ่าย",
    total: "ยอดรวมทั้งสิ้น",
    rent: "ค่าเช่ารายเดือน",
    utility: "ค่าสาธารณูปโภค",
    combined: "ค่าเช่าและสาธารณูปโภค",
    status: "สถานะ",
    paid: "ชำระแล้ว",
    pending: "รอชำระ",
    overdue: "เกินกำหนด",
    partial: "ชำระบางส่วน",
    thankYou: "ขอบคุณที่ใช้บริการ",
  },
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const lang = (searchParams.get("lang") as "en" | "th") || "th";
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
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
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

    const getStatusColor = (status: string) => {
      switch (status) {
        case "PAID": return "#16a34a";
        case "PENDING": return "#ca8a04";
        case "OVERDUE": return "#dc2626";
        case "PARTIAL": return "#2563eb";
        default: return "#6b7280";
      }
    };

    const getStatusLabel = (status: string) => {
      switch (status) {
        case "PAID": return t.paid;
        case "PENDING": return t.pending;
        case "OVERDUE": return t.overdue;
        case "PARTIAL": return t.partial;
        default: return status;
      }
    };

    const lineItems = (invoice.lineItems as Array<{ description: string; amount: number }>) || [
      { description: getTypeLabel(invoice.type), amount: invoice.subtotal },
    ];

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
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "30px" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "28px", fontWeight: "bold", color: "#111827" }}>
                {invoice.project.companyName || invoice.project.name}
              </span>
              {invoice.project.companyAddress && (
                <span style={{ fontSize: "14px", color: "#6b7280", marginTop: "4px" }}>
                  {invoice.project.companyAddress}
                </span>
              )}
              {invoice.project.taxId && (
                <span style={{ fontSize: "14px", color: "#6b7280", marginTop: "2px" }}>
                  {t.taxId}: {invoice.project.taxId}
                </span>
              )}
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
              }}
            >
              <span style={{ fontSize: "32px", fontWeight: "bold", color: "#3b82f6" }}>
                {t.invoice}
              </span>
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: "bold",
                  color: getStatusColor(invoice.status),
                  backgroundColor: `${getStatusColor(invoice.status)}20`,
                  padding: "4px 12px",
                  borderRadius: "9999px",
                  marginTop: "8px",
                }}
              >
                {getStatusLabel(invoice.status)}
              </span>
            </div>
          </div>

          {/* Invoice Info */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              backgroundColor: "#f9fafb",
              padding: "20px",
              borderRadius: "8px",
              marginBottom: "24px",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", gap: "8px" }}>
                <span style={{ fontSize: "14px", color: "#6b7280" }}>{t.invoiceNo}:</span>
                <span style={{ fontSize: "14px", fontWeight: "bold", color: "#111827" }}>
                  {invoice.invoiceNo}
                </span>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <span style={{ fontSize: "14px", color: "#6b7280" }}>{t.billingMonth}:</span>
                <span style={{ fontSize: "14px", color: "#111827" }}>{invoice.billingMonth}</span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-end" }}>
              <div style={{ display: "flex", gap: "8px" }}>
                <span style={{ fontSize: "14px", color: "#6b7280" }}>{t.date}:</span>
                <span style={{ fontSize: "14px", color: "#111827" }}>{formatDate(invoice.createdAt)}</span>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <span style={{ fontSize: "14px", color: "#6b7280" }}>{t.dueDate}:</span>
                <span style={{ fontSize: "14px", fontWeight: "bold", color: "#dc2626" }}>
                  {formatDate(invoice.dueDate)}
                </span>
              </div>
            </div>
          </div>

          {/* Bill To */}
          <div style={{ display: "flex", flexDirection: "column", marginBottom: "24px" }}>
            <span style={{ fontSize: "14px", fontWeight: "bold", color: "#6b7280", marginBottom: "8px" }}>
              {t.billTo}
            </span>
            <span style={{ fontSize: "18px", fontWeight: "bold", color: "#111827" }}>
              {lang === "th" && invoice.tenant.nameTh ? invoice.tenant.nameTh : invoice.tenant.name}
            </span>
            <span style={{ fontSize: "14px", color: "#6b7280", marginTop: "4px" }}>
              {t.unit}: {invoice.unit.unitNumber}
            </span>
            {invoice.tenant.phone && (
              <span style={{ fontSize: "14px", color: "#6b7280", marginTop: "2px" }}>
                {t.phone}: {invoice.tenant.phone}
              </span>
            )}
          </div>

          {/* Line Items */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              overflow: "hidden",
              marginBottom: "24px",
            }}
          >
            {/* Table Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                backgroundColor: "#3b82f6",
                padding: "12px 20px",
              }}
            >
              <span style={{ fontSize: "14px", fontWeight: "bold", color: "#ffffff" }}>{t.description}</span>
              <span style={{ fontSize: "14px", fontWeight: "bold", color: "#ffffff" }}>{t.amount}</span>
            </div>
            {/* Table Rows */}
            {lineItems.map((item, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "12px 20px",
                  backgroundColor: index % 2 === 0 ? "#ffffff" : "#f9fafb",
                  borderTop: "1px solid #e5e7eb",
                }}
              >
                <span style={{ fontSize: "14px", color: "#111827" }}>{item.description}</span>
                <span style={{ fontSize: "14px", color: "#111827" }}>฿{formatCurrency(item.amount)}</span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <div style={{ display: "flex", flexDirection: "column", width: "250px", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "14px", color: "#6b7280" }}>{t.subtotal}</span>
                <span style={{ fontSize: "14px", color: "#111827" }}>฿{formatCurrency(invoice.subtotal)}</span>
              </div>
              {invoice.discountAmount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "14px", color: "#6b7280" }}>{t.discount}</span>
                  <span style={{ fontSize: "14px", color: "#16a34a" }}>-฿{formatCurrency(invoice.discountAmount)}</span>
                </div>
              )}
              {invoice.withholdingTax > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "14px", color: "#6b7280" }}>{t.tax}</span>
                  <span style={{ fontSize: "14px", color: "#111827" }}>-฿{formatCurrency(invoice.withholdingTax)}</span>
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  borderTop: "2px solid #3b82f6",
                  paddingTop: "8px",
                  marginTop: "4px",
                }}
              >
                <span style={{ fontSize: "18px", fontWeight: "bold", color: "#111827" }}>{t.total}</span>
                <span style={{ fontSize: "18px", fontWeight: "bold", color: "#3b82f6" }}>
                  ฿{formatCurrency(invoice.totalAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: "auto",
              paddingTop: "20px",
            }}
          >
            <span style={{ fontSize: "14px", color: "#6b7280" }}>{t.thankYou}</span>
          </div>
        </div>
      ),
      {
        width: 800,
        height: 600,
      }
    );
  } catch (error) {
    console.error("Error generating invoice image:", error);
    return new Response("Error generating image", { status: 500 });
  }
}
