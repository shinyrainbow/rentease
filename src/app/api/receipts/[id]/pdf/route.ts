import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { uploadFile, getPresignedUrl, getS3Key } from "@/lib/s3";
import { jsPDF } from "jspdf";

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
    amount: "Amount (THB)",
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
    amount: "จำนวนเงิน (บาท)",
    total: "รวมเงินที่รับ",
    payment: "ชำระเงิน",
    thankYou: "ขอบคุณที่ชำระเงิน",
  },
};

function formatCurrency(amount: number): string {
  return amount.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(date: Date, lang: "en" | "th"): string {
  return new Date(date).toLocaleDateString(lang === "th" ? "th-TH" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { lang = "th" } = await request.json();
    const t = translations[lang as "en" | "th"] || translations.th;

    const receipt = await prisma.receipt.findFirst({
      where: { id, invoice: { project: { ownerId: session.user.id } } },
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
      return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
    }

    // Generate PDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // Company header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(receipt.invoice.project.companyName || receipt.invoice.project.name, pageWidth / 2, y, { align: "center" });
    y += 8;

    if (receipt.invoice.project.companyAddress) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(receipt.invoice.project.companyAddress, pageWidth / 2, y, { align: "center" });
      y += 6;
    }

    if (receipt.invoice.project.taxId) {
      doc.text(`${t.taxId}: ${receipt.invoice.project.taxId}`, pageWidth / 2, y, { align: "center" });
      y += 6;
    }

    y += 10;

    // Receipt title
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 163, 74); // Green
    doc.text(t.receipt, pageWidth / 2, y, { align: "center" });
    doc.setTextColor(0, 0, 0);
    y += 12;

    // Receipt details
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`${t.receiptNo}: ${receipt.receiptNo}`, 20, y);
    doc.text(`${t.date}: ${formatDate(receipt.issuedAt, lang as "en" | "th")}`, pageWidth - 60, y);
    y += 6;
    doc.text(`${t.invoiceRef}: ${receipt.invoice.invoiceNo}`, 20, y);
    y += 12;

    // Received from section
    doc.setFont("helvetica", "bold");
    doc.text(`${t.receivedFrom}:`, 20, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    const tenantName = lang === "th" && receipt.invoice.tenant.nameTh ? receipt.invoice.tenant.nameTh : receipt.invoice.tenant.name;
    doc.text(tenantName, 20, y);
    y += 5;
    doc.text(`${t.unit}: ${receipt.invoice.unit.unitNumber}`, 20, y);
    y += 5;
    if (receipt.invoice.tenant.phone) {
      doc.text(`${t.phone}: ${receipt.invoice.tenant.phone}`, 20, y);
      y += 5;
    }
    if (receipt.invoice.tenant.taxId) {
      doc.text(`${t.taxId}: ${receipt.invoice.tenant.taxId}`, 20, y);
      y += 5;
    }
    y += 10;

    // Amount table header
    doc.setFillColor(22, 163, 74); // Green
    doc.rect(20, y, pageWidth - 40, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(t.description, 25, y + 6);
    doc.text(t.amount, pageWidth - 45, y + 6, { align: "right" });
    y += 12;

    // Reset text color
    doc.setTextColor(0, 0, 0);

    // Payment row
    doc.setFont("helvetica", "normal");
    doc.setFillColor(240, 253, 244); // Light green
    doc.rect(20, y - 4, pageWidth - 40, 10, "F");
    doc.text(`${t.payment} - ${receipt.invoice.invoiceNo}`, 25, y + 2);
    doc.setTextColor(22, 163, 74);
    doc.text(formatCurrency(receipt.amount), pageWidth - 45, y + 2, { align: "right" });
    doc.setTextColor(0, 0, 0);
    y += 15;

    // Total box
    doc.setFillColor(22, 163, 74);
    doc.rect(pageWidth - 100, y, 80, 12, "F");
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(t.total, pageWidth - 95, y + 8);
    doc.text(formatCurrency(receipt.amount), pageWidth - 25, y + 8, { align: "right" });
    doc.setTextColor(0, 0, 0);

    // Footer
    y = doc.internal.pageSize.getHeight() - 20;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(107, 114, 128);
    doc.text(t.thankYou, pageWidth / 2, y, { align: "center" });

    // Get PDF as buffer
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

    // Upload to S3
    const s3Key = getS3Key("receipt", receipt.id, lang);
    await uploadFile(s3Key, pdfBuffer, "application/pdf");

    // Generate pre-signed URL (valid for 1 hour)
    const presignedUrl = await getPresignedUrl(s3Key, 3600);

    return NextResponse.json({
      success: true,
      url: presignedUrl,
      key: s3Key,
      fileName: `Receipt-${receipt.receiptNo}.pdf`,
    });
  } catch (error) {
    console.error("Error generating PDF:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
