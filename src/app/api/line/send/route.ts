import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { uploadFile, getPresignedUrl, getPublicUrl, getS3Key, isS3Key } from "@/lib/s3";
import { jsPDF } from "jspdf";

interface LineItem {
  description: string;
  amount: number;
}

// Helper function to fetch logo and convert to data URL for PDF
async function fetchLogoAsDataUrl(logoUrl: string): Promise<string | undefined> {
  if (!logoUrl) return undefined;

  try {
    const response = await fetch(logoUrl);
    if (!response.ok) return undefined;

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const contentType = response.headers.get("content-type") || "image/png";
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error("Error fetching logo for PDF:", error);
    return undefined;
  }
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

    // If invoiceId provided, look up LINE contact from invoice's tenant
    if (invoiceId) {
      const invoice = await prisma.invoice.findFirst({
        where: { id: invoiceId, project: { ownerId: session.user.id } },
        include: {
          unit: true,
          tenant: true,
          project: {
            include: {
              owner: { select: { name: true } },
            },
          },
        },
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

      // Use direct image URL that LINE will fetch (Edge runtime generates on-demand)
      const host = request.headers.get("host") || "";
      const protocol = host.includes("localhost") ? "http" : "https";
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `${protocol}://${host}`);
      console.log("Using baseUrl for image generation:", baseUrl);
      const tenantName = lang === "th" && invoice.tenant.nameTh ? invoice.tenant.nameTh : invoice.tenant.name;
      const companyName = lang === "th" && invoice.project.companyNameTh ? invoice.project.companyNameTh : (invoice.project.companyName || invoice.project.name);

      // Generate presigned URL for logo if it's an S3 key
      let logoUrl = "";
      const logoKeyOrUrl = invoice.project.logoUrl || "";
      if (logoKeyOrUrl) {
        if (isS3Key(logoKeyOrUrl)) {
          try {
            logoUrl = await getPresignedUrl(logoKeyOrUrl, 3600);
          } catch (e) {
            console.error("Error getting presigned URL for logo:", e);
          }
        } else {
          logoUrl = logoKeyOrUrl;
        }
      }

      const params = new URLSearchParams({
        lang,
        invoiceNo: invoice.invoiceNo,
        billingMonth: invoice.billingMonth,
        dueDate: invoice.dueDate.toISOString(),
        dateCreated: invoice.createdAt.toISOString(),
        totalAmount: String(invoice.totalAmount),
        unitNumber: invoice.unit.unitNumber,
        tenantName,
        tenantAddress: invoice.tenant.address || "",
        tenantTaxId: invoice.tenant.taxId || "",
        tenantIdCard: invoice.tenant.idCard || "",
        companyName,
        companyNameTh: invoice.project.companyNameTh || "",
        companyAddress: invoice.project.companyAddress || "",
        taxId: invoice.project.taxId || "",
        logoUrl,
        ownerName: invoice.project.owner?.name || "",
        // Additional details
        subtotal: String(invoice.subtotal),
        withholdingTax: String(invoice.withholdingTax || 0),
        withholdingTaxPercent: String(invoice.tenant.withholdingTax || 0),
        lineItems: JSON.stringify(invoice.lineItems || []),
        // Bank info for payment
        bankName: invoice.project.bankName || "",
        bankAccountName: invoice.project.bankAccountName || "",
        bankAccountNumber: invoice.project.bankAccountNumber || "",
      });

      // Pre-generate the image and upload to S3 for reliable delivery
      const imageGenerateUrl = `${baseUrl}/api/invoices/${invoice.id}/line-image?${params.toString()}`;
      console.log("Generating invoice image from:", imageGenerateUrl.substring(0, 100) + "...");

      try {
        const imageResponse = await fetch(imageGenerateUrl);
        console.log("Image generation response status:", imageResponse.status);

        if (imageResponse.ok) {
          const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
          console.log("Image buffer size:", imageBuffer.length, "bytes");

          const s3Key = `line-images/invoice-${invoice.id}-${lang}-${Date.now()}.png`;
          // Upload with public-read ACL for LINE delivery
          await uploadFile(s3Key, imageBuffer, "image/png", true);
          imageUrl = getPublicUrl(s3Key);
          console.log("Image uploaded to S3, public URL:", imageUrl);
        } else {
          const errorText = await imageResponse.text();
          console.error("Failed to generate invoice image:", imageResponse.status, errorText);
          // Fallback to direct URL
          imageUrl = imageGenerateUrl;
        }
      } catch (imgError) {
        console.error("Error generating/uploading invoice image:", imgError);
        imageUrl = imageGenerateUrl;
      }

      // Prepare a text summary
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
${textLabels.dueDate}: ${(() => { const d = new Date(invoice.dueDate); const thMonths = ["มค", "กพ", "มีค", "เมย", "พค", "มิย", "กค", "สค", "กย", "ตค", "พย", "ธค"]; const enMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]; return `${d.getDate()} ${lang === "th" ? thMonths[d.getMonth()] : enMonths[d.getMonth()]} ${d.getFullYear()}`; })()}

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
        include: {
          invoice: {
            include: {
              unit: true,
              tenant: true,
              project: {
                include: {
                  owner: { select: { name: true } },
                },
              },
            },
          },
        },
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

      // Use direct image URL that LINE will fetch (Edge runtime generates on-demand)
      const host = request.headers.get("host") || "";
      const protocol = host.includes("localhost") ? "http" : "https";
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `${protocol}://${host}`);
      console.log("Using baseUrl for receipt image generation:", baseUrl);
      const tenantName = lang === "th" && receipt.invoice.tenant.nameTh ? receipt.invoice.tenant.nameTh : receipt.invoice.tenant.name;
      const companyName = lang === "th" && receipt.invoice.project.companyNameTh ? receipt.invoice.project.companyNameTh : (receipt.invoice.project.companyName || receipt.invoice.project.name);

      // Generate presigned URL for logo if it's an S3 key
      let logoUrl = "";
      const logoKeyOrUrl = receipt.invoice.project.logoUrl || "";
      if (logoKeyOrUrl) {
        if (isS3Key(logoKeyOrUrl)) {
          try {
            logoUrl = await getPresignedUrl(logoKeyOrUrl, 3600);
          } catch (e) {
            console.error("Error getting presigned URL for logo:", e);
          }
        } else {
          logoUrl = logoKeyOrUrl;
        }
      }

      const params = new URLSearchParams({
        lang,
        receiptNo: receipt.receiptNo,
        invoiceNo: receipt.invoice.invoiceNo,
        amount: String(receipt.amount),
        issuedAt: receipt.issuedAt.toISOString(),
        unitNumber: receipt.invoice.unit.unitNumber,
        tenantName,
        tenantAddress: receipt.invoice.tenant.address || "",
        tenantTaxId: receipt.invoice.tenant.taxId || "",
        tenantIdCard: receipt.invoice.tenant.idCard || "",
        companyName,
        companyNameTh: receipt.invoice.project.companyNameTh || "",
        companyAddress: receipt.invoice.project.companyAddress || "",
        companyTaxId: receipt.invoice.project.taxId || "",
        logoUrl,
        ownerName: receipt.invoice.project.owner?.name || "",
        // Additional details
        billingMonth: receipt.invoice.billingMonth,
        subtotal: String(receipt.invoice.subtotal),
        withholdingTax: String(receipt.invoice.withholdingTax || 0),
        withholdingTaxPercent: String(receipt.invoice.tenant.withholdingTax || 0),
        lineItems: JSON.stringify(receipt.invoice.lineItems || []),
        // Bank info
        bankName: receipt.invoice.project.bankName || "",
        bankAccountName: receipt.invoice.project.bankAccountName || "",
        bankAccountNumber: receipt.invoice.project.bankAccountNumber || "",
      });

      // Pre-generate the image and upload to S3 for reliable delivery
      const imageGenerateUrl = `${baseUrl}/api/receipts/${receipt.id}/line-image?${params.toString()}`;
      console.log("Generating receipt image from:", imageGenerateUrl.substring(0, 100) + "...");

      try {
        const imageResponse = await fetch(imageGenerateUrl);
        console.log("Receipt image generation response status:", imageResponse.status);

        if (imageResponse.ok) {
          const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
          console.log("Receipt image buffer size:", imageBuffer.length, "bytes");
          const s3Key = `line-images/receipt-${receipt.id}-${lang}-${Date.now()}.png`;
          // Upload with public-read ACL for LINE delivery
          await uploadFile(s3Key, imageBuffer, "image/png", true);
          imageUrl = getPublicUrl(s3Key);
          console.log("Receipt image uploaded to S3, public URL:", imageUrl);
        } else {
          const errorText = await imageResponse.text();
          console.error("Failed to generate receipt image:", imageResponse.status, errorText);
          // Fallback to direct URL
          imageUrl = imageGenerateUrl;
        }
      } catch (imgError) {
        console.error("Error generating/uploading receipt image:", imgError);
        imageUrl = imageGenerateUrl;
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
${textLabels.date}: ${(() => { const d = new Date(receipt.issuedAt); const thMonths = ["มค", "กพ", "มีค", "เมย", "พค", "มิย", "กค", "สค", "กย", "ตค", "พย", "ธค"]; const enMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]; return `${d.getDate()} ${lang === "th" ? thMonths[d.getMonth()] : enMonths[d.getMonth()]} ${d.getFullYear()}`; })()}

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
    const messages: Array<{ type: string; text?: string; originalContentUrl?: string; previewImageUrl?: string }> = [];

    // Add image message if we have an image URL (for invoices/receipts)
    if (imageUrl) {
      // Verify the image URL is accessible before sending to LINE
      console.log("Verifying image URL accessibility...");
      try {
        const verifyRes = await fetch(imageUrl, { method: "HEAD" });
        console.log("Image URL verify status:", verifyRes.status);
        if (!verifyRes.ok) {
          console.error("Image URL is not accessible:", verifyRes.status);
        }
      } catch (verifyError) {
        console.error("Error verifying image URL:", verifyError);
      }

      messages.push({
        type: "image",
        originalContentUrl: imageUrl,
        previewImageUrl: imageUrl,
      });
      console.log("Image URL length:", imageUrl.length);
    } else if (messageContent) {
      // Only add text message if no image (for direct messages)
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

    console.log("LINE API response status:", res.status);
    console.log("Image URL length:", imageUrl?.length || 0);

    const responseText = await res.text();
    console.log("LINE API response body:", responseText);

    if (!res.ok) {
      console.error("LINE API error status:", res.status);
      console.error("LINE API error body:", responseText);
      console.error("Full image URL that failed:", imageUrl);
      return NextResponse.json({ error: "Failed to send LINE message", details: responseText }, { status: 500 });
    }

    // Store outgoing message
    await prisma.lineMessage.create({
      data: {
        lineContactId: lineContact.id,
        direction: "OUTGOING",
        messageType: imageUrl ? "image" : "text",
        content: messageContent,
        mediaUrl: imageUrl || undefined,
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
      logoUrl: string | null;
    };
    unit: { unitNumber: string };
    tenant: {
      name: string;
      nameTh: string | null;
      phone: string | null;
      taxId: string | null;
    };
  },
  lang: string,
  logoDataUrl?: string
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

  const thaiMonths = ["มค", "กพ", "มีค", "เมย", "พค", "มิย", "กค", "สค", "กย", "ตค", "พย", "ธค"];
  const engMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const formatDate = (date: Date) => {
    const d = new Date(date);
    const day = d.getDate();
    const month = lang === "th" ? thaiMonths[d.getMonth()] : engMonths[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  };

  // Generate PDF
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Company logo (if available)
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", pageWidth / 2 - 15, y, 30, 30);
      y += 35;
    } catch (logoError) {
      console.error("Error adding logo to invoice PDF:", logoError);
    }
  }

  // Company header
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(invoice.project.companyName || invoice.project.name, pageWidth / 2, y, { align: "center" });
  y += 6;

  if (invoice.project.companyAddress) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(invoice.project.companyAddress, pageWidth / 2, y, { align: "center" });
    y += 5;
  }

  if (invoice.project.taxId) {
    doc.text(`${t.taxId}: ${invoice.project.taxId}`, pageWidth / 2, y, { align: "center" });
    y += 6;
  }

  y += 10;

  // Invoice title (teal)
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(45, 139, 139); // Teal color
  doc.text(t.invoice, pageWidth / 2, y, { align: "center" });
  doc.setTextColor(0, 0, 0);
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

  // Line items table header (teal)
  doc.setFillColor(45, 139, 139);
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
      doc.setFillColor(240, 253, 250); // Light teal
      doc.rect(20, y - 4, pageWidth - 40, 8, "F");
    }
    doc.text(item.description, 25, y);
    doc.setTextColor(45, 139, 139); // Teal for amounts
    doc.text(formatCurrency(item.amount), pageWidth - 45, y, { align: "right" });
    doc.setTextColor(0, 0, 0);
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

  // Total box (teal)
  y += 5;
  doc.setFillColor(45, 139, 139);
  doc.rect(pageWidth - 100, y, 80, 12, "F");
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(t.total, pageWidth - 95, y + 8);
  doc.text(formatCurrency(invoice.totalAmount), pageWidth - 25, y + 8, { align: "right" });
  doc.setTextColor(0, 0, 0);

  // Footer
  y = doc.internal.pageSize.getHeight() - 12;
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
        logoUrl: string | null;
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
  lang: string,
  logoDataUrl?: string
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

  const thaiMonths = ["มค", "กพ", "มีค", "เมย", "พค", "มิย", "กค", "สค", "กย", "ตค", "พย", "ธค"];
  const engMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const formatDate = (date: Date) => {
    const d = new Date(date);
    const day = d.getDate();
    const month = lang === "th" ? thaiMonths[d.getMonth()] : engMonths[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  };

  // Generate PDF
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Company logo (if available)
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", pageWidth / 2 - 15, y, 30, 30);
      y += 35;
    } catch (logoError) {
      console.error("Error adding logo to receipt PDF:", logoError);
    }
  }

  // Company header
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(receipt.invoice.project.companyName || receipt.invoice.project.name, pageWidth / 2, y, { align: "center" });
  y += 6;

  if (receipt.invoice.project.companyAddress) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(receipt.invoice.project.companyAddress, pageWidth / 2, y, { align: "center" });
    y += 5;
  }

  if (receipt.invoice.project.taxId) {
    doc.text(`${t.taxId}: ${receipt.invoice.project.taxId}`, pageWidth / 2, y, { align: "center" });
    y += 5;
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
  y = doc.internal.pageSize.getHeight() - 12;
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
