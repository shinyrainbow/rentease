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
    receipt: "RECEIPT",
    original: "(Original)",
    copy: "(Copy)",
    receiptNo: "Receipt No",
    date: "Date",
    referenceInvoice: "Ref. Invoice",
    billingMonth: "Billing Month",
    receivedFrom: "Received From",
    unit: "Unit",
    name: "Name",
    address: "Address",
    phone: "Phone",
    taxId: "Tax ID",
    description: "Description",
    amount: "Amount (THB)",
    subtotal: "Subtotal",
    withholdingTax: "Withholding Tax",
    total: "Total",
    thankYou: "Thank you for your payment",
    paymentInfo: "Payment Information",
    bankNameLabel: "Bank",
    accountNumber: "Account No",
    accountName: "Account Name",
    receiver: "Receiver",
  },
  th: {
    receipt: "ใบเสร็จรับเงิน",
    original: "(ต้นฉบับ)",
    copy: "(สำเนา)",
    receiptNo: "เลขที่",
    date: "วันที่",
    referenceInvoice: "อ้างอิงใบแจ้งหนี้",
    billingMonth: "รอบบิล",
    receivedFrom: "รับเงินจาก",
    unit: "ห้อง",
    name: "ชื่อ",
    address: "ที่อยู่",
    phone: "โทร",
    taxId: "เลขประจำตัวผู้เสียภาษี",
    description: "รายการ",
    amount: "จำนวนเงิน (บาท)",
    subtotal: "รวม",
    withholdingTax: "หัก ณ ที่จ่าย",
    total: "ยอดรวมทั้งสิ้น",
    thankYou: "ขอบคุณที่ชำระเงิน",
    paymentInfo: "ข้อมูลการชำระเงิน",
    bankNameLabel: "ธนาคาร",
    accountNumber: "เลขบัญชี",
    accountName: "ชื่อบัญชี",
    receiver: "ผู้รับเงิน",
  },
};

const PRIMARY_COLOR = { r: 22, g: 163, b: 74 }; // #16a34a (green-600)

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
    const { lang = "th", copy = false } = await request.json();
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
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const centerX = pageWidth / 2;
    let y = 20;

    // Fetch logo as base64
    const logoBase64 = await fetchImageAsBase64(receipt.invoice.project.logoUrl);

    // ============ COMPANY HEADER - LEFT ALIGNED WITH LOGO ============
    const logoSize = 20;
    const textStartX = logoBase64 ? margin + logoSize + 8 : margin;

    // Company name
    const companyName = lang === "th" && receipt.invoice.project.companyNameTh
      ? receipt.invoice.project.companyNameTh
      : (receipt.invoice.project.companyName || receipt.invoice.project.name);

    // Draw logo on left
    if (logoBase64) {
      doc.addImage(logoBase64, "PNG", margin, y, logoSize, logoSize);
    }

    // Company details on right of logo
    let textY = y + 4;
    doc.setFontSize(16);
    setThaiFont(doc, "bold");
    doc.text(companyName, textStartX, textY);
    textY += 7;

    // Company address
    if (receipt.invoice.project.companyAddress) {
      doc.setFontSize(10);
      setThaiFont(doc, "normal");
      doc.setTextColor(107, 114, 128);
      doc.text(receipt.invoice.project.companyAddress, textStartX, textY);
      textY += 5;
    }

    // Tax ID
    if (receipt.invoice.project.taxId) {
      doc.setFontSize(10);
      doc.text(`${t.taxId}: ${receipt.invoice.project.taxId}`, textStartX, textY);
      textY += 5;
    }
    doc.setTextColor(0, 0, 0);

    // Move y to after logo or text, whichever is larger
    y = Math.max(y + logoSize, textY) + 8;

    // Separator line above title
    doc.setDrawColor(229, 231, 235); // gray-200
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // ============ RECEIPT TITLE - CENTERED ============
    doc.setFontSize(18);
    setThaiFont(doc, "bold");
    doc.setTextColor(PRIMARY_COLOR.r, PRIMARY_COLOR.g, PRIMARY_COLOR.b);
    const receiptTitle = `${t.receipt} ${copy ? t.copy : t.original}`;
    doc.text(receiptTitle, centerX, y, { align: "center" });
    doc.setTextColor(0, 0, 0);

    y += 14;

    // ============ RECEIPT DETAILS - TWO COLUMNS ============
    doc.setFontSize(12);
    setThaiFont(doc, "normal");

    // Left: Receipt No
    doc.text(`${t.receiptNo}: ${receipt.receiptNo}`, margin, y);
    // Right: Date
    doc.text(`${t.date}: ${formatDate(receipt.issuedAt, lang as "th" | "en")}`, pageWidth - margin, y, { align: "right" });
    y += 6;

    // Left: Ref Invoice
    doc.text(`${t.referenceInvoice}: ${receipt.invoice.invoiceNo}`, margin, y);
    // Right: Billing Month
    doc.text(`${t.billingMonth}: ${receipt.invoice.billingMonth}`, pageWidth - margin, y, { align: "right" });

    y += 12;

    // ============ RECEIVED FROM SECTION ============
    const tenantName = lang === "th" && receipt.invoice.tenant.nameTh ? receipt.invoice.tenant.nameTh : receipt.invoice.tenant.name;
    const labelWidth = 40;

    doc.setFontSize(11);
    setThaiFont(doc, "normal");

    // Unit
    doc.setTextColor(107, 114, 128);
    doc.text(`${t.unit}:`, margin, y);
    doc.setTextColor(0, 0, 0);
    doc.text(receipt.invoice.unit.unitNumber, margin + labelWidth, y);
    y += 5;

    // Name
    doc.setTextColor(107, 114, 128);
    doc.text(`${t.name}:`, margin, y);
    doc.setTextColor(0, 0, 0);
    doc.text(tenantName, margin + labelWidth, y);
    y += 5;

    // Address
    if (receipt.invoice.tenant.address) {
      doc.setTextColor(107, 114, 128);
      doc.text(`${t.address}:`, margin, y);
      doc.setTextColor(0, 0, 0);
      doc.text(receipt.invoice.tenant.address, margin + labelWidth, y);
      y += 5;
    }

    // Tax ID
    if (receipt.invoice.tenant.taxId) {
      doc.setTextColor(107, 114, 128);
      doc.text(`${t.taxId}:`, margin, y);
      doc.setTextColor(0, 0, 0);
      doc.text(receipt.invoice.tenant.taxId, margin + labelWidth, y);
      y += 5;
    }

    y += 8;

    // ============ LINE ITEMS TABLE ============
    const lineItems: LineItem[] = (receipt.invoice.lineItems as unknown as LineItem[]) || [];
    const tableWidth = pageWidth - margin * 2;
    const colAmountX = pageWidth - margin - 5;

    // Table header
    const headerHeight = 14;
    doc.setFillColor(PRIMARY_COLOR.r, PRIMARY_COLOR.g, PRIMARY_COLOR.b);
    doc.roundedRect(margin, y, tableWidth, headerHeight, 2, 2, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    setThaiFont(doc, "bold");
    // Vertically center text in header
    const headerTextY = y + headerHeight / 2 + 1.5;
    doc.text(t.description, margin + 8, headerTextY);
    doc.text(t.amount, colAmountX, headerTextY, { align: "right" });

    y += headerHeight + 2;
    doc.setTextColor(0, 0, 0);

    // Table rows
    setThaiFont(doc, "normal");
    doc.setFontSize(12);

    lineItems.forEach((item, index) => {
      // Alternating row background
      if (index % 2 === 0) {
        doc.setFillColor(249, 250, 251);
      } else {
        doc.setFillColor(255, 255, 255);
      }
      doc.rect(margin, y - 4, tableWidth, 12, "F");

      // Border
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.2);
      doc.line(margin, y + 8, pageWidth - margin, y + 8);
      doc.line(margin, y - 4, margin, y + 8);
      doc.line(pageWidth - margin, y - 4, pageWidth - margin, y + 8);

      doc.text(item.description, margin + 8, y + 3);
      doc.text(formatCurrency(item.amount), colAmountX, y + 3, { align: "right" });

      y += 12;
    });

    // Bottom border
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.2);
    doc.line(margin, y - 4, pageWidth - margin, y - 4);

    y += 8;

    // ============ TOTALS SECTION ============
    const totalsBoxWidth = 85;
    const totalsX = pageWidth - margin - totalsBoxWidth;

    // Subtotal
    doc.setFontSize(12);
    setThaiFont(doc, "normal");
    doc.setTextColor(107, 114, 128);
    doc.text(t.subtotal, totalsX, y);
    doc.setTextColor(0, 0, 0);
    doc.text(formatCurrency(receipt.invoice.subtotal), colAmountX, y, { align: "right" });
    y += 7;

    // Withholding Tax
    if (receipt.invoice.withholdingTax > 0) {
      const withholdingTaxPercent = receipt.invoice.tenant.withholdingTax || 0;
      doc.setTextColor(107, 114, 128);
      doc.text(`${t.withholdingTax} (${withholdingTaxPercent}%)`, totalsX, y);
      doc.setTextColor(220, 38, 38); // Red
      doc.text(`-${formatCurrency(receipt.invoice.withholdingTax)}`, colAmountX, y, { align: "right" });
      y += 7;
    }

    y += 4;

    // Separator line above total
    doc.setDrawColor(229, 231, 235); // gray-200
    doc.setLineWidth(0.5);
    doc.line(totalsX - 5, y, colAmountX + 5, y);
    y += 7;

    // Total (no background)
    doc.setFontSize(14);
    setThaiFont(doc, "bold");
    doc.setTextColor(0, 0, 0); // Black for label
    doc.text(t.total, totalsX, y);
    doc.setTextColor(PRIMARY_COLOR.r, PRIMARY_COLOR.g, PRIMARY_COLOR.b);
    doc.text(formatCurrency(receipt.amount), colAmountX, y, { align: "right" });
    doc.setTextColor(0, 0, 0);

    y += 35;

    // ============ PAYMENT INFO + SIGNATURE SECTION ============
    const hasBankInfo = receipt.invoice.project.bankName || receipt.invoice.project.bankAccountName || receipt.invoice.project.bankAccountNumber;

    // Payment Info on left
    if (hasBankInfo) {
      doc.setFontSize(12);
      setThaiFont(doc, "bold");
      doc.text(t.paymentInfo, margin, y);
      y += 7;

      setThaiFont(doc, "normal");
      doc.setFontSize(11);

      if (receipt.invoice.project.bankName) {
        const bankKey = receipt.invoice.project.bankName.toLowerCase();
        const bankDisplayName = BANK_NAMES[bankKey] || receipt.invoice.project.bankName;
        doc.setTextColor(107, 114, 128);
        doc.text(`${t.bankNameLabel}:`, margin, y);
        doc.setTextColor(0, 0, 0);
        doc.text(bankDisplayName, margin + 28, y);
        y += 6;
      }
      if (receipt.invoice.project.bankAccountName) {
        doc.setTextColor(107, 114, 128);
        doc.text(`${t.accountName}:`, margin, y);
        doc.setTextColor(0, 0, 0);
        doc.text(receipt.invoice.project.bankAccountName, margin + 28, y);
        y += 6;
      }
      if (receipt.invoice.project.bankAccountNumber) {
        doc.setTextColor(107, 114, 128);
        doc.text(`${t.accountNumber}:`, margin, y);
        doc.setTextColor(0, 0, 0);
        doc.text(receipt.invoice.project.bankAccountNumber, margin + 28, y);
      }
    }

    // Signature section on right
    const sigX = pageWidth - margin - 50;
    const sigY = y - (hasBankInfo ? 18 : 0);

    // Signature line
    doc.setDrawColor(17, 24, 39);
    doc.setLineWidth(0.5);
    doc.line(sigX, sigY + 15, sigX + 45, sigY + 15);

    // Receiver label
    doc.setFontSize(11);
    setThaiFont(doc, "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(t.receiver, sigX + 22.5, sigY + 21, { align: "center" });

    // Owner name
    if (receipt.invoice.project.owner?.name) {
      doc.setFontSize(10);
      doc.setTextColor(107, 114, 128);
      doc.text(`(${receipt.invoice.project.owner.name})`, sigX + 22.5, sigY + 26, { align: "center" });
    }

    // ============ FOOTER ============
    doc.setFontSize(11);
    setThaiFont(doc, "normal");
    doc.setTextColor(107, 114, 128);
    doc.text(t.thankYou, centerX, pageHeight - 15, { align: "center" });

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
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Internal server error", details: errorMessage }, { status: 500 });
  }
}
