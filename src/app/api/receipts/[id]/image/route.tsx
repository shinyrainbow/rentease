import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

const translations = {
  en: {
    receipt: "RECEIPT",
    receiptNo: "Receipt No",
    date: "Date",
    invoiceRef: "Invoice Reference",
    receivedFrom: "Received From",
    unit: "Unit",
    phone: "Phone",
    taxId: "Tax ID",
    description: "Description",
    amount: "Amount",
    total: "Total Received",
    payment: "Payment",
    thankYou: "Thank you for your payment",
  },
  th: {
    receipt: "ใบเสร็จรับเงิน",
    receiptNo: "เลขที่",
    date: "วันที่",
    invoiceRef: "อ้างอิงใบแจ้งหนี้",
    receivedFrom: "รับเงินจาก",
    unit: "ห้อง",
    phone: "โทร",
    taxId: "เลขประจำตัวผู้เสียภาษี",
    description: "รายการ",
    amount: "จำนวนเงิน",
    total: "รวมเงินที่รับ",
    payment: "ชำระเงิน",
    thankYou: "ขอบคุณที่ชำระเงิน",
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
                {receipt.invoice.project.companyName || receipt.invoice.project.name}
              </span>
              {receipt.invoice.project.companyAddress && (
                <span style={{ fontSize: "14px", color: "#6b7280", marginTop: "4px" }}>
                  {receipt.invoice.project.companyAddress}
                </span>
              )}
              {receipt.invoice.project.taxId && (
                <span style={{ fontSize: "14px", color: "#6b7280", marginTop: "2px" }}>
                  {t.taxId}: {receipt.invoice.project.taxId}
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
              <span style={{ fontSize: "32px", fontWeight: "bold", color: "#16a34a" }}>
                {t.receipt}
              </span>
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: "bold",
                  color: "#16a34a",
                  backgroundColor: "#dcfce7",
                  padding: "4px 12px",
                  borderRadius: "9999px",
                  marginTop: "8px",
                }}
              >
                PAID
              </span>
            </div>
          </div>

          {/* Receipt Info */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              backgroundColor: "#f0fdf4",
              padding: "20px",
              borderRadius: "8px",
              marginBottom: "24px",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", gap: "8px" }}>
                <span style={{ fontSize: "14px", color: "#6b7280" }}>{t.receiptNo}:</span>
                <span style={{ fontSize: "14px", fontWeight: "bold", color: "#111827" }}>
                  {receipt.receiptNo}
                </span>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <span style={{ fontSize: "14px", color: "#6b7280" }}>{t.invoiceRef}:</span>
                <span style={{ fontSize: "14px", color: "#111827" }}>{receipt.invoice.invoiceNo}</span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-end" }}>
              <div style={{ display: "flex", gap: "8px" }}>
                <span style={{ fontSize: "14px", color: "#6b7280" }}>{t.date}:</span>
                <span style={{ fontSize: "14px", color: "#111827" }}>{formatDate(receipt.issuedAt)}</span>
              </div>
            </div>
          </div>

          {/* Received From */}
          <div style={{ display: "flex", flexDirection: "column", marginBottom: "24px" }}>
            <span style={{ fontSize: "14px", fontWeight: "bold", color: "#6b7280", marginBottom: "8px" }}>
              {t.receivedFrom}
            </span>
            <span style={{ fontSize: "18px", fontWeight: "bold", color: "#111827" }}>
              {lang === "th" && receipt.invoice.tenant.nameTh ? receipt.invoice.tenant.nameTh : receipt.invoice.tenant.name}
            </span>
            <span style={{ fontSize: "14px", color: "#6b7280", marginTop: "4px" }}>
              {t.unit}: {receipt.invoice.unit.unitNumber}
            </span>
            {receipt.invoice.tenant.phone && (
              <span style={{ fontSize: "14px", color: "#6b7280", marginTop: "2px" }}>
                {t.phone}: {receipt.invoice.tenant.phone}
              </span>
            )}
          </div>

          {/* Amount Box */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              border: "2px solid #16a34a",
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
                backgroundColor: "#16a34a",
                padding: "12px 20px",
              }}
            >
              <span style={{ fontSize: "14px", fontWeight: "bold", color: "#ffffff" }}>{t.description}</span>
              <span style={{ fontSize: "14px", fontWeight: "bold", color: "#ffffff" }}>{t.amount}</span>
            </div>
            {/* Payment Row */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "16px 20px",
                backgroundColor: "#ffffff",
              }}
            >
              <span style={{ fontSize: "16px", color: "#111827" }}>{t.payment} - {receipt.invoice.invoiceNo}</span>
              <span style={{ fontSize: "16px", fontWeight: "bold", color: "#16a34a" }}>฿{formatCurrency(receipt.amount)}</span>
            </div>
          </div>

          {/* Total */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "24px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                width: "300px",
                backgroundColor: "#16a34a",
                padding: "16px 20px",
                borderRadius: "8px",
              }}
            >
              <span style={{ fontSize: "18px", fontWeight: "bold", color: "#ffffff" }}>{t.total}</span>
              <span style={{ fontSize: "18px", fontWeight: "bold", color: "#ffffff" }}>
                ฿{formatCurrency(receipt.amount)}
              </span>
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
    console.error("Error generating receipt image:", error);
    return new Response("Error generating image", { status: 500 });
  }
}
