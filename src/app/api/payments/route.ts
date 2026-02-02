import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const payments = await prisma.payment.findMany({
      where: {
        invoice: { project: { ownerId: session.user.id } },
        ...(status && { status: status as "PENDING" | "VERIFIED" | "REJECTED" }),
      },
      include: {
        invoice: {
          select: {
            invoiceNo: true,
            project: { select: { name: true, nameTh: true } },
            unit: { select: { unitNumber: true } },
          },
        },
        tenant: { select: { name: true, nameTh: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(payments);
  } catch (error) {
    console.error("Error fetching payments:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();

    const invoice = await prisma.invoice.findFirst({
      where: { id: data.invoiceId, project: { ownerId: session.user.id } },
      include: { tenant: true },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const payment = await prisma.payment.create({
      data: {
        invoiceId: data.invoiceId,
        tenantId: invoice.tenantId,
        amount: data.amount,
        method: data.method,
        slipUrl: data.slipUrl,
        transferRef: data.transferRef,
        transferBank: data.transferBank,
        checkNo: data.checkNo,
        checkBank: data.checkBank,
        checkDate: data.checkDate ? new Date(data.checkDate) : null,
        notes: data.notes,
        paidAt: new Date(),
      },
      include: {
        invoice: {
          select: {
            invoiceNo: true,
            project: { select: { name: true, nameTh: true } },
            unit: { select: { unitNumber: true } },
          },
        },
        tenant: { select: { name: true, nameTh: true } },
      },
    });

    return NextResponse.json(payment);
  } catch (error) {
    console.error("Error creating payment:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
