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
    qtyUnit: "Units",
    unitPrice: "Unit Price",
    amount: "Amount (THB)",
    subtotal: "Subtotal",
    discount: "Discount",
    withholdingTax: "Withholding Tax",
    total: "Total",
    rent: "Monthly Rent",
    utility: "Utilities",
    combined: "Rent & Utilities",
    thankYou: "Thank you for your business",
    page: "Page",
    bankInfo: "Bank Account Information",
    bankName: "Bank",
    accountNumber: "Account No",
    accountName: "Account Name",
    biller: "Biller",
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
    qtyUnit: "ยูนิต",
    unitPrice: "ราคา/หน่วย",
    amount: "จำนวนเงิน (บาท)",
    subtotal: "รวม",
    discount: "ส่วนลด",
    withholdingTax: "หัก ณ ที่จ่าย",
    total: "ยอดรวมทั้งสิ้น",
    rent: "ค่าเช่ารายเดือน",
    utility: "ค่าสาธารณูปโภค",
    combined: "ค่าเช่าและสาธารณูปโภค",
    thankYou: "ขอบคุณที่ใช้บริการ",
    page: "หน้า",
    bankInfo: "ข้อมูลบัญชีธนาคาร",
    bankName: "ธนาคาร",
    accountNumber: "เลขบัญชี",
    accountName: "ชื่อบัญชี",
    biller: "ผู้วางบิล",
  },
};

function getTypeLabel(type: string, lang: "en" | "th") {
  const t = translations[lang];
  switch (type) {
    case "RENT": return t.rent;
    case "UTILITY": return t.utility;
    case "COMBINED": return t.combined;
    default: return type;
  }
}

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

    const invoice = await prisma.invoice.findFirst({
      where: { id, project: { ownerId: session.user.id } },
      include: {
        project: {
          include: {
            owner: { select: { name: true } },
          },
        },
        unit: true,
        tenant: true,
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Generate PDF with Thai font support
    const doc = await createPDFWithThaiFont();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // Company header
    doc.setFontSize(18);
    setThaiFont(doc, "bold");
    doc.text(invoice.project.companyName || invoice.project.name, pageWidth / 2, y, { align: "center" });
    y += 8;

    if (invoice.project.companyAddress) {
      doc.setFontSize(10);
      setThaiFont(doc, "normal");
      doc.text(invoice.project.companyAddress, pageWidth / 2, y, { align: "center" });
      y += 6;
    }

    if (invoice.project.taxId) {
      doc.text(`${t.taxId}: ${invoice.project.taxId}`, pageWidth / 2, y, { align: "center" });
      y += 6;
    }

    y += 10;

    // Invoice title
    doc.setFontSize(16);
    setThaiFont(doc, "bold");
    doc.text(t.invoice, pageWidth / 2, y, { align: "center" });
    y += 12;

    // Invoice details
    doc.setFontSize(10);
    setThaiFont(doc, "normal");
    doc.text(`${t.invoiceNo}: ${invoice.invoiceNo}`, 20, y);
    doc.text(`${t.date}: ${formatDate(invoice.createdAt, lang as "en" | "th")}`, pageWidth - 60, y);
    y += 6;
    doc.text(`${t.billingMonth}: ${invoice.billingMonth}`, 20, y);
    doc.text(`${t.dueDate}: ${formatDate(invoice.dueDate, lang as "en" | "th")}`, pageWidth - 60, y);
    y += 12;

    // Bill to section
    setThaiFont(doc, "bold");
    doc.text(`${t.billTo}:`, 20, y);
    y += 6;
    setThaiFont(doc, "normal");
    const tenantName = lang === "th" && invoice.tenant.nameTh ? invoice.tenant.nameTh : invoice.tenant.name;
    doc.text(tenantName, 20, y);
    y += 5;
    if (invoice.tenant.address) {
      doc.text(invoice.tenant.address, 20, y);
      y += 5;
    }
    doc.text(`${t.unit}: ${invoice.unit.unitNumber}`, 20, y);
    y += 5;
    if (invoice.tenant.phone) {
      doc.text(`${t.phone}: ${invoice.tenant.phone}`, 20, y);
      y += 5;
    }
    if (invoice.tenant.taxId) {
      doc.text(`${t.taxId}: ${invoice.tenant.taxId}`, 20, y);
      y += 5;
    }
    y += 10;

    // Line items
    const lineItems: LineItem[] = (invoice.lineItems as unknown as LineItem[]) || [
      { description: getTypeLabel(invoice.type, lang as "en" | "th"), amount: invoice.subtotal },
    ];

    // Check if any line item has usage (utility items)
    const hasUtilityItems = lineItems.some(item => item.usage !== undefined);

    // Line items table header
    doc.setFillColor(59, 130, 246); // Blue
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
        doc.setFillColor(249, 250, 251);
        doc.rect(20, y - 4, pageWidth - 40, 8, "F");
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
      y += 8;
    });

    y += 5;
    doc.line(20, y, pageWidth - 20, y);
    y += 10;

    // Totals section
    const totalsX = pageWidth - 90;

    doc.text(t.subtotal, totalsX, y);
    doc.text(formatCurrency(invoice.subtotal), pageWidth - 25, y, { align: "right" });
    y += 7;

    if (invoice.discountAmount > 0) {
      doc.text(t.discount, totalsX, y);
      doc.setTextColor(22, 163, 74);
      doc.text(`-${formatCurrency(invoice.discountAmount)}`, pageWidth - 25, y, { align: "right" });
      doc.setTextColor(0, 0, 0);
      y += 7;
    }

    if (invoice.withholdingTax > 0) {
      doc.text(t.withholdingTax, totalsX, y);
      doc.text(`-${formatCurrency(invoice.withholdingTax)}`, pageWidth - 25, y, { align: "right" });
      y += 7;
    }

    // Total line
    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(0.5);
    doc.line(totalsX - 5, y, pageWidth - 20, y);
    y += 8;

    setThaiFont(doc, "bold");
    doc.setFontSize(12);
    doc.text(t.total, totalsX, y);
    doc.setTextColor(59, 130, 246);
    doc.text(formatCurrency(invoice.totalAmount), pageWidth - 25, y, { align: "right" });
    doc.setTextColor(0, 0, 0);

    y += 20;

    // Bank Account Information
    if (invoice.project.bankName || invoice.project.bankAccountNumber) {
      doc.setFontSize(10);
      setThaiFont(doc, "bold");
      doc.text(t.bankInfo, 20, y);
      y += 6;
      setThaiFont(doc, "normal");
      if (invoice.project.bankName) {
        doc.text(`${t.bankName}: ${invoice.project.bankName}`, 20, y);
        y += 5;
      }
      if (invoice.project.bankAccountNumber) {
        doc.text(`${t.accountNumber}: ${invoice.project.bankAccountNumber}`, 20, y);
        y += 5;
      }
      if (invoice.project.bankAccountName) {
        doc.text(`${t.accountName}: ${invoice.project.bankAccountName}`, 20, y);
        y += 5;
      }
      y += 10;
    }

    // Biller Signature Section
    setThaiFont(doc, "bold");
    doc.text(t.biller, 20, y);
    y += 15;
    doc.setLineWidth(0.3);
    doc.setDrawColor(150, 150, 150);
    doc.line(20, y, 80, y);
    y += 5;
    setThaiFont(doc, "normal");
    doc.setFontSize(9);
    const ownerName = invoice.project.owner?.name || "";
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
    const s3Key = getS3Key("invoice", invoice.id, lang);
    await uploadFile(s3Key, pdfBuffer, "application/pdf");

    // Generate pre-signed URL (valid for 1 hour)
    const presignedUrl = await getPresignedUrl(s3Key, 3600);

    return NextResponse.json({
      success: true,
      url: presignedUrl,
      key: s3Key,
      fileName: `Invoice-${invoice.invoiceNo}.pdf`,
    });
  } catch (error) {
    console.error("Error generating PDF:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
