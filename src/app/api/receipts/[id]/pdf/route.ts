import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { uploadFile, getPresignedUrl, getS3Key } from "@/lib/s3";
import { createPDFWithThaiFont, setThaiFont } from "@/lib/pdf-fonts";

interface LineItem {
  description: string;
  amount: number;
  quantity?: number;
  unitPrice?: number;
  usage?: number;
  rate?: number;
}

const translations = {
  en: {
    receipt: "RECEIPT",
    original: "Original",
    copy: "Copy",
    receiptNo: "Receipt No",
    date: "Date",
    referenceInvoice: "Ref. Invoice",
    billingMonth: "Billing Month",
    receivedFrom: "Received From",
    unit: "Unit",
    phone: "Phone",
    taxId: "Tax ID",
    description: "Description",
    qtyUnit: "Units",
    unitPrice: "Unit Price",
    amount: "Amount (THB)",
    subtotal: "Subtotal",
    withholdingTax: "Withholding Tax",
    total: "Total",
    thankYou: "Thank you for your payment",
    bankInfo: "Bank Account Information",
    bankName: "Bank",
    accountNumber: "Account No",
    accountName: "Account Name",
    receiver: "Receiver",
  },
  th: {
    receipt: "ใบเสร็จรับเงิน",
    original: "ต้นฉบับ",
    copy: "สำเนา",
    receiptNo: "เลขที่",
    date: "วันที่",
    referenceInvoice: "อ้างอิงใบแจ้งหนี้",
    billingMonth: "รอบบิล",
    receivedFrom: "รับเงินจาก",
    unit: "ห้อง",
    phone: "โทร",
    taxId: "เลขประจำตัวผู้เสียภาษี",
    description: "รายการ",
    qtyUnit: "ยูนิต",
    unitPrice: "ราคา/หน่วย",
    amount: "จำนวนเงิน (บาท)",
    subtotal: "รวม",
    withholdingTax: "หัก ณ ที่จ่าย",
    total: "ยอดรวมทั้งสิ้น",
    thankYou: "ขอบคุณที่ชำระเงิน",
    bankInfo: "ข้อมูลบัญชีธนาคาร",
    bankName: "ธนาคาร",
    accountNumber: "เลขบัญชี",
    accountName: "ชื่อบัญชี",
    receiver: "ผู้รับเงิน",
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
            project: {
              include: {
                owner: { select: { name: true } },
              },
            },
            unit: true,
            tenant: true,
          },
        },
      },
    });

    if (!receipt) {
      return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
    }

    // Generate PDF with Thai font support
    const doc = await createPDFWithThaiFont();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // Company header
    const companyName = receipt.invoice.project.companyName || receipt.invoice.project.name;

    doc.setFontSize(18);
    setThaiFont(doc, "bold");
    doc.text(companyName, pageWidth / 2, y, { align: "center" });
    y += 8;

    if (receipt.invoice.project.companyAddress) {
      doc.setFontSize(10);
      setThaiFont(doc, "normal");
      doc.text(receipt.invoice.project.companyAddress, pageWidth / 2, y, { align: "center" });
      y += 6;
    }

    if (receipt.invoice.project.taxId) {
      doc.text(`${t.taxId}: ${receipt.invoice.project.taxId}`, pageWidth / 2, y, { align: "center" });
      y += 6;
    }

    y += 5;

    // Separator line
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(20, y, pageWidth - 20, y);
    y += 10;

    // Receipt title (green)
    doc.setFontSize(16);
    setThaiFont(doc, "bold");
    doc.setTextColor(22, 163, 74);
    doc.text(t.receipt, pageWidth / 2, y, { align: "center" });
    doc.setTextColor(0, 0, 0);
    y += 12;

    // Receipt details
    doc.setFontSize(10);
    setThaiFont(doc, "normal");
    doc.text(`${t.receiptNo}: ${receipt.receiptNo}`, 20, y);
    doc.text(`${t.date}: ${formatDate(receipt.issuedAt, lang as "en" | "th")}`, pageWidth - 60, y);
    y += 6;
    doc.text(`${t.referenceInvoice}: ${receipt.invoice.invoiceNo}`, 20, y);
    doc.text(`${t.billingMonth}: ${receipt.invoice.billingMonth}`, pageWidth - 60, y);
    y += 12;

    // Received from section
    setThaiFont(doc, "bold");
    doc.text(`${t.receivedFrom}:`, 20, y);
    y += 6;
    setThaiFont(doc, "normal");
    const tenantName = lang === "th" && receipt.invoice.tenant.nameTh ? receipt.invoice.tenant.nameTh : receipt.invoice.tenant.name;
    doc.text(tenantName, 20, y);
    y += 5;
    if (receipt.invoice.tenant.address) {
      doc.text(receipt.invoice.tenant.address, 20, y);
      y += 5;
    }
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

    // Line items
    const lineItems: LineItem[] = (receipt.invoice.lineItems as unknown as LineItem[]) || [];

    // Check if any line item has usage (utility items)
    const hasUtilityItems = lineItems.some(item => item.usage !== undefined);

    // Line items table header (green)
    doc.setFillColor(22, 163, 74);
    doc.rect(20, y, pageWidth - 40, 8, "F");
    setThaiFont(doc, "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(t.description, 25, y + 6);
    if (hasUtilityItems) {
      doc.text(t.qtyUnit, 100, y + 6, { align: "center" });
      doc.text(t.unitPrice, 130, y + 6, { align: "right" });
    }
    doc.text(t.amount, pageWidth - 45, y + 6, { align: "right" });
    y += 12;

    // Reset text color
    doc.setTextColor(0, 0, 0);

    // Line items rows
    setThaiFont(doc, "normal");
    lineItems.forEach((item, index) => {
      if (index % 2 === 0) {
        doc.setFillColor(240, 253, 244);
        doc.rect(20, y - 3, pageWidth - 40, 6, "F");
      }
      doc.text(item.description, 25, y);
      if (hasUtilityItems) {
        // Only show units/rate for utility items
        if (item.usage !== undefined) {
          doc.text(String(item.usage), 100, y, { align: "center" });
          doc.text(formatCurrency(item.rate || item.unitPrice || 0), 130, y, { align: "right" });
        } else {
          doc.text("-", 100, y, { align: "center" });
          doc.text("-", 130, y, { align: "right" });
        }
      }
      doc.text(formatCurrency(item.amount), pageWidth - 45, y, { align: "right" });
      y += 6;
    });

    y += 5;
    doc.line(20, y, pageWidth - 20, y);
    y += 10;

    // Totals section
    const totalsX = pageWidth - 90;

    doc.text(t.subtotal, totalsX, y);
    doc.text(formatCurrency(receipt.invoice.subtotal), pageWidth - 25, y, { align: "right" });
    y += 7;

    if (receipt.invoice.withholdingTax > 0) {
      doc.text(t.withholdingTax, totalsX, y);
      doc.text(`-${formatCurrency(receipt.invoice.withholdingTax)}`, pageWidth - 25, y, { align: "right" });
      y += 7;
    }

    // Total line (green)
    doc.setDrawColor(22, 163, 74);
    doc.setLineWidth(0.5);
    doc.line(totalsX - 5, y, pageWidth - 20, y);
    y += 8;

    setThaiFont(doc, "bold");
    doc.setFontSize(12);
    doc.text(t.total, totalsX, y);
    doc.setTextColor(22, 163, 74);
    doc.text(formatCurrency(receipt.amount), pageWidth - 25, y, { align: "right" });
    doc.setTextColor(0, 0, 0);

    y += 20;

    // Bank Account Information
    if (receipt.invoice.project.bankName || receipt.invoice.project.bankAccountNumber) {
      doc.setFontSize(10);
      setThaiFont(doc, "bold");
      doc.text(t.bankInfo, 20, y);
      y += 6;
      setThaiFont(doc, "normal");
      if (receipt.invoice.project.bankName) {
        doc.text(`${t.bankName}: ${receipt.invoice.project.bankName}`, 20, y);
        y += 5;
      }
      if (receipt.invoice.project.bankAccountNumber) {
        doc.text(`${t.accountNumber}: ${receipt.invoice.project.bankAccountNumber}`, 20, y);
        y += 5;
      }
      if (receipt.invoice.project.bankAccountName) {
        doc.text(`${t.accountName}: ${receipt.invoice.project.bankAccountName}`, 20, y);
        y += 5;
      }
      y += 10;
    }

    // Receiver Signature Section
    setThaiFont(doc, "bold");
    doc.text(t.receiver, 20, y);
    y += 15;
    doc.setLineWidth(0.3);
    doc.setDrawColor(150, 150, 150);
    doc.line(20, y, 80, y);
    y += 5;
    setThaiFont(doc, "normal");
    doc.setFontSize(9);
    const ownerName = receipt.invoice.project.owner?.name || "";
    doc.text(ownerName, 50, y, { align: "center" });

    // Footer
    y = doc.internal.pageSize.getHeight() - 20;
    doc.setFontSize(10);
    setThaiFont(doc, "normal");
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
