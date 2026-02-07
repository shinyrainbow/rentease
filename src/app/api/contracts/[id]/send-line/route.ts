import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

// POST /api/contracts/[id]/send-line - Send signing link via LINE
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
    const body = await request.json();
    const baseUrl = body.baseUrl || process.env.NEXTAUTH_URL || "";

    const contract = await prisma.leaseContract.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            ownerId: true,
            lineAccessToken: true,
            name: true,
            nameTh: true,
          },
        },
        tenant: {
          include: {
            lineContact: true,
          },
        },
        unit: { select: { unitNumber: true } },
      },
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    if (contract.project.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (contract.status !== "PENDING_TENANT") {
      return NextResponse.json({ error: "Contract must be pending tenant signature" }, { status: 400 });
    }

    if (!contract.tenant.lineContact) {
      return NextResponse.json({ error: "Tenant has no LINE contact linked" }, { status: 400 });
    }

    if (!contract.project.lineAccessToken) {
      return NextResponse.json({ error: "LINE OA not configured for this project" }, { status: 400 });
    }

    const signingUrl = `${baseUrl}/sign/${contract.signingToken}`;
    const projectName = contract.project.nameTh || contract.project.name;

    // Create Flex Message for LINE
    const flexMessage = {
      type: "flex",
      altText: `สัญญาเช่า ${contract.contractNo} รอลายเซ็นของคุณ`,
      contents: {
        type: "bubble",
        header: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: "สัญญาเช่า",
              weight: "bold",
              size: "xl",
              color: "#1e40af",
            },
            {
              type: "text",
              text: contract.contractNo,
              size: "sm",
              color: "#666666",
            },
          ],
          backgroundColor: "#f0f9ff",
          paddingAll: "lg",
        },
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: projectName,
              weight: "bold",
              size: "md",
            },
            {
              type: "text",
              text: `ห้อง ${contract.unit.unitNumber}`,
              size: "sm",
              color: "#666666",
              margin: "sm",
            },
            {
              type: "separator",
              margin: "lg",
            },
            {
              type: "text",
              text: "กรุณาเซ็นสัญญาเช่าของคุณ",
              size: "sm",
              color: "#333333",
              margin: "lg",
              wrap: true,
            },
            {
              type: "text",
              text: "คลิกปุ่มด้านล่างเพื่อดำเนินการ",
              size: "xs",
              color: "#888888",
              margin: "sm",
            },
          ],
          paddingAll: "lg",
        },
        footer: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "button",
              action: {
                type: "uri",
                label: "เซ็นสัญญา",
                uri: signingUrl,
              },
              style: "primary",
              color: "#1e40af",
            },
          ],
          paddingAll: "lg",
        },
      },
    };

    // Send LINE message
    const lineResponse = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${contract.project.lineAccessToken}`,
      },
      body: JSON.stringify({
        to: contract.tenant.lineContact.lineUserId,
        messages: [flexMessage],
      }),
    });

    if (!lineResponse.ok) {
      const errorData = await lineResponse.text();
      console.error("LINE API error:", errorData);
      return NextResponse.json({ error: "Failed to send LINE message" }, { status: 500 });
    }

    // Log the message
    await prisma.lineMessage.create({
      data: {
        lineContactId: contract.tenant.lineContact.id,
        direction: "OUTGOING",
        messageType: "flex",
        content: `Contract signing link sent: ${contract.contractNo}`,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Signing link sent via LINE",
    });
  } catch (error) {
    console.error("Error sending LINE message:", error);
    return NextResponse.json({ error: "Failed to send LINE message" }, { status: 500 });
  }
}
