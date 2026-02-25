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

async function getGroupSummary(groupId: string, accessToken: string) {
  try {
    const res = await fetch(`https://api.line.me/v2/bot/group/${groupId}/summary`, {
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

// Helper: get access token from LineOA, with fallback to project legacy fields
function getAccessToken(lineOa: { lineAccessToken: string | null } | null, project: { lineAccessToken: string | null } | null): string {
  return lineOa?.lineAccessToken || project?.lineAccessToken || "";
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

      // Determine if this is a group or user event
      const isGroup = source?.type === "group";
      const contactId = isGroup ? source?.groupId : source?.userId;

      if (!contactId) continue;

      // Find the LineOA by matching signature against all LineOA records
      let lineOa = null;
      const lineOAs = await prisma.lineOA.findMany({
        where: {
          lineChannelSecret: { not: null },
          lineAccessToken: { not: null },
        },
      });

      for (const oa of lineOAs) {
        if (oa.lineChannelSecret && verifySignature(body, signature, oa.lineChannelSecret)) {
          lineOa = oa;
          break;
        }
      }

      // Fallback: check legacy per-project credentials
      if (!lineOa) {
        const projects = await prisma.project.findMany({
          where: {
            lineAccessToken: { not: null },
            lineChannelSecret: { not: null },
            lineOaId: null, // Only check projects NOT linked to a LineOA
          },
        });

        for (const p of projects) {
          if (p.lineChannelSecret && verifySignature(body, signature, p.lineChannelSecret)) {
            // Create a LineOA from legacy project fields for future use
            lineOa = await prisma.lineOA.create({
              data: {
                name: `${p.name} LINE OA`,
                lineChannelId: p.lineChannelId,
                lineChannelSecret: p.lineChannelSecret,
                lineAccessToken: p.lineAccessToken,
                liffId: p.liffId,
                ownerId: p.ownerId,
              },
            });
            // Link the project to this new LineOA
            await prisma.project.update({
              where: { id: p.id },
              data: { lineOaId: lineOa.id },
            });
            break;
          }
        }
      }

      if (!lineOa) {
        console.log("Could not identify LINE OA for webhook");
        continue;
      }

      const accessToken = getAccessToken(lineOa, null);

      // Find existing LINE contact under this OA
      let lineContact = await prisma.lineContact.findFirst({
        where: { lineUserId: contactId, lineOaId: lineOa.id },
        include: {
          project: true,
          tenant: { include: { unit: true } },
        },
      });

      // Handle join event - bot added to a group
      if (type === "join" && isGroup) {
        const groupSummary = await getGroupSummary(contactId, accessToken);

        if (!lineContact) {
          lineContact = await prisma.lineContact.create({
            data: {
              lineOaId: lineOa.id,
              lineUserId: contactId,
              contactType: "GROUP",
              displayName: groupSummary?.groupName || "LINE Group",
              pictureUrl: groupSummary?.pictureUrl,
            },
            include: {
              project: true,
              tenant: { include: { unit: true } },
            },
          });

          // Send welcome message
          await fetch("https://api.line.me/v2/bot/message/reply", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              replyToken,
              messages: [{
                type: "text",
                text: `สวัสดีค่ะ ยินดีต้อนรับ\nHello! Welcome!`,
              }],
            }),
          });
        } else {
          await prisma.lineContact.update({
            where: { id: lineContact.id },
            data: {
              displayName: groupSummary?.groupName,
              pictureUrl: groupSummary?.pictureUrl,
              contactType: "GROUP",
            },
          });
        }
        continue;
      }

      // Handle follow event - user added the LINE OA (1-to-1 only)
      if (type === "follow" && !isGroup) {
        const profile = await getLineProfile(contactId, accessToken);

        if (!lineContact) {
          lineContact = await prisma.lineContact.create({
            data: {
              lineOaId: lineOa.id,
              lineUserId: contactId,
              contactType: "USER",
              displayName: profile?.displayName || "Unknown User",
              pictureUrl: profile?.pictureUrl,
              statusMessage: profile?.statusMessage,
            },
            include: {
              project: true,
              tenant: { include: { unit: true } },
            },
          });

          // Send welcome message
          await fetch("https://api.line.me/v2/bot/message/reply", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              replyToken,
              messages: [{
                type: "text",
                text: `สวัสดีค่ะ ${profile?.displayName || ""} ยินดีต้อนรับ\nHello ${profile?.displayName || ""}! Welcome!`,
              }],
            }),
          });
        } else {
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
        if (isGroup) {
          const groupSummary = await getGroupSummary(contactId, accessToken);
          lineContact = await prisma.lineContact.create({
            data: {
              lineOaId: lineOa.id,
              lineUserId: contactId,
              contactType: "GROUP",
              displayName: groupSummary?.groupName || "LINE Group",
              pictureUrl: groupSummary?.pictureUrl,
            },
            include: {
              project: true,
              tenant: { include: { unit: true } },
            },
          });
        } else {
          const profile = await getLineProfile(contactId, accessToken);
          lineContact = await prisma.lineContact.create({
            data: {
              lineOaId: lineOa.id,
              lineUserId: contactId,
              contactType: "USER",
              displayName: profile?.displayName || "Unknown User",
              pictureUrl: profile?.pictureUrl,
              statusMessage: profile?.statusMessage,
            },
            include: {
              project: true,
              tenant: { include: { unit: true } },
            },
          });
        }
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
            if (lineContact.tenantId && lineContact.tenant) {
              const tenant = lineContact.tenant;

              await prisma.maintenanceRequest.create({
                data: {
                  projectId: tenant.unit.projectId,
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
                  Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                  replyToken,
                  messages: [{
                    type: "text",
                    text: `รับแจ้งซ่อมเรียบร้อยแล้วค่ะ ห้อง ${tenant.unit.unitNumber}\nMaintenance request received for unit ${tenant.unit.unitNumber}. Thank you!`,
                  }],
                }),
              });
            } else {
              await fetch("https://api.line.me/v2/bot/message/reply", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${accessToken}`,
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
            if (lineContact.tenantId && lineContact.tenant) {
              // Check if tenant has unpaid invoices
              const unpaidInvoices = await prisma.invoice.findMany({
                where: {
                  tenantId: lineContact.tenantId,
                  status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
                },
              });

              const liffId = lineOa.liffId;

              if (unpaidInvoices.length > 0 && liffId) {
                // Send Flex Message with LIFF button
                const liffUrl = `https://liff.line.me/${liffId}`;
                await fetch("https://api.line.me/v2/bot/message/reply", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
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
                await fetch("https://api.line.me/v2/bot/message/reply", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
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
                    Authorization: `Bearer ${accessToken}`,
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
                  Authorization: `Bearer ${accessToken}`,
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
