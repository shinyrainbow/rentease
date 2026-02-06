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
  BBL: "Bangkok Bank",
  KBANK: "Kasikorn Bank",
  KTB: "Krungthai Bank",
  SCB: "SCB",
  BAY: "Bank of Ayudhya",
  TMB: "TTB",
  CIMB: "CIMB Thai",
  UOB: "UOB",
  TISCO: "TISCO Bank",
  KKP: "KKP",
  LH: "LH Bank",
  ICBC: "ICBC",
  GSB: "GSB",
  BAAC: "BAAC",
  GHB: "GHB",
};

const translations = {
  en: {
    invoice: "INVOICE",
    original: "Original",
    copy: "Copy",
    invoiceNo: "Invoice No.",
    dateCreated: "Date",
    dueDate: "Due Date",
    billingMonth: "Billing Month",
    taxId: "Tax ID",
    idCard: "ID Card",
    billTo: "Bill To",
    unit: "Unit",
    description: "Description",
    qtyUnit: "Units",
    unitPrice: "Unit Price",
    amount: "Amount",
    subtotal: "Subtotal",
    withholdingTax: "Withholding Tax",
    total: "Total",
    paymentInfo: "Payment Information",
    bankName: "Bank",
    accountName: "Account Name",
    accountNumber: "Account No.",
    biller: "Biller",
  },
  th: {
    invoice: "ใบแจ้งหนี้",
    original: "ต้นฉบับ",
    copy: "สำเนา",
    invoiceNo: "เลขที่",
    dateCreated: "วันที่",
    dueDate: "กำหนดชำระ",
    billingMonth: "รอบบิล",
    taxId: "เลขประจำตัวผู้เสียภาษี",
    idCard: "เลขบัตรประชาชน",
    billTo: "เรียกเก็บจาก",
    unit: "ห้อง/ยูนิต",
    description: "รายการ",
    qtyUnit: "ยูนิต",
    unitPrice: "ราคา/หน่วย",
    amount: "จำนวนเงิน",
    subtotal: "รวม",
    withholdingTax: "หัก ณ ที่จ่าย",
    total: "ยอดรวมทั้งสิ้น",
    paymentInfo: "ข้อมูลการชำระเงิน",
    bankName: "ธนาคาร",
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
    const { lang = "th", version = "original" } = await request.json();
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
    const margin = 20;
    let y = 25;

    // Fetch logo as base64
    const logoBase64 = await fetchImageAsBase64(invoice.project.logoUrl);

    // ============ HEADER SECTION ============
    // Left side: Logo + Company Info
    const leftX = margin;
    const logoSize = 12;

    if (logoBase64) {
      doc.addImage(logoBase64, "PNG", leftX, y - 3, logoSize, logoSize);
    } else {
      // Draw placeholder box
      doc.setFillColor(TEAL_COLOR.r, TEAL_COLOR.g, TEAL_COLOR.b);
      doc.roundedRect(leftX, y - 3, logoSize, logoSize, 2, 2, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      setThaiFont(doc, "bold");
      const initial = (invoice.project.companyName || invoice.project.name).charAt(0);
      doc.text(initial, leftX + logoSize / 2, y + 4, { align: "center" });
      doc.setTextColor(0, 0, 0);
    }

    // Company name next to logo
    const companyName = lang === "th" && invoice.project.companyNameTh
      ? invoice.project.companyNameTh
      : (invoice.project.companyName || invoice.project.name);

    doc.setFontSize(11);
    setThaiFont(doc, "bold");
    doc.text(companyName, leftX + logoSize + 5, y + 2);

    // Company address below
    if (invoice.project.companyAddress) {
      doc.setFontSize(8);
      setThaiFont(doc, "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(invoice.project.companyAddress, leftX, y + 15);
    }

    // Company Tax ID
    if (invoice.project.taxId) {
      doc.setFontSize(8);
      doc.text(`${t.taxId}: ${invoice.project.taxId}`, leftX, y + 20);
    }
    doc.setTextColor(0, 0, 0);

    // Right side: Invoice Title + Badge
    const rightX = pageWidth - margin;

    // Invoice title
    doc.setFontSize(18);
    setThaiFont(doc, "bold");
    doc.setTextColor(TEAL_COLOR.r, TEAL_COLOR.g, TEAL_COLOR.b);
    doc.text(t.invoice, rightX - 30, y, { align: "right" });

    // Badge (Original/Copy)
    const badgeText = version === "original" ? t.original : t.copy;
    const badgeWidth = 20;
    const badgeHeight = 6;
    doc.setFillColor(TEAL_COLOR.r, TEAL_COLOR.g, TEAL_COLOR.b);
    doc.roundedRect(rightX - badgeWidth, y - 5, badgeWidth, badgeHeight, 1, 1, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    setThaiFont(doc, "bold");
    doc.text(badgeText, rightX - badgeWidth / 2, y - 1, { align: "center" });
    doc.setTextColor(0, 0, 0);

    // Invoice details on right
    y += 10;
    doc.setFontSize(8);
    setThaiFont(doc, "normal");
    doc.text(`${t.invoiceNo}: `, rightX - 40, y, { align: "right" });
    setThaiFont(doc, "bold");
    doc.text(invoice.invoiceNo, rightX, y, { align: "right" });

    y += 5;
    setThaiFont(doc, "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`${t.dateCreated}: ${formatDate(invoice.createdAt, lang as "th" | "en")}`, rightX, y, { align: "right" });
    y += 4;
    doc.text(`${t.dueDate}: ${formatDate(invoice.dueDate, lang as "th" | "en")}`, rightX, y, { align: "right" });
    y += 4;
    doc.text(`${t.billingMonth}: ${invoice.billingMonth}`, rightX, y, { align: "right" });
    doc.setTextColor(0, 0, 0);

    y = 55;

    // ============ BILL TO SECTION ============
    // Light gray background
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 25, 2, 2, "F");

    y += 6;
    doc.setFontSize(8);
    setThaiFont(doc, "bold");
    doc.setTextColor(TEAL_COLOR.r, TEAL_COLOR.g, TEAL_COLOR.b);
    doc.text(t.billTo, margin + 5, y);
    doc.setTextColor(0, 0, 0);

    y += 6;
    doc.setFontSize(10);
    setThaiFont(doc, "bold");
    const tenantName = lang === "th" && invoice.tenant.nameTh ? invoice.tenant.nameTh : invoice.tenant.name;
    doc.text(tenantName, margin + 5, y);

    // Tenant address
    if (invoice.tenant.address) {
      y += 4;
      doc.setFontSize(7);
      setThaiFont(doc, "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(invoice.tenant.address, margin + 5, y);
    }

    // Tenant Tax ID or ID Card
    if (invoice.tenant.taxId) {
      y += 4;
      doc.setFontSize(7);
      doc.text(`${t.taxId}: ${invoice.tenant.taxId}`, margin + 5, y);
    } else if (invoice.tenant.idCard) {
      y += 4;
      doc.setFontSize(7);
      doc.text(`${t.idCard}: ${invoice.tenant.idCard}`, margin + 5, y);
    }
    doc.setTextColor(0, 0, 0);

    // Unit number on right side of bill to section
    doc.setFontSize(8);
    setThaiFont(doc, "normal");
    doc.text(`${t.unit}: `, pageWidth - margin - 25, 67);
    setThaiFont(doc, "bold");
    doc.text(invoice.unit.unitNumber, pageWidth - margin - 5, 67, { align: "right" });

    y = 90;

    // ============ LINE ITEMS TABLE ============
    const lineItems: LineItem[] = (invoice.lineItems as unknown as LineItem[]) || [];
    const hasUtilityItems = lineItems.some(item => item.usage !== undefined);

    // Table header
    doc.setFillColor(TEAL_COLOR.r, TEAL_COLOR.g, TEAL_COLOR.b);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 8, 1, 1, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    setThaiFont(doc, "bold");

    const colDesc = margin + 5;
    const colQty = hasUtilityItems ? 110 : 0;
    const colPrice = hasUtilityItems ? 140 : 0;
    const colAmount = pageWidth - margin - 5;

    doc.text(t.description, colDesc, y + 5.5);
    if (hasUtilityItems) {
      doc.text(t.qtyUnit, colQty, y + 5.5, { align: "center" });
      doc.text(t.unitPrice, colPrice, y + 5.5, { align: "right" });
    }
    doc.text(t.amount, colAmount, y + 5.5, { align: "right" });

    y += 10;
    doc.setTextColor(0, 0, 0);

    // Table rows
    setThaiFont(doc, "normal");
    doc.setFontSize(8);

    lineItems.forEach((item, index) => {
      // Alternating row background
      if (index % 2 === 0) {
        doc.setFillColor(255, 255, 255);
      } else {
        doc.setFillColor(249, 250, 251);
      }
      doc.rect(margin, y - 3, pageWidth - margin * 2, 7, "F");

      doc.text(item.description, colDesc, y + 1);
      if (hasUtilityItems) {
        if (item.usage !== undefined) {
          doc.text(String(item.usage), colQty, y + 1, { align: "center" });
          doc.text(formatCurrency(item.rate || item.unitPrice || 0), colPrice, y + 1, { align: "right" });
        } else {
          doc.text("-", colQty, y + 1, { align: "center" });
          doc.text("-", colPrice, y + 1, { align: "right" });
        }
      }
      doc.text(formatCurrency(item.amount), colAmount, y + 1, { align: "right" });

      y += 7;
    });

    // Bottom border line
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);

    y += 10;

    // ============ TOTALS SECTION ============
    const totalsX = pageWidth - margin - 60;
    const totalsValueX = pageWidth - margin - 5;

    // Subtotal
    doc.setFontSize(8);
    setThaiFont(doc, "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(t.subtotal, totalsX, y);
    doc.setTextColor(0, 0, 0);
    doc.text(formatCurrency(invoice.subtotal), totalsValueX, y, { align: "right" });
    y += 6;

    // Withholding Tax
    if (invoice.withholdingTax > 0) {
      const withholdingTaxPercent = invoice.tenant.withholdingTax || 0;
      doc.setTextColor(100, 100, 100);
      doc.text(`${t.withholdingTax} (${withholdingTaxPercent}%)`, totalsX, y);
      doc.setTextColor(220, 38, 38); // Red
      doc.text(`-${formatCurrency(invoice.withholdingTax)}`, totalsValueX, y, { align: "right" });
      y += 6;
    }

    // Total line
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.5);
    doc.line(totalsX - 5, y, pageWidth - margin, y);
    y += 6;

    // Total
    doc.setFontSize(10);
    setThaiFont(doc, "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(t.total, totalsX, y);
    doc.setTextColor(TEAL_COLOR.r, TEAL_COLOR.g, TEAL_COLOR.b);
    doc.text(`฿${formatCurrency(invoice.totalAmount)}`, totalsValueX, y, { align: "right" });
    doc.setTextColor(0, 0, 0);

    y += 20;

    // ============ FOOTER SECTION ============
    // Separator line
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // Bank Info on left
    doc.setFontSize(7);
    setThaiFont(doc, "bold");
    doc.setTextColor(75, 85, 99);
    doc.text(t.paymentInfo, margin, y);
    y += 4;

    setThaiFont(doc, "normal");
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(6);

    if (invoice.project.bankName) {
      const bankDisplayName = BANK_NAMES[invoice.project.bankName] || invoice.project.bankName;
      doc.text(`${t.bankName}: ${bankDisplayName}`, margin, y);
      y += 3;
    }
    if (invoice.project.bankAccountName) {
      doc.text(`${t.accountName}: ${invoice.project.bankAccountName}`, margin, y);
      y += 3;
    }
    if (invoice.project.bankAccountNumber) {
      doc.text(`${t.accountNumber}: ${invoice.project.bankAccountNumber}`, margin, y);
    }

    // Signature section on right
    const sigX = pageWidth - margin - 40;
    const sigY = y - 10;

    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.3);
    doc.line(sigX, sigY + 10, sigX + 35, sigY + 10);

    doc.setFontSize(6);
    doc.setTextColor(100, 100, 100);
    doc.text(t.biller, sigX + 17.5, sigY + 14, { align: "center" });

    if (invoice.project.owner?.name) {
      doc.setFontSize(6);
      doc.setTextColor(75, 85, 99);
      doc.text(`(${invoice.project.owner.name})`, sigX + 17.5, sigY + 17, { align: "center" });
    }

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
