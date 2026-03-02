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
    invoiceRent: "RENTAL INVOICE",
    invoiceUtility: "UTILITY INVOICE",
    original: "(Original)",
    copy: "(Copy)",
    invoiceNo: "Invoice No",
    date: "Date",
    dueDate: "Due Date",
    taxId: "Tax ID",
    billTo: "Bill To",
    unit: "Unit",
    name: "Name",
    address: "Address",
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
    detail: "Description",
    price: "Price",
    whLabel: "WH",
    colTotal: "Total",
    grandTotal: "Grand Total",
    quantity: "Quantity",
    unitPrice: "Unit Price",
    note: "Remark",
    transferTo: "Please transfer to",
    acctNoInline: "Account No.",
    acctNameInline: "Account Name",
  },
  th: {
    invoice: "ใบแจ้งหนี้",
    invoiceRent: "ใบแจ้งหนี้ค่าเช่า",
    invoiceUtility: "ใบแจ้งหนี้ค่าสาธารณูปโภค",
    original: "(ต้นฉบับ)",
    copy: "(สำเนา)",
    invoiceNo: "เลขที่",
    date: "วันที่",
    dueDate: "ครบกำหนด",
    taxId: "เลขประจำตัวผู้เสียภาษี",
    billTo: "เรียกเก็บจาก",
    unit: "ห้อง",
    name: "ชื่อ",
    address: "ที่อยู่",
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
    detail: "รายละเอียด",
    price: "ราคา",
    whLabel: "ณ ที่จ่าย WH",
    colTotal: "จำนวนเงิน",
    grandTotal: "จำนวนเงินทั้งสิ้น",
    quantity: "จำนวน",
    unitPrice: "ราคา",
    note: "หมายเหตุ",
    transferTo: "สามารถโอนเงินเข้าได้ที่",
    acctNoInline: "เลขที่บัญชี",
    acctNameInline: "ชื่อบัญชี",
  },
};

const PRIMARY_COLOR = { r: 22, g: 163, b: 74 }; // #16a34a (green-600)

function numberToThaiText(num: number): string {
  const thaiDigits = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const positions = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];
  if (num === 0) return "ศูนย์บาทถ้วน";
  const intPart = Math.floor(Math.abs(num));
  const decPart = Math.round((Math.abs(num) - intPart) * 100);
  function convert(n: number): string {
    if (n === 0) return "";
    if (n > 999999) return convert(Math.floor(n / 1000000)) + "ล้าน" + convert(n % 1000000);
    const str = n.toString();
    let result = "";
    const len = str.length;
    for (let i = 0; i < len; i++) {
      const d = parseInt(str[i]);
      const pos = len - i - 1;
      if (d === 0) continue;
      if (pos === 0 && d === 1 && len > 1) { result += "เอ็ด"; }
      else if (pos === 1 && d === 1) { result += "สิบ"; }
      else if (pos === 1 && d === 2) { result += "ยี่สิบ"; }
      else { result += thaiDigits[d] + positions[pos]; }
    }
    return result;
  }
  let text = convert(intPart) + "บาท";
  text += decPart > 0 ? convert(decPart) + "สตางค์" : "ถ้วน";
  return text;
}

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

    // ============ COMPANY HEADER - LOGO ON TOP, DETAILS BELOW ============
    const logoSize = 20;

    // Company name
    const companyName = lang === "th" && invoice.project.companyNameTh
      ? invoice.project.companyNameTh
      : (invoice.project.companyName || invoice.project.name);

    // Draw logo on top left
    if (logoBase64) {
      doc.addImage(logoBase64, "PNG", margin, y, logoSize, logoSize);
      y += logoSize + 4;
    }

    // Company name below logo
    doc.setFontSize(11);
    setThaiFont(doc, "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(companyName, margin, y);
    y += 5;

    // Company address
    if (invoice.project.companyAddress) {
      doc.setFontSize(11);
      setThaiFont(doc, "normal");
      doc.setTextColor(0, 0, 0);
      doc.text(invoice.project.companyAddress, margin, y);
      y += 5;
    }

    // Tax ID
    if (invoice.project.taxId) {
      doc.setFontSize(11);
      setThaiFont(doc, "normal");
      doc.setTextColor(0, 0, 0);
      doc.text(`${t.taxId}: ${invoice.project.taxId}`, margin, y);
      y += 5;
    }

    y += 8;

    // ============ INVOICE TITLE + DETAILS - RIGHT ALIGNED ============
    const rightSectionX = pageWidth / 2 + 5;
    const labelX = rightSectionX;
    const valueX = pageWidth - margin;

    // Title
    const invoiceTypeTitle = invoice.type === "RENT" ? t.invoiceRent
      : invoice.type === "UTILITY" ? t.invoiceUtility
      : t.invoice;
    const invoiceTitle = `${invoiceTypeTitle} ${copy ? t.copy : t.original}`;

    doc.setFontSize(16);
    setThaiFont(doc, "bold");
    doc.setTextColor(0, 0, 0);
    const titleCenterX = rightSectionX + (pageWidth - margin - rightSectionX) / 2;
    doc.text(invoiceTitle, titleCenterX, y, { align: "center" });

    // Separator under title
    y += 3;
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.5);
    doc.line(rightSectionX, y, pageWidth - margin, y);
    y += 6;

    // Invoice No
    doc.setFontSize(11);
    setThaiFont(doc, "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(t.invoiceNo, labelX, y);
    setThaiFont(doc, "normal");
    doc.text(invoice.invoiceNo, valueX, y, { align: "right" });
    y += 6;

    // Date
    setThaiFont(doc, "bold");
    doc.text(t.date, labelX, y);
    setThaiFont(doc, "normal");
    doc.text(formatDate(invoice.createdAt, lang as "th" | "en"), valueX, y, { align: "right" });
    y += 6;

    // Due Date
    setThaiFont(doc, "bold");
    doc.text(t.dueDate, labelX, y);
    setThaiFont(doc, "normal");
    doc.text(formatDate(invoice.dueDate, lang as "th" | "en"), valueX, y, { align: "right" });

    // Separator under due date
    y += 3;
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.5);
    doc.line(rightSectionX, y, pageWidth - margin, y);

    y += 12;

    // ============ BILL TO SECTION ============
    // Use snapshot fields with relation fallback (relations may be null if unit/tenant deleted)
    const resolvedTenantName = invoice.tenantName || invoice.tenant?.name || "-";
    const resolvedTenantNameTh = invoice.tenantNameTh || invoice.tenant?.nameTh;
    const resolvedUnitNumber = invoice.unitNumber || invoice.unit?.unitNumber || "-";
    const resolvedTenantAddress = invoice.tenant?.address || "";
    const resolvedTenantTaxId = invoice.tenantTaxId || invoice.tenant?.taxId || "";

    const tenantName = lang === "th" && resolvedTenantNameTh ? resolvedTenantNameTh : resolvedTenantName;
    const labelWidth = 40;

    doc.setFontSize(11);
    setThaiFont(doc, "normal");

    // Unit
    doc.setTextColor(107, 114, 128);
    doc.text(`${t.unit}:`, margin, y);
    doc.setTextColor(0, 0, 0);
    doc.text(resolvedUnitNumber, margin + labelWidth, y);
    y += 5;

    // Name
    doc.setTextColor(107, 114, 128);
    doc.text(`${t.name}:`, margin, y);
    doc.setTextColor(0, 0, 0);
    doc.text(tenantName, margin + labelWidth, y);
    y += 5;

    // Address
    if (resolvedTenantAddress) {
      doc.setTextColor(107, 114, 128);
      doc.text(`${t.address}:`, margin, y);
      doc.setTextColor(0, 0, 0);
      doc.text(resolvedTenantAddress, margin + labelWidth, y);
      y += 5;
    }

    // Tax ID
    if (resolvedTenantTaxId) {
      doc.setTextColor(107, 114, 128);
      doc.text(`${t.taxId}:`, margin, y);
      doc.setTextColor(0, 0, 0);
      doc.text(resolvedTenantTaxId, margin + labelWidth, y);
      y += 5;
    }

    y += 8;

    // ============ LINE ITEMS TABLE ============
    const lineItems: LineItem[] = (invoice.lineItems as unknown as LineItem[]) || [];
    const tableWidth = pageWidth - margin * 2;
    const whPercent = invoice.tenant?.withholdingTax || 0;
    const isUtility = invoice.type === "UTILITY";

    // Column positions
    const colNumW = 10;
    const colCol2W = 28; // Price or Quantity
    const colCol3W = 28; // WH or Unit Price
    const colTotalW = 28;
    const colDescW = tableWidth - colNumW - colCol2W - colCol3W - colTotalW;

    const colNumLeft = margin;
    const colDescLeft = margin + colNumW;
    const colCol2Left = colDescLeft + colDescW;
    const colCol3Left = colCol2Left + colCol2W;
    const colTotalLeft = colCol3Left + colCol3W;

    const colNumCenter = colNumLeft + colNumW / 2;
    const colDescTextX = colDescLeft + 4;
    const colCol2TextX = colCol2Left + colCol2W - 3;
    const colCol3TextX = colCol3Left + colCol3W - 3;
    const colTotalTextX = colTotalLeft + colTotalW - 3;

    // Table header (white bg, bilingual: English line 1, Thai line 2)
    const headerHeight = 16;
    doc.setFillColor(255, 255, 255);
    doc.rect(margin, y, tableWidth, headerHeight, "F");

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    setThaiFont(doc, "bold");
    const hY1 = y + 6;
    const hY2 = y + 12;

    // Header line 1 (English)
    doc.text("#", colNumCenter, hY1, { align: "center" });
    doc.text("Description", colDescTextX, hY1);
    if (isUtility) {
      doc.text("Quantity", colCol2TextX, hY1, { align: "right" });
      doc.text("Unit Price", colCol3TextX, hY1, { align: "right" });
    } else {
      doc.text("Price", colCol2TextX, hY1, { align: "right" });
      doc.text(`WH ${whPercent}%`, colCol3TextX, hY1, { align: "right" });
    }
    doc.text("Total", colTotalTextX, hY1, { align: "right" });

    // Header line 2 (Thai)
    doc.text(t.detail, colDescTextX, hY2);
    if (isUtility) {
      doc.text(t.quantity, colCol2TextX, hY2, { align: "right" });
      doc.text(t.unitPrice, colCol3TextX, hY2, { align: "right" });
    } else {
      doc.text(t.price, colCol2TextX, hY2, { align: "right" });
      doc.text(`${t.whLabel} ${whPercent}%`, colCol3TextX, hY2, { align: "right" });
    }
    doc.text(t.colTotal, colTotalTextX, hY2, { align: "right" });

    y += headerHeight;

    // Black line under header
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 2;

    doc.setTextColor(0, 0, 0);

    // Table rows
    setThaiFont(doc, "normal");
    doc.setFontSize(10);
    const rowHeight = 10;

    lineItems.forEach((item, index) => {
      const rowY = y;
      const textY = rowY + rowHeight / 2 + 1.5;

      // Row background
      doc.setFillColor(255, 255, 255);
      doc.rect(margin, rowY, tableWidth, rowHeight, "F");

      // Row border bottom
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.2);
      doc.line(margin, rowY + rowHeight, pageWidth - margin, rowY + rowHeight);

      // # column
      doc.text(String(index + 1), colNumCenter, textY, { align: "center" });

      // Description
      doc.text(item.description, colDescTextX, textY);

      if (isUtility) {
        // Quantity
        const qty = item.quantity ?? item.usage ?? 0;
        doc.text(formatCurrency(qty), colCol2TextX, textY, { align: "right" });

        // Unit Price
        const uPrice = item.unitPrice ?? item.rate ?? 0;
        doc.text(formatCurrency(uPrice), colCol3TextX, textY, { align: "right" });

        // Total (quantity * unit price = amount)
        doc.text(formatCurrency(item.amount), colTotalTextX, textY, { align: "right" });
      } else {
        // Price (item amount = pre-WH)
        doc.text(formatCurrency(item.amount), colCol2TextX, textY, { align: "right" });

        // WH amount per item
        const itemWh = whPercent > 0 ? item.amount * whPercent / 100 : 0;
        doc.text(formatCurrency(itemWh), colCol3TextX, textY, { align: "right" });

        // Total per item (price - WH)
        const itemTotal = item.amount - itemWh;
        doc.text(formatCurrency(itemTotal), colTotalTextX, textY, { align: "right" });
      }

      y += rowHeight;
    });

    // Bottom summary row (white bg)
    const summaryHeight = 12;
    doc.setFillColor(255, 255, 255);
    doc.rect(margin, y, tableWidth, summaryHeight, "F");

    // Bottom border
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(margin, y + summaryHeight, pageWidth - margin, y + summaryHeight);

    const summaryTextY = y + summaryHeight / 2 + 1.5;

    // Thai baht text on left
    doc.setFontSize(10);
    setThaiFont(doc, "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(numberToThaiText(invoice.totalAmount), colDescTextX, summaryTextY);

    // Grand total label (merged across col2+col3) + amount on right
    const mergedCenterX = colCol2Left + (colCol2W + colCol3W) / 2;
    doc.text(t.grandTotal, mergedCenterX, summaryTextY, { align: "center" });
    doc.text(formatCurrency(invoice.totalAmount), colTotalTextX, summaryTextY, { align: "right" });

    y += summaryHeight + 35;

    // ============ NOTE + SIGNATURE SECTION ============
    const hasBankInfo = invoice.project.bankName || invoice.project.bankAccountName || invoice.project.bankAccountNumber;

    // Note section on left
    if (hasBankInfo) {
      const bankKey = (invoice.project.bankName || "").toLowerCase();
      const bankDisplayName = BANK_NAMES[bankKey] || invoice.project.bankName || "";

      doc.setFontSize(12);
      setThaiFont(doc, "bold");
      doc.text(t.note, margin, y);
      y += 7;

      setThaiFont(doc, "normal");
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);

      // Line 1: สามารถโอนเงินเข้าได้ที่
      doc.text(t.transferTo, margin, y);
      y += 6;

      // Line 2: ธนาคาร... เลขที่บัญชี ...
      if (bankDisplayName || invoice.project.bankAccountNumber) {
        const line2 = `${bankDisplayName} ${t.acctNoInline} ${invoice.project.bankAccountNumber || ""}`.trim();
        doc.text(line2, margin, y);
        y += 6;
      }

      // Line 3: ชื่อบัญชี ...
      if (invoice.project.bankAccountName) {
        doc.text(`${t.acctNameInline} ${invoice.project.bankAccountName}`, margin, y);
      }
    }

    // Signature section on right
    const sigX = pageWidth - margin - 50;
    const sigY = y - (hasBankInfo ? 18 : 0);

    // Signature line
    doc.setDrawColor(17, 24, 39);
    doc.setLineWidth(0.5);
    doc.line(sigX, sigY + 15, sigX + 45, sigY + 15);

    // Biller label
    doc.setFontSize(11);
    setThaiFont(doc, "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(t.biller, sigX + 22.5, sigY + 21, { align: "center" });

    // Owner name
    if (invoice.project.owner?.name) {
      doc.setFontSize(10);
      doc.setTextColor(107, 114, 128);
      doc.text(`(${invoice.project.owner.name})`, sigX + 22.5, sigY + 26, { align: "center" });
    }

    // ============ FOOTER - Bold separator ============
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(1);
    doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);

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
