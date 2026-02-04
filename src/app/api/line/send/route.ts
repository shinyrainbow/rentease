import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { uploadFile, getPresignedUrl, getS3Key } from "@/lib/s3";
import { jsPDF } from "jspdf";
import { ImageResponse } from "@vercel/og";
import React from "react";

interface LineItem {
  description: string;
  amount: number;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { lineContactId, message, invoiceId, receiptId, lang = "th", format = "image" } = await request.json();

    let lineContact = null;
    let messageContent = message;
    let imageUrl: string | null = null;
    let fileUrl: string | null = null;

    // If invoiceId provided, look up LINE contact from invoice's tenant
    if (invoiceId) {
      const invoice = await prisma.invoice.findFirst({
        where: { id: invoiceId, project: { ownerId: session.user.id } },
        include: { unit: true, tenant: true, project: true },
      });

      if (!invoice) {
        return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
      }

      // Find LINE contact linked to this tenant
      lineContact = await prisma.lineContact.findFirst({
        where: {
          tenantId: invoice.tenantId,
          project: { ownerId: session.user.id }
        },
        include: { project: true },
      });

      if (!lineContact) {
        return NextResponse.json({
          error: "No LINE contact linked to this tenant",
          errorCode: "NO_LINE_CONTACT"
        }, { status: 404 });
      }

      // Generate invoice URL based on format
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "https://www.methyproperty.com");

      if (format === "pdf") {
        // Generate PDF and upload to S3
        const pdfUrl = await generateAndUploadInvoicePdf(invoice, lang);
        fileUrl = pdfUrl;
      } else {
        // Generate image and upload to S3
        const imgUrl = await generateAndUploadInvoiceImage(invoice, lang);
        imageUrl = imgUrl;
      }

      // Also prepare a text summary
      const textLabels = lang === "th" ? {
        title: "📄 ใบแจ้งหนี้",
        invoiceNo: "เลขที่",
        unit: "ห้อง",
        billingMonth: "รอบบิล",
        total: "ยอดชำระ",
        dueDate: "กำหนดชำระ",
        footer: "กรุณาชำระภายในกำหนด",
      } : {
        title: "📄 Invoice",
        invoiceNo: "Invoice No",
        unit: "Unit",
        billingMonth: "Billing Month",
        total: "Total",
        dueDate: "Due Date",
        footer: "Please pay by the due date.",
      };

      messageContent = `
${textLabels.title}
${textLabels.invoiceNo}: ${invoice.invoiceNo}
${textLabels.unit}: ${invoice.unit.unitNumber}
${textLabels.billingMonth}: ${invoice.billingMonth}
${textLabels.total}: ฿${invoice.totalAmount.toLocaleString()}
${textLabels.dueDate}: ${new Date(invoice.dueDate).toLocaleDateString(lang === "th" ? "th-TH" : "en-US")}

${textLabels.footer}
      `.trim();

      await prisma.invoice.update({
        where: { id: invoiceId },
        data: { sentViaLine: true, sentAt: new Date() },
      });
    } else if (receiptId) {
      // If receiptId provided, look up LINE contact from receipt's tenant
      const receipt = await prisma.receipt.findFirst({
        where: { id: receiptId, invoice: { project: { ownerId: session.user.id } } },
        include: { invoice: { include: { unit: true, tenant: true, project: true } } },
      });

      if (!receipt) {
        return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
      }

      // Find LINE contact linked to this tenant
      lineContact = await prisma.lineContact.findFirst({
        where: {
          tenantId: receipt.invoice.tenantId,
          project: { ownerId: session.user.id }
        },
        include: { project: true },
      });

      if (!lineContact) {
        return NextResponse.json({
          error: "No LINE contact linked to this tenant",
          errorCode: "NO_LINE_CONTACT"
        }, { status: 404 });
      }

      // Generate receipt URL based on format
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "https://www.methyproperty.com");

      if (format === "pdf") {
        // Generate PDF and upload to S3
        const pdfUrl = await generateAndUploadReceiptPdf(receipt, lang);
        fileUrl = pdfUrl;
      } else {
        // Generate image and upload to S3
        const imgUrl = await generateAndUploadReceiptImage(receipt, lang);
        imageUrl = imgUrl;
      }

      // Prepare text summary
      const textLabels = lang === "th" ? {
        title: "🧾 ใบเสร็จรับเงิน",
        receiptNo: "เลขที่",
        unit: "ห้อง",
        amount: "จำนวนเงิน",
        date: "วันที่",
        footer: "ขอบคุณที่ชำระเงิน",
      } : {
        title: "🧾 Receipt",
        receiptNo: "Receipt No",
        unit: "Unit",
        amount: "Amount",
        date: "Date",
        footer: "Thank you for your payment.",
      };

      messageContent = `
${textLabels.title}
${textLabels.receiptNo}: ${receipt.receiptNo}
${textLabels.unit}: ${receipt.invoice.unit.unitNumber}
${textLabels.amount}: ฿${receipt.amount.toLocaleString()}
${textLabels.date}: ${new Date(receipt.issuedAt).toLocaleDateString(lang === "th" ? "th-TH" : "en-US")}

${textLabels.footer}
      `.trim();

      await prisma.receipt.update({
        where: { id: receiptId },
        data: { sentViaLine: true, sentAt: new Date() },
      });
    } else if (lineContactId) {
      // Use provided lineContactId for direct messages
      lineContact = await prisma.lineContact.findFirst({
        where: { id: lineContactId, project: { ownerId: session.user.id } },
        include: { project: true },
      });
    }

    if (!lineContact || !lineContact.project.lineAccessToken) {
      return NextResponse.json({ error: "LINE contact or access token not found" }, { status: 404 });
    }

    // Build messages array
    const messages: Array<{ type: string; text?: string; originalContentUrl?: string; previewImageUrl?: string; fileName?: string }> = [];

    // Add file message if we have a PDF URL
    if (fileUrl) {
      messages.push({
        type: "file",
        originalContentUrl: fileUrl,
        fileName: `Invoice.pdf`,
      });
    }

    // Add image message if we have an invoice image URL
    if (imageUrl) {
      messages.push({
        type: "image",
        originalContentUrl: imageUrl,
        previewImageUrl: imageUrl,
      });
    }

    // Add text message
    if (messageContent) {
      messages.push({ type: "text", text: messageContent });
    }

    // Send message via LINE API
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lineContact.project.lineAccessToken}`,
      },
      body: JSON.stringify({
        to: lineContact.lineUserId,
        messages,
      }),
    });

    if (!res.ok) {
      const error = await res.json();
      console.error("LINE API error:", error);
      return NextResponse.json({ error: "Failed to send LINE message" }, { status: 500 });
    }

    // Store outgoing message
    await prisma.lineMessage.create({
      data: {
        lineContactId: lineContact.id,
        direction: "OUTGOING",
        messageType: fileUrl ? "file" : (imageUrl ? "image" : "text"),
        content: messageContent,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error sending LINE message:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Helper function to generate and upload invoice PDF
async function generateAndUploadInvoicePdf(
  invoice: {
    id: string;
    invoiceNo: string;
    type: string;
    billingMonth: string;
    dueDate: Date;
    subtotal: number;
    discountAmount: number;
    withholdingTax: number;
    totalAmount: number;
    lineItems: unknown;
    createdAt: Date;
    project: {
      name: string;
      companyName: string | null;
      companyAddress: string | null;
      taxId: string | null;
    };
    unit: { unitNumber: string };
    tenant: {
      name: string;
      nameTh: string | null;
      phone: string | null;
      taxId: string | null;
    };
  },
  lang: string
): Promise<string> {
  const t = lang === "th" ? {
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
    amount: "จำนวนเงิน (บาท)",
    subtotal: "รวม",
    discount: "ส่วนลด",
    withholdingTax: "หัก ณ ที่จ่าย",
    total: "ยอดรวมทั้งสิ้น",
    rent: "ค่าเช่ารายเดือน",
    utility: "ค่าสาธารณูปโภค",
    combined: "ค่าเช่าและสาธารณูปโภค",
    thankYou: "ขอบคุณที่ใช้บริการ",
  } : {
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
    amount: "Amount (THB)",
    subtotal: "Subtotal",
    discount: "Discount",
    withholdingTax: "Withholding Tax",
    total: "Total",
    rent: "Monthly Rent",
    utility: "Utilities",
    combined: "Rent & Utilities",
    thankYou: "Thank you for your business",
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "RENT": return t.rent;
      case "UTILITY": return t.utility;
      case "COMBINED": return t.combined;
      default: return type;
    }
  };

  const formatCurrency = (amount: number) => amount.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const formatDate = (date: Date) => new Date(date).toLocaleDateString(
    lang === "th" ? "th-TH" : "en-US",
    { year: "numeric", month: "long", day: "numeric" }
  );

  // Generate PDF
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Company header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(invoice.project.companyName || invoice.project.name, pageWidth / 2, y, { align: "center" });
  y += 8;

  if (invoice.project.companyAddress) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
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
  doc.setFont("helvetica", "bold");
  doc.text(t.invoice, pageWidth / 2, y, { align: "center" });
  y += 12;

  // Invoice details
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`${t.invoiceNo}: ${invoice.invoiceNo}`, 20, y);
  doc.text(`${t.date}: ${formatDate(invoice.createdAt)}`, pageWidth - 60, y);
  y += 6;
  doc.text(`${t.billingMonth}: ${invoice.billingMonth}`, 20, y);
  doc.text(`${t.dueDate}: ${formatDate(invoice.dueDate)}`, pageWidth - 60, y);
  y += 12;

  // Bill to section
  doc.setFont("helvetica", "bold");
  doc.text(`${t.billTo}:`, 20, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  const tenantName = lang === "th" && invoice.tenant.nameTh ? invoice.tenant.nameTh : invoice.tenant.name;
  doc.text(tenantName, 20, y);
  y += 5;
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

  // Line items table header
  doc.setFillColor(59, 130, 246);
  doc.rect(20, y, pageWidth - 40, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(t.description, 25, y + 6);
  doc.text(t.amount, pageWidth - 45, y + 6, { align: "right" });
  y += 12;
  doc.setTextColor(0, 0, 0);

  // Line items
  doc.setFont("helvetica", "normal");
  const lineItems: LineItem[] = (invoice.lineItems as LineItem[]) || [
    { description: getTypeLabel(invoice.type), amount: invoice.subtotal },
  ];

  lineItems.forEach((item, index) => {
    if (index % 2 === 0) {
      doc.setFillColor(249, 250, 251);
      doc.rect(20, y - 4, pageWidth - 40, 8, "F");
    }
    doc.text(item.description, 25, y);
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

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(t.total, totalsX, y);
  doc.setTextColor(59, 130, 246);
  doc.text(formatCurrency(invoice.totalAmount), pageWidth - 25, y, { align: "right" });
  doc.setTextColor(0, 0, 0);

  // Footer
  y = doc.internal.pageSize.getHeight() - 20;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(107, 114, 128);
  doc.text(t.thankYou, pageWidth / 2, y, { align: "center" });

  // Get PDF as buffer and upload to S3
  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  const s3Key = getS3Key("invoice", invoice.id, lang);
  await uploadFile(s3Key, pdfBuffer, "application/pdf");

  // Generate pre-signed URL (valid for 1 hour - LINE needs to fetch it quickly)
  return getPresignedUrl(s3Key, 3600);
}

// Helper function to generate and upload receipt PDF
async function generateAndUploadReceiptPdf(
  receipt: {
    id: string;
    receiptNo: string;
    amount: number;
    issuedAt: Date;
    invoice: {
      invoiceNo: string;
      project: {
        name: string;
        companyName: string | null;
        companyAddress: string | null;
        taxId: string | null;
      };
      unit: { unitNumber: string };
      tenant: {
        name: string;
        nameTh: string | null;
        phone: string | null;
        taxId: string | null;
      };
    };
  },
  lang: string
): Promise<string> {
  const t = lang === "th" ? {
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
  } : {
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
  };

  const formatCurrency = (amount: number) => amount.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const formatDate = (date: Date) => new Date(date).toLocaleDateString(
    lang === "th" ? "th-TH" : "en-US",
    { year: "numeric", month: "long", day: "numeric" }
  );

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

  // Receipt title (green)
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(22, 163, 74);
  doc.text(t.receipt, pageWidth / 2, y, { align: "center" });
  doc.setTextColor(0, 0, 0);
  y += 12;

  // Receipt details
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`${t.receiptNo}: ${receipt.receiptNo}`, 20, y);
  doc.text(`${t.date}: ${formatDate(receipt.issuedAt)}`, pageWidth - 60, y);
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
  y += 10;

  // Amount table header (green)
  doc.setFillColor(22, 163, 74);
  doc.rect(20, y, pageWidth - 40, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(t.description, 25, y + 6);
  doc.text(t.amount, pageWidth - 45, y + 6, { align: "right" });
  y += 12;
  doc.setTextColor(0, 0, 0);

  // Payment row
  doc.setFont("helvetica", "normal");
  doc.setFillColor(240, 253, 244);
  doc.rect(20, y - 4, pageWidth - 40, 10, "F");
  doc.text(`${t.payment} - ${receipt.invoice.invoiceNo}`, 25, y + 2);
  doc.setTextColor(22, 163, 74);
  doc.text(formatCurrency(receipt.amount), pageWidth - 45, y + 2, { align: "right" });
  doc.setTextColor(0, 0, 0);
  y += 15;

  // Total box (green)
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

  // Get PDF as buffer and upload to S3
  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  const s3Key = getS3Key("receipt", receipt.id, lang);
  await uploadFile(s3Key, pdfBuffer, "application/pdf");

  // Generate pre-signed URL
  return getPresignedUrl(s3Key, 3600);
}

// Helper function to generate and upload invoice image
async function generateAndUploadInvoiceImage(
  invoice: {
    id: string;
    invoiceNo: string;
    type: string;
    billingMonth: string;
    dueDate: Date;
    subtotal: number;
    discountAmount: number;
    withholdingTax: number;
    totalAmount: number;
    lineItems: unknown;
    createdAt: Date;
    project: {
      name: string;
      companyName: string | null;
      companyAddress: string | null;
      taxId: string | null;
    };
    unit: { unitNumber: string };
    tenant: {
      name: string;
      nameTh: string | null;
      phone: string | null;
      taxId: string | null;
    };
  },
  lang: string
): Promise<string> {
  const t = lang === "th" ? {
    invoice: "ใบแจ้งหนี้",
    invoiceNo: "เลขที่",
    date: "วันที่",
    billingMonth: "รอบบิล",
    dueDate: "กำหนดชำระ",
    billTo: "เรียกเก็บจาก",
    unit: "ห้อง",
    phone: "โทร",
    taxId: "เลขผู้เสียภาษี",
    subtotal: "รวม",
    discount: "ส่วนลด",
    withholdingTax: "หัก ณ ที่จ่าย",
    total: "ยอดชำระ",
    rent: "ค่าเช่า",
    utility: "ค่าสาธารณูปโภค",
    combined: "รวมค่าเช่าและสาธารณูปโภค",
  } : {
    invoice: "INVOICE",
    invoiceNo: "Invoice No",
    date: "Date",
    billingMonth: "Billing Month",
    dueDate: "Due Date",
    billTo: "Bill To",
    unit: "Unit",
    phone: "Phone",
    taxId: "Tax ID",
    subtotal: "Subtotal",
    discount: "Discount",
    withholdingTax: "W/H Tax",
    total: "Total",
    rent: "Rent",
    utility: "Utilities",
    combined: "Rent & Utilities",
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "RENT": return t.rent;
      case "UTILITY": return t.utility;
      case "COMBINED": return t.combined;
      default: return type;
    }
  };

  const formatCurrency = (amount: number) => `฿${amount.toLocaleString()}`;
  const formatDate = (date: Date) => new Date(date).toLocaleDateString(
    lang === "th" ? "th-TH" : "en-US",
    { year: "numeric", month: "short", day: "numeric" }
  );

  const lineItems: LineItem[] = (invoice.lineItems as LineItem[]) || [
    { description: getTypeLabel(invoice.type), amount: invoice.subtotal },
  ];
  const tenantName = lang === "th" && invoice.tenant.nameTh ? invoice.tenant.nameTh : invoice.tenant.name;

  const imageResponse = new ImageResponse(
    React.createElement(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          backgroundColor: "white",
          padding: "40px",
          fontFamily: "sans-serif",
        },
      },
      // Header
      React.createElement(
        "div",
        { style: { display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "20px" } },
        React.createElement("div", { style: { fontSize: "28px", fontWeight: "bold", color: "#1f2937" } }, invoice.project.companyName || invoice.project.name),
        invoice.project.companyAddress && React.createElement("div", { style: { fontSize: "14px", color: "#6b7280", marginTop: "4px" } }, invoice.project.companyAddress),
      ),
      // Title
      React.createElement(
        "div",
        { style: { display: "flex", justifyContent: "center", marginBottom: "20px" } },
        React.createElement("div", { style: { fontSize: "24px", fontWeight: "bold", color: "#3b82f6", padding: "8px 24px", backgroundColor: "#eff6ff", borderRadius: "8px" } }, t.invoice)
      ),
      // Invoice Details
      React.createElement(
        "div",
        { style: { display: "flex", justifyContent: "space-between", marginBottom: "20px", fontSize: "14px" } },
        React.createElement(
          "div",
          { style: { display: "flex", flexDirection: "column" } },
          React.createElement("div", { style: { display: "flex" } }, React.createElement("span", { style: { color: "#6b7280" } }, `${t.invoiceNo}: `), React.createElement("span", { style: { fontWeight: "bold" } }, invoice.invoiceNo)),
          React.createElement("div", { style: { display: "flex" } }, React.createElement("span", { style: { color: "#6b7280" } }, `${t.billingMonth}: `), React.createElement("span", null, invoice.billingMonth)),
        ),
        React.createElement(
          "div",
          { style: { display: "flex", flexDirection: "column", alignItems: "flex-end" } },
          React.createElement("div", { style: { display: "flex" } }, React.createElement("span", { style: { color: "#6b7280" } }, `${t.date}: `), React.createElement("span", null, formatDate(invoice.createdAt))),
          React.createElement("div", { style: { display: "flex" } }, React.createElement("span", { style: { color: "#6b7280" } }, `${t.dueDate}: `), React.createElement("span", { style: { color: "#dc2626" } }, formatDate(invoice.dueDate))),
        )
      ),
      // Bill To
      React.createElement(
        "div",
        { style: { display: "flex", flexDirection: "column", backgroundColor: "#f9fafb", padding: "16px", borderRadius: "8px", marginBottom: "20px" } },
        React.createElement("div", { style: { fontSize: "12px", color: "#6b7280", marginBottom: "4px" } }, t.billTo),
        React.createElement("div", { style: { fontSize: "16px", fontWeight: "bold" } }, tenantName),
        React.createElement("div", { style: { fontSize: "14px", color: "#4b5563" } }, `${t.unit}: ${invoice.unit.unitNumber}`),
        invoice.tenant.phone && React.createElement("div", { style: { fontSize: "14px", color: "#4b5563" } }, `${t.phone}: ${invoice.tenant.phone}`),
      ),
      // Line Items
      React.createElement(
        "div",
        { style: { display: "flex", flexDirection: "column", marginBottom: "20px" } },
        ...lineItems.map((item, i) =>
          React.createElement(
            "div",
            { key: i, style: { display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #e5e7eb" } },
            React.createElement("span", null, item.description),
            React.createElement("span", { style: { fontWeight: "500" } }, formatCurrency(item.amount))
          )
        )
      ),
      // Totals
      React.createElement(
        "div",
        { style: { display: "flex", flexDirection: "column", alignItems: "flex-end" } },
        React.createElement(
          "div",
          { style: { display: "flex", justifyContent: "space-between", width: "200px", marginBottom: "8px" } },
          React.createElement("span", { style: { color: "#6b7280" } }, t.subtotal),
          React.createElement("span", null, formatCurrency(invoice.subtotal))
        ),
        invoice.discountAmount > 0 && React.createElement(
          "div",
          { style: { display: "flex", justifyContent: "space-between", width: "200px", marginBottom: "8px" } },
          React.createElement("span", { style: { color: "#6b7280" } }, t.discount),
          React.createElement("span", { style: { color: "#16a34a" } }, `-${formatCurrency(invoice.discountAmount)}`)
        ),
        invoice.withholdingTax > 0 && React.createElement(
          "div",
          { style: { display: "flex", justifyContent: "space-between", width: "200px", marginBottom: "8px" } },
          React.createElement("span", { style: { color: "#6b7280" } }, t.withholdingTax),
          React.createElement("span", null, `-${formatCurrency(invoice.withholdingTax)}`)
        ),
        React.createElement(
          "div",
          { style: { display: "flex", justifyContent: "space-between", width: "200px", padding: "12px", backgroundColor: "#3b82f6", borderRadius: "8px", marginTop: "8px" } },
          React.createElement("span", { style: { color: "white", fontWeight: "bold" } }, t.total),
          React.createElement("span", { style: { color: "white", fontWeight: "bold", fontSize: "18px" } }, formatCurrency(invoice.totalAmount))
        )
      )
    ),
    { width: 600, height: 800 }
  );

  // Convert Response to buffer
  const arrayBuffer = await imageResponse.arrayBuffer();
  const imageBuffer = Buffer.from(arrayBuffer);

  // Upload to S3
  const s3Key = `invoices/${invoice.id}/image-${lang}.png`;
  await uploadFile(s3Key, imageBuffer, "image/png");

  // Generate pre-signed URL (valid for 1 hour)
  return getPresignedUrl(s3Key, 3600);
}

// Helper function to generate and upload receipt image
async function generateAndUploadReceiptImage(
  receipt: {
    id: string;
    receiptNo: string;
    amount: number;
    issuedAt: Date;
    invoice: {
      invoiceNo: string;
      project: {
        name: string;
        companyName: string | null;
        companyAddress: string | null;
        taxId: string | null;
      };
      unit: { unitNumber: string };
      tenant: {
        name: string;
        nameTh: string | null;
        phone: string | null;
        taxId: string | null;
      };
    };
  },
  lang: string
): Promise<string> {
  const t = lang === "th" ? {
    receipt: "ใบเสร็จรับเงิน",
    receiptNo: "เลขที่",
    date: "วันที่",
    invoiceRef: "อ้างอิง",
    receivedFrom: "รับเงินจาก",
    unit: "ห้อง",
    phone: "โทร",
    total: "รวมเงินที่รับ",
    thankYou: "ขอบคุณที่ชำระเงิน",
  } : {
    receipt: "RECEIPT",
    receiptNo: "Receipt No",
    date: "Date",
    invoiceRef: "Reference",
    receivedFrom: "Received From",
    unit: "Unit",
    phone: "Phone",
    total: "Total Received",
    thankYou: "Thank you for your payment",
  };

  const formatCurrency = (amount: number) => `฿${amount.toLocaleString()}`;
  const formatDate = (date: Date) => new Date(date).toLocaleDateString(
    lang === "th" ? "th-TH" : "en-US",
    { year: "numeric", month: "short", day: "numeric" }
  );

  const tenantName = lang === "th" && receipt.invoice.tenant.nameTh ? receipt.invoice.tenant.nameTh : receipt.invoice.tenant.name;

  const imageResponse = new ImageResponse(
    React.createElement(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          backgroundColor: "white",
          padding: "40px",
          fontFamily: "sans-serif",
        },
      },
      // Header
      React.createElement(
        "div",
        { style: { display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "20px" } },
        React.createElement("div", { style: { fontSize: "28px", fontWeight: "bold", color: "#1f2937" } }, receipt.invoice.project.companyName || receipt.invoice.project.name),
        receipt.invoice.project.companyAddress && React.createElement("div", { style: { fontSize: "14px", color: "#6b7280", marginTop: "4px" } }, receipt.invoice.project.companyAddress),
      ),
      // Title (green for receipt)
      React.createElement(
        "div",
        { style: { display: "flex", justifyContent: "center", marginBottom: "20px" } },
        React.createElement("div", { style: { fontSize: "24px", fontWeight: "bold", color: "#16a34a", padding: "8px 24px", backgroundColor: "#f0fdf4", borderRadius: "8px" } }, t.receipt)
      ),
      // Receipt Details
      React.createElement(
        "div",
        { style: { display: "flex", justifyContent: "space-between", marginBottom: "20px", fontSize: "14px" } },
        React.createElement(
          "div",
          { style: { display: "flex", flexDirection: "column" } },
          React.createElement("div", { style: { display: "flex" } }, React.createElement("span", { style: { color: "#6b7280" } }, `${t.receiptNo}: `), React.createElement("span", { style: { fontWeight: "bold" } }, receipt.receiptNo)),
          React.createElement("div", { style: { display: "flex" } }, React.createElement("span", { style: { color: "#6b7280" } }, `${t.invoiceRef}: `), React.createElement("span", null, receipt.invoice.invoiceNo)),
        ),
        React.createElement(
          "div",
          { style: { display: "flex", flexDirection: "column", alignItems: "flex-end" } },
          React.createElement("div", { style: { display: "flex" } }, React.createElement("span", { style: { color: "#6b7280" } }, `${t.date}: `), React.createElement("span", null, formatDate(receipt.issuedAt))),
        )
      ),
      // Received From
      React.createElement(
        "div",
        { style: { display: "flex", flexDirection: "column", backgroundColor: "#f0fdf4", padding: "16px", borderRadius: "8px", marginBottom: "20px" } },
        React.createElement("div", { style: { fontSize: "12px", color: "#6b7280", marginBottom: "4px" } }, t.receivedFrom),
        React.createElement("div", { style: { fontSize: "16px", fontWeight: "bold" } }, tenantName),
        React.createElement("div", { style: { fontSize: "14px", color: "#4b5563" } }, `${t.unit}: ${receipt.invoice.unit.unitNumber}`),
        receipt.invoice.tenant.phone && React.createElement("div", { style: { fontSize: "14px", color: "#4b5563" } }, `${t.phone}: ${receipt.invoice.tenant.phone}`),
      ),
      // Amount Box
      React.createElement(
        "div",
        { style: { display: "flex", flexDirection: "column", alignItems: "center", marginTop: "20px" } },
        React.createElement(
          "div",
          { style: { display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 48px", backgroundColor: "#16a34a", borderRadius: "12px" } },
          React.createElement("span", { style: { color: "white", fontSize: "14px", marginBottom: "8px" } }, t.total),
          React.createElement("span", { style: { color: "white", fontWeight: "bold", fontSize: "32px" } }, formatCurrency(receipt.amount))
        )
      ),
      // Thank You
      React.createElement(
        "div",
        { style: { display: "flex", justifyContent: "center", marginTop: "auto" } },
        React.createElement("span", { style: { color: "#6b7280", fontSize: "14px" } }, t.thankYou)
      )
    ),
    { width: 600, height: 600 }
  );

  // Convert Response to buffer
  const arrayBuffer = await imageResponse.arrayBuffer();
  const imageBuffer = Buffer.from(arrayBuffer);

  // Upload to S3
  const s3Key = `receipts/${receipt.id}/image-${lang}.png`;
  await uploadFile(s3Key, imageBuffer, "image/png");

  // Generate pre-signed URL (valid for 1 hour)
  return getPresignedUrl(s3Key, 3600);
}
