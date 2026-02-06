import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { uploadFile, getPresignedUrl, getS3Key } from "@/lib/s3";
import { jsPDF } from "jspdf";

const translations = {
  en: {
    receipt: "RECEIPT",
    original: "(Original)",
    receiptNo: "No.",
    date: "Date",
    reference: "Reference",
    room: "Room",
    name: "Name",
    taxId: "TAX ID",
    no: "#",
    description: "Description",
    price: "Price",
    whTax: "WH 5%",
    total: "Total",
    grandTotal: "Grand Total",
    receiver: "Receiver",
  },
  th: {
    receipt: "ใบเสร็จรับเงิน",
    original: "(ต้นฉบับ)",
    receiptNo: "เลขที่",
    date: "วันที่",
    reference: "อ้างอิง",
    room: "ห้อง",
    name: "ชื่อ",
    taxId: "TAX ID",
    no: "#",
    description: "Description / รายละเอียด",
    price: "Price / ราคา",
    whTax: "WH 5% / ณ ที่จ่าย",
    total: "Total / จำนวนเงิน",
    grandTotal: "จำนวนเงินทั้งสิ้น",
    receiver: "ผู้รับเงิน",
  },
};

// Convert number to Thai baht text
function numberToThaiText(num: number): string {
  const thaiNumbers = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const thaiPositions = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];

  if (num === 0) return "ศูนย์บาทถ้วน";

  const intPart = Math.floor(num);
  const decimalPart = Math.round((num - intPart) * 100);

  let result = "";

  const numStr = intPart.toString();
  const len = numStr.length;

  for (let i = 0; i < len; i++) {
    const digit = parseInt(numStr[i]);
    const position = len - i - 1;
    const posInGroup = position % 6;

    if (position >= 6 && posInGroup === 0 && digit !== 0) {
      result += "ล้าน";
    }

    if (digit === 0) continue;

    if (posInGroup === 1 && digit === 1) {
      result += "สิบ";
    } else if (posInGroup === 1 && digit === 2) {
      result += "ยี่สิบ";
    } else if (posInGroup === 0 && digit === 1 && len > 1) {
      result += "เอ็ด";
    } else {
      result += thaiNumbers[digit] + thaiPositions[posInGroup];
    }
  }

  result += "บาท";

  if (decimalPart > 0) {
    const decStr = decimalPart.toString().padStart(2, "0");
    const d1 = parseInt(decStr[0]);
    const d2 = parseInt(decStr[1]);

    if (d1 === 1) {
      result += "สิบ";
    } else if (d1 === 2) {
      result += "ยี่สิบ";
    } else if (d1 > 0) {
      result += thaiNumbers[d1] + "สิบ";
    }

    if (d2 === 1 && d1 > 0) {
      result += "เอ็ด";
    } else if (d2 > 0) {
      result += thaiNumbers[d2];
    }

    result += "สตางค์";
  } else {
    result += "ถ้วน";
  }

  return result;
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(date: Date): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

    // Get tenant and company info
    const tenantName = lang === "th" && receipt.invoice.tenant.nameTh
      ? receipt.invoice.tenant.nameTh
      : receipt.invoice.tenant.name;
    const tenantTaxId = receipt.invoice.tenant.taxId || "";

    const companyName = lang === "th" && receipt.invoice.project.companyNameTh
      ? receipt.invoice.project.companyNameTh
      : (receipt.invoice.project.companyName || receipt.invoice.project.name);
    const companyAddress = receipt.invoice.project.companyAddress || "";
    const companyTaxId = receipt.invoice.project.taxId || "";

    // Calculate values
    const withholdingTax = receipt.invoice.withholdingTax || 0;
    const subtotal = receipt.amount + withholdingTax;
    const totalAmount = receipt.amount;

    // Get billing month for description
    const billingMonth = receipt.invoice.billingMonth;
    const billingDate = billingMonth ? new Date(billingMonth + "-01") : new Date();
    const monthName = billingDate.toLocaleDateString("th-TH", { month: "long", year: "numeric" });
    const monthNameEn = billingDate.toLocaleDateString("en-US", { month: "long" });

    // Generate PDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // ===== HEADER SECTION =====
    // Company info - Left side
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(companyName, 20, y);
    y += 6;

    if (companyAddress) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      // Split long addresses
      const addressLines = doc.splitTextToSize(companyAddress, 90);
      addressLines.forEach((line: string) => {
        doc.text(line, 20, y);
        y += 4;
      });
    }

    if (companyTaxId) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`เลขผู้เสียภาษี ${companyTaxId}`, 20, y);
    }

    // Receipt title and info box - Right side
    const rightX = pageWidth - 80;
    let rightY = 20;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`${t.receipt} ${t.original}`, rightX, rightY);
    rightY += 8;

    // Info box
    doc.setDrawColor(180, 180, 180);
    doc.rect(rightX - 5, rightY - 4, 70, 28);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(t.receiptNo, rightX, rightY + 2);
    doc.text(receipt.receiptNo, rightX + 50, rightY + 2, { align: "right" });
    rightY += 8;

    doc.text(t.date, rightX, rightY + 2);
    doc.text(formatDate(receipt.issuedAt), rightX + 50, rightY + 2, { align: "right" });
    rightY += 8;

    doc.text(t.reference, rightX, rightY + 2);
    doc.text(receipt.invoice.invoiceNo, rightX + 50, rightY + 2, { align: "right" });

    y = Math.max(y, rightY) + 15;

    // ===== TENANT INFO SECTION =====
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    doc.text(`${t.room}:`, 20, y);
    doc.text(receipt.invoice.unit.unitNumber, 50, y);
    y += 6;

    doc.text(`${t.name}:`, 20, y);
    doc.text(tenantName, 50, y);
    y += 6;

    if (tenantTaxId) {
      doc.text(`${t.taxId}`, 20, y);
      doc.text(tenantTaxId, 50, y);
      y += 6;
    }

    y += 8;

    // ===== ITEMS TABLE =====
    const tableStartY = y;
    const colWidths = { no: 15, desc: 70, price: 35, wh: 35, total: 35 };
    const tableWidth = colWidths.no + colWidths.desc + colWidths.price + colWidths.wh + colWidths.total;
    const tableX = 20;

    // Table header
    doc.setFillColor(245, 245, 245);
    doc.rect(tableX, y - 4, tableWidth, 12, "F");
    doc.setDrawColor(200, 200, 200);
    doc.rect(tableX, y - 4, tableWidth, 12);

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");

    let colX = tableX + 3;
    doc.text(t.no, colX, y + 2);
    colX += colWidths.no;

    doc.text(t.description, colX, y + 2);
    colX += colWidths.desc;

    doc.text(t.price, colX + colWidths.price - 3, y + 2, { align: "right" });
    colX += colWidths.price;

    doc.text(t.whTax, colX + colWidths.wh - 3, y + 2, { align: "right" });
    colX += colWidths.wh;

    doc.text(t.total, colX + colWidths.total - 3, y + 2, { align: "right" });

    y += 12;

    // Table row
    doc.setFont("helvetica", "normal");
    doc.rect(tableX, y - 4, tableWidth, 10);

    colX = tableX + 3;
    doc.text("1", colX, y + 2);
    colX += colWidths.no;

    const description = `ค่าเช่า เดือน${monthName} / Rental fee ${monthNameEn}`;
    const descLines = doc.splitTextToSize(description, colWidths.desc - 5);
    doc.text(descLines[0], colX, y + 2);
    colX += colWidths.desc;

    doc.text(formatCurrency(subtotal), colX + colWidths.price - 3, y + 2, { align: "right" });
    colX += colWidths.price;

    doc.text(formatCurrency(withholdingTax), colX + colWidths.wh - 3, y + 2, { align: "right" });
    colX += colWidths.wh;

    doc.text(formatCurrency(totalAmount), colX + colWidths.total - 3, y + 2, { align: "right" });

    y += 15;

    // ===== TOTAL SECTION =====
    // Thai text total - left side
    doc.setFillColor(220, 252, 231); // Light green
    doc.rect(tableX, y - 4, 90, 10, "F");
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(numberToThaiText(totalAmount), tableX + 3, y + 2);

    // Grand total - right side
    const totalBoxX = tableX + tableWidth - 60;
    doc.setFillColor(220, 252, 231);
    doc.setDrawColor(134, 239, 172);
    doc.rect(totalBoxX, y - 4, 60, 10, "FD");

    doc.setFontSize(9);
    doc.text(t.grandTotal, totalBoxX + 3, y + 2);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(formatCurrency(totalAmount), totalBoxX + 57, y + 2, { align: "right" });

    // ===== SIGNATURE SECTION =====
    y = doc.internal.pageSize.getHeight() - 50;

    // Signature line - right side
    const sigX = pageWidth - 70;
    doc.setDrawColor(150, 150, 150);
    doc.line(sigX, y, sigX + 50, y);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(t.receiver, sigX + 25, y + 8, { align: "center" });

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
