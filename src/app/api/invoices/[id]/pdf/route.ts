import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { uploadFile, getPresignedUrl, getS3Key, fetchImageAsBase64 } from "@/lib/s3";
import { createPDFWithThaiFont, setThaiFont } from "@/lib/pdf-fonts";

interface LineItem {
  description: string;
  amount: number;
  quantity?: number;
  unitPrice?: number;
  usage?: number;
  rate?: number;
}

// Bank name mapping
const BANK_NAMES: Record<string, string> = {
  kbank: "ธนาคารกสิกรไทย",
  scb: "ธนาคารไทยพาณิชย์",
  bbl: "ธนาคารกรุงเทพ",
  ktb: "ธนาคารกรุงไทย",
  bay: "ธนาคารกรุงศรีอยุธยา",
  ttb: "ธนาคารทหารไทยธนชาต",
  gsb: "ธนาคารออมสิน",
  uob: "ธนาคารยูโอบี",
  cimb: "ธนาคารซีไอเอ็มบี ไทย",
  lhbank: "ธนาคารแลนด์ แอนด์ เฮ้าส์",
  tisco: "ธนาคารทิสโก้",
  kkp: "ธนาคารเกียรตินาคินภัทร",
  icbc: "ธนาคารไอซีบีซี (ไทย)",
  baac: "ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร",
  ghb: "ธนาคารอาคารสงเคราะห์",
};

const translations = {
  en: {
    invoice: "INVOICE",
    invoiceNo: "Invoice No",
    date: "Date",
    dueDate: "Due Date",
    billingMonth: "Billing Month",
    taxId: "Tax ID",
    billTo: "Bill To",
    unit: "Unit",
    description: "Description",
    amount: "Amount (THB)",
    subtotal: "Subtotal",
    withholdingTax: "Withholding Tax",
    total: "Total",
    pleasePayBy: "Please pay by the due date",
    paymentInfo: "Payment Information",
    bankNameLabel: "Bank",
    accountName: "Account Name",
    accountNumber: "Account Number",
    biller: "Biller",
  },
  th: {
    invoice: "ใบแจ้งหนี้",
    invoiceNo: "เลขที่",
    date: "วันที่",
    dueDate: "กำหนดชำระ",
    billingMonth: "รอบบิล",
    taxId: "เลขประจำตัวผู้เสียภาษี",
    billTo: "เรียกเก็บจาก",
    unit: "ห้อง",
    description: "รายการ",
    amount: "จำนวนเงิน (บาท)",
    subtotal: "รวม",
    withholdingTax: "หัก ณ ที่จ่าย",
    total: "ยอดรวมทั้งสิ้น",
    pleasePayBy: "กรุณาชำระภายในกำหนด",
    paymentInfo: "ข้อมูลการชำระเงิน",
    bankNameLabel: "ธนาคาร",
    accountName: "ชื่อบัญชี",
    accountNumber: "เลขที่บัญชี",
    biller: "ผู้วางบิล",
  },
};

const TEAL_COLOR = { r: 45, g: 139, b: 139 }; // #2D8B8B

function formatCurrency(amount: number): string {
  return amount.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const thaiMonths = ["มค", "กพ", "มีค", "เมย", "พค", "มิย", "กค", "สค", "กย", "ตค", "พย", "ธค"];
const engMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDate(date: Date, lang: "th" | "en" = "th"): string {
  const d = new Date(date);
  const day = d.getDate();
  const month = lang === "th" ? thaiMonths[d.getMonth()] : engMonths[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
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
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const centerX = pageWidth / 2;
    let y = 20;

    // Fetch logo as base64
    const logoBase64 = await fetchImageAsBase64(invoice.project.logoUrl);

    // ============ COMPANY HEADER - CENTERED ============
    const logoSize = 20;

    if (logoBase64) {
      doc.addImage(logoBase64, "PNG", centerX - logoSize / 2, y, logoSize, logoSize);
    }
    y += logoSize + 5;

    // Company name - centered
    const companyName = lang === "th" && invoice.project.companyNameTh
      ? invoice.project.companyNameTh
      : (invoice.project.companyName || invoice.project.name);

    doc.setFontSize(14);
    setThaiFont(doc, "bold");
    doc.text(companyName, centerX, y, { align: "center" });
    y += 6;

    // Company address - centered
    if (invoice.project.companyAddress) {
      doc.setFontSize(8);
      setThaiFont(doc, "normal");
      doc.setTextColor(107, 114, 128);
      doc.text(invoice.project.companyAddress, centerX, y, { align: "center" });
      y += 4;
    }

    // Tax ID - centered
    if (invoice.project.taxId) {
      doc.setFontSize(8);
      doc.text(`${t.taxId}: ${invoice.project.taxId}`, centerX, y, { align: "center" });
      y += 4;
    }
    doc.setTextColor(0, 0, 0);

    y += 8;

    // ============ INVOICE TITLE - CENTERED ============
    doc.setFontSize(20);
    setThaiFont(doc, "bold");
    doc.setTextColor(TEAL_COLOR.r, TEAL_COLOR.g, TEAL_COLOR.b);
    doc.text(t.invoice, centerX, y, { align: "center" });
    doc.setTextColor(0, 0, 0);

    y += 12;

    // ============ INVOICE DETAILS - TWO COLUMNS ============
    doc.setFontSize(10);
    setThaiFont(doc, "normal");

    // Left: Invoice No
    doc.text(`${t.invoiceNo}: ${invoice.invoiceNo}`, margin, y);
    // Right: Date
    doc.text(`${t.date}: ${formatDate(invoice.createdAt, lang as "th" | "en")}`, pageWidth - margin, y, { align: "right" });
    y += 6;

    // Left: Billing Month
    doc.text(`${t.billingMonth}: ${invoice.billingMonth}`, margin, y);
    // Right: Due Date
    doc.text(`${t.dueDate}: ${formatDate(invoice.dueDate, lang as "th" | "en")}`, pageWidth - margin, y, { align: "right" });

    y += 12;

    // ============ BILL TO SECTION ============
    doc.setFontSize(10);
    setThaiFont(doc, "bold");
    doc.text(`${t.billTo}:`, margin, y);
    y += 6;

    const tenantName = lang === "th" && invoice.tenant.nameTh ? invoice.tenant.nameTh : invoice.tenant.name;
    doc.setFontSize(12);
    doc.text(tenantName, margin, y);
    y += 5;

    doc.setFontSize(10);
    setThaiFont(doc, "normal");
    doc.setTextColor(107, 114, 128);
    doc.text(`${t.unit}: ${invoice.unit.unitNumber}`, margin, y);
    doc.setTextColor(0, 0, 0);

    y += 12;

    // ============ LINE ITEMS TABLE ============
    const lineItems: LineItem[] = (invoice.lineItems as unknown as LineItem[]) || [];
    const tableWidth = pageWidth - margin * 2;
    const colAmountX = pageWidth - margin - 5;

    // Table header
    doc.setFillColor(TEAL_COLOR.r, TEAL_COLOR.g, TEAL_COLOR.b);
    doc.roundedRect(margin, y, tableWidth, 10, 2, 2, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    setThaiFont(doc, "bold");
    doc.text(t.description, margin + 8, y + 7);
    doc.text(t.amount, colAmountX, y + 7, { align: "right" });

    y += 12;
    doc.setTextColor(0, 0, 0);

    // Table rows
    setThaiFont(doc, "normal");
    doc.setFontSize(10);

    lineItems.forEach((item, index) => {
      // Alternating row background
      if (index % 2 === 0) {
        doc.setFillColor(249, 250, 251);
      } else {
        doc.setFillColor(255, 255, 255);
      }
      doc.rect(margin, y - 4, tableWidth, 10, "F");

      // Border
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.2);
      doc.line(margin, y + 6, pageWidth - margin, y + 6);
      doc.line(margin, y - 4, margin, y + 6);
      doc.line(pageWidth - margin, y - 4, pageWidth - margin, y + 6);

      doc.text(item.description, margin + 8, y + 2);
      doc.text(formatCurrency(item.amount), colAmountX, y + 2, { align: "right" });

      y += 10;
    });

    // Bottom border with rounded corners (last row)
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.2);
    doc.line(margin, y - 4, pageWidth - margin, y - 4);

    y += 8;

    // ============ TOTALS SECTION ============
    const totalsBoxWidth = 120;
    const totalsX = pageWidth - margin - totalsBoxWidth;

    // Subtotal
    doc.setFontSize(10);
    setThaiFont(doc, "normal");
    doc.setTextColor(107, 114, 128);
    doc.text(t.subtotal, totalsX, y);
    doc.setTextColor(0, 0, 0);
    doc.text(formatCurrency(invoice.subtotal), colAmountX, y, { align: "right" });
    y += 6;

    // Withholding Tax
    if (invoice.withholdingTax > 0) {
      const withholdingTaxPercent = invoice.tenant.withholdingTax || 0;
      doc.setTextColor(107, 114, 128);
      doc.text(`${t.withholdingTax} (${withholdingTaxPercent}%)`, totalsX, y);
      doc.setTextColor(220, 38, 38); // Red
      doc.text(`-${formatCurrency(invoice.withholdingTax)}`, colAmountX, y, { align: "right" });
      y += 6;
    }

    y += 4;

    // Total box
    doc.setFillColor(TEAL_COLOR.r, TEAL_COLOR.g, TEAL_COLOR.b);
    doc.roundedRect(totalsX - 5, y - 4, totalsBoxWidth + 5, 12, 2, 2, "F");

    doc.setFontSize(12);
    setThaiFont(doc, "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(t.total, totalsX, y + 4);
    doc.text(formatCurrency(invoice.totalAmount), colAmountX, y + 4, { align: "right" });
    doc.setTextColor(0, 0, 0);

    y += 20;

    // ============ PAYMENT INFO + SIGNATURE SECTION ============
    const hasBankInfo = invoice.project.bankName || invoice.project.bankAccountName || invoice.project.bankAccountNumber;

    // Payment Info on left
    if (hasBankInfo) {
      doc.setFontSize(10);
      setThaiFont(doc, "bold");
      doc.text(t.paymentInfo, margin, y);
      y += 6;

      setThaiFont(doc, "normal");
      doc.setFontSize(9);

      if (invoice.project.bankName) {
        const bankKey = invoice.project.bankName.toLowerCase();
        const bankDisplayName = BANK_NAMES[bankKey] || invoice.project.bankName;
        doc.setTextColor(107, 114, 128);
        doc.text(`${t.bankNameLabel}:`, margin, y);
        doc.setTextColor(0, 0, 0);
        doc.text(bankDisplayName, margin + 25, y);
        y += 5;
      }
      if (invoice.project.bankAccountName) {
        doc.setTextColor(107, 114, 128);
        doc.text(`${t.accountName}:`, margin, y);
        doc.setTextColor(0, 0, 0);
        doc.text(invoice.project.bankAccountName, margin + 25, y);
        y += 5;
      }
      if (invoice.project.bankAccountNumber) {
        doc.setTextColor(107, 114, 128);
        doc.text(`${t.accountNumber}:`, margin, y);
        doc.setTextColor(0, 0, 0);
        doc.text(invoice.project.bankAccountNumber, margin + 25, y);
      }
    }

    // Signature section on right
    const sigX = pageWidth - margin - 50;
    const sigY = y - (hasBankInfo ? 15 : 0);

    // Signature line
    doc.setDrawColor(17, 24, 39);
    doc.setLineWidth(0.5);
    doc.line(sigX, sigY + 15, sigX + 45, sigY + 15);

    // Biller label
    doc.setFontSize(9);
    setThaiFont(doc, "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(t.biller, sigX + 22.5, sigY + 20, { align: "center" });

    // Owner name
    if (invoice.project.owner?.name) {
      doc.setFontSize(8);
      doc.setTextColor(107, 114, 128);
      doc.text(`(${invoice.project.owner.name})`, sigX + 22.5, sigY + 24, { align: "center" });
    }

    // ============ FOOTER ============
    doc.setFontSize(9);
    setThaiFont(doc, "normal");
    doc.setTextColor(107, 114, 128);
    doc.text(t.pleasePayBy, centerX, pageHeight - 15, { align: "center" });

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
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Internal server error", details: errorMessage }, { status: 500 });
  }
}
