import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { lineContactId, message, invoiceId, receiptId } = await request.json();

    let lineContact = null;
    let messageContent = message;

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

      messageContent = `
📄 ใบแจ้งหนี้ / Invoice
เลขที่: ${invoice.invoiceNo}
ห้อง: ${invoice.unit.unitNumber}
รอบบิล: ${invoice.billingMonth}
ยอดชำระ: ฿${invoice.totalAmount.toLocaleString()}
กำหนดชำระ: ${new Date(invoice.dueDate).toLocaleDateString("th-TH")}

กรุณาชำระภายในกำหนด
Please pay by the due date.
      `.trim();

      await prisma.invoice.update({
        where: { id: invoiceId },
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

    // Generate receipt message if receiptId provided
    if (receiptId) {
      const receipt = await prisma.receipt.findFirst({
        where: { id: receiptId, invoice: { project: { ownerId: session.user.id } } },
        include: { invoice: { include: { unit: true, tenant: true } } },
      });

      if (receipt) {
        messageContent = `
🧾 ใบเสร็จรับเงิน / Receipt
เลขที่: ${receipt.receiptNo}
ห้อง: ${receipt.invoice.unit.unitNumber}
จำนวนเงิน: ฿${receipt.amount.toLocaleString()}
วันที่: ${new Date(receipt.issuedAt).toLocaleDateString("th-TH")}

ขอบคุณที่ชำระเงิน
Thank you for your payment.
        `.trim();

        await prisma.receipt.update({
          where: { id: receiptId },
          data: { sentViaLine: true, sentAt: new Date() },
        });
      }
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
        messages: [{ type: "text", text: messageContent }],
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
        messageType: "text",
        content: messageContent,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error sending LINE message:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
