import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const receipts = await prisma.receipt.findMany({
      where: {
        invoice: { project: { ownerId: session.user.id } },
      },
      include: {
        invoice: {
          select: {
            invoiceNo: true,
            project: { select: { name: true } },
            unit: { select: { unitNumber: true } },
            tenant: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(receipts);
  } catch (error) {
    console.error("Error fetching receipts:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
