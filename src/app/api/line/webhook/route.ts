import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";

function verifySignature(body: string, signature: string, channelSecret: string): boolean {
  const hash = crypto
    .createHmac("SHA256", channelSecret)
    .update(body)
    .digest("base64");
  return hash === signature;
}

async function getLineProfile(userId: string, accessToken: string) {
  try {
    const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (res.ok) {
      return res.json();
    }
    return null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("x-line-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    const data = JSON.parse(body);
    const events = data.events || [];

    for (const event of events) {
      const { replyToken, source, message, type } = event;
      const lineUserId = source?.userId;

      if (!lineUserId) continue;

      // Find existing LINE contact
      let lineContact = await prisma.lineContact.findFirst({
        where: { lineUserId },
        include: { project: true },
      });

      let project = lineContact?.project;

      // If no existing contact, find project by verifying signature with all configured projects
      if (!project) {
        const projects = await prisma.project.findMany({
          where: {
            lineAccessToken: { not: null },
            lineChannelSecret: { not: null },
          },
        });

        for (const p of projects) {
          if (p.lineChannelSecret && verifySignature(body, signature, p.lineChannelSecret)) {
            project = p;
            break;
          }
        }
      }

      if (!project) {
        console.log("Could not identify project for LINE webhook");
        continue;
      }

      // Verify signature
      if (!verifySignature(body, signature, project.lineChannelSecret || "")) {
        console.log("Invalid signature");
        continue;
      }

      // Handle follow event - user added the LINE OA
      if (type === "follow") {
        const profile = await getLineProfile(lineUserId, project.lineAccessToken || "");

        if (!lineContact) {
          // Create new LINE contact
          lineContact = await prisma.lineContact.create({
            data: {
              projectId: project.id,
              lineUserId,
              displayName: profile?.displayName || "Unknown User",
              pictureUrl: profile?.pictureUrl,
              statusMessage: profile?.statusMessage,
            },
            include: { project: true },
          });

          // Send welcome message
          await fetch("https://api.line.me/v2/bot/message/reply", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${project.lineAccessToken}`,
            },
            body: JSON.stringify({
              replyToken,
              messages: [{
                type: "text",
                text: `สวัสดีค่ะ ${profile?.displayName || ""} ยินดีต้อนรับสู่ ${project.name}\nHello! Welcome to ${project.name}`,
              }],
            }),
          });
        } else {
          // Update existing contact profile
          await prisma.lineContact.update({
            where: { id: lineContact.id },
            data: {
              displayName: profile?.displayName,
              pictureUrl: profile?.pictureUrl,
              statusMessage: profile?.statusMessage,
            },
          });
        }
        continue;
      }

      // For message events, auto-create contact if doesn't exist
      if (!lineContact) {
        const profile = await getLineProfile(lineUserId, project.lineAccessToken || "");
        lineContact = await prisma.lineContact.create({
          data: {
            projectId: project.id,
            lineUserId,
            displayName: profile?.displayName || "Unknown User",
            pictureUrl: profile?.pictureUrl,
            statusMessage: profile?.statusMessage,
          },
          include: { project: true },
        });
      }

      // Handle message event
      if (type === "message" && message) {
        // Store incoming message
        await prisma.lineMessage.create({
          data: {
            lineContactId: lineContact.id,
            direction: "INCOMING",
            messageType: message.type,
            content: message.text || null,
            mediaUrl: message.type === "image" ? message.id : null,
          },
        });

        // Check if message contains maintenance request keywords
        if (message.type === "text") {
          const text = message.text.toLowerCase();
          if (
            text.includes("แจ้งซ่อม") ||
            text.includes("repair") ||
            text.includes("maintenance") ||
            text.includes("broken") ||
            text.includes("ซ่อม")
          ) {
            // Create maintenance request if tenant is linked
            if (lineContact.tenantId) {
              const tenant = await prisma.tenant.findUnique({
                where: { id: lineContact.tenantId },
                include: { unit: true },
              });

              if (tenant) {
                await prisma.maintenanceRequest.create({
                  data: {
                    projectId: lineContact.projectId,
                    unitId: tenant.unitId,
                    title: "แจ้งซ่อมจาก LINE / Maintenance from LINE",
                    description: message.text,
                    category: "GENERAL",
                    priority: "MEDIUM",
                    lineMessageId: message.id,
                  },
                });

                // Send confirmation reply
                await fetch("https://api.line.me/v2/bot/message/reply", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${project.lineAccessToken}`,
                  },
                  body: JSON.stringify({
                    replyToken,
                    messages: [{
                      type: "text",
                      text: `รับแจ้งซ่อมเรียบร้อยแล้วค่ะ ห้อง ${tenant.unit.unitNumber}\nMaintenance request received for unit ${tenant.unit.unitNumber}. Thank you!`,
                    }],
                  }),
                });
              }
            } else {
              // Contact not linked to tenant yet
              await fetch("https://api.line.me/v2/bot/message/reply", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${project.lineAccessToken}`,
                },
                body: JSON.stringify({
                  replyToken,
                  messages: [{
                    type: "text",
                    text: "กรุณาติดต่อเจ้าหน้าที่เพื่อลงทะเบียนห้องของท่านก่อนค่ะ\nPlease contact staff to register your unit first.",
                  }],
                }),
              });
            }
          }

          // Check for payment slip keywords
          if (
            text.includes("ส่งสลิป") ||
            text.includes("ชำระเงิน") ||
            text.includes("pay") ||
            text.includes("payment") ||
            text.includes("slip")
          ) {
            if (lineContact.tenantId) {
              // Check if tenant has unpaid invoices
              const unpaidInvoices = await prisma.invoice.findMany({
                where: {
                  tenantId: lineContact.tenantId,
                  status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
                },
              });

              if (unpaidInvoices.length > 0 && project.liffId) {
                // Send Flex Message with LIFF button
                const liffUrl = `https://liff.line.me/${project.liffId}`;
                await fetch("https://api.line.me/v2/bot/message/reply", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${project.lineAccessToken}`,
                  },
                  body: JSON.stringify({
                    replyToken,
                    messages: [{
                      type: "flex",
                      altText: "ส่งสลิปชำระเงิน",
                      contents: {
                        type: "bubble",
                        body: {
                          type: "box",
                          layout: "vertical",
                          contents: [
                            {
                              type: "text",
                              text: "ส่งสลิปชำระเงิน",
                              weight: "bold",
                              size: "xl",
                              color: "#1DB446",
                            },
                            {
                              type: "text",
                              text: `คุณมี ${unpaidInvoices.length} รายการค้างชำระ`,
                              margin: "md",
                              color: "#666666",
                            },
                            {
                              type: "text",
                              text: "กดปุ่มด้านล่างเพื่อส่งสลิป",
                              margin: "sm",
                              size: "sm",
                              color: "#999999",
                            },
                          ],
                        },
                        footer: {
                          type: "box",
                          layout: "vertical",
                          contents: [
                            {
                              type: "button",
                              action: {
                                type: "uri",
                                label: "ส่งสลิป",
                                uri: liffUrl,
                              },
                              style: "primary",
                              color: "#1DB446",
                            },
                          ],
                        },
                      },
                    }],
                  }),
                });
              } else if (unpaidInvoices.length > 0) {
                // No LIFF configured, send text message
                await fetch("https://api.line.me/v2/bot/message/reply", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${project.lineAccessToken}`,
                  },
                  body: JSON.stringify({
                    replyToken,
                    messages: [{
                      type: "text",
                      text: `คุณมี ${unpaidInvoices.length} รายการค้างชำระ\nกรุณาส่งรูปสลิปมาในแชทนี้ เจ้าหน้าที่จะตรวจสอบให้ค่ะ`,
                    }],
                  }),
                });
              } else {
                await fetch("https://api.line.me/v2/bot/message/reply", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${project.lineAccessToken}`,
                  },
                  body: JSON.stringify({
                    replyToken,
                    messages: [{
                      type: "text",
                      text: "ไม่พบใบแจ้งหนี้ค้างชำระค่ะ\nNo unpaid invoices found.",
                    }],
                  }),
                });
              }
            } else {
              await fetch("https://api.line.me/v2/bot/message/reply", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${project.lineAccessToken}`,
                },
                body: JSON.stringify({
                  replyToken,
                  messages: [{
                    type: "text",
                    text: "กรุณาติดต่อเจ้าหน้าที่เพื่อลงทะเบียนห้องของท่านก่อนค่ะ\nPlease contact staff to register your unit first.",
                  }],
                }),
              });
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("LINE webhook error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
