import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { uploadFile, getPresignedUrl, fetchImageAsBase64 } from "@/lib/s3";
import { createPDFWithThaiFont, setThaiFont } from "@/lib/pdf-fonts";

interface Clause {
  title: string;
  titleTh: string;
  content: string;
  contentTh: string;
}

const translations = {
  en: {
    title: "LEASE AGREEMENT",
    contractNo: "Contract No.",
    date: "Date",
    between: "Between",
    landlord: "Landlord (Lessor)",
    tenant: "Tenant (Lessee)",
    property: "Property Details",
    unit: "Unit",
    floor: "Floor",
    size: "Size",
    sqm: "sq.m.",
    terms: "Terms and Conditions",
    rentalTerms: "Rental Terms",
    period: "Lease Period",
    to: "to",
    monthlyRent: "Monthly Rent",
    commonFee: "Common Area Fee",
    deposit: "Security Deposit",
    signatures: "Signatures",
    signedOn: "Signed on",
    notSigned: "Not signed",
    baht: "Baht",
  },
  th: {
    title: "สัญญาเช่า",
    contractNo: "เลขที่สัญญา",
    date: "วันที่",
    between: "ระหว่าง",
    landlord: "ผู้ให้เช่า",
    tenant: "ผู้เช่า",
    property: "รายละเอียดทรัพย์สิน",
    unit: "ห้อง/ยูนิต",
    floor: "ชั้น",
    size: "ขนาด",
    sqm: "ตร.ม.",
    terms: "ข้อกำหนดและเงื่อนไข",
    rentalTerms: "ข้อกำหนดการเช่า",
    period: "ระยะเวลาเช่า",
    to: "ถึง",
    monthlyRent: "ค่าเช่ารายเดือน",
    commonFee: "ค่าส่วนกลาง",
    deposit: "เงินประกัน",
    signatures: "ลายเซ็น",
    signedOn: "เซ็นเมื่อ",
    notSigned: "ยังไม่ได้เซ็น",
    baht: "บาท",
  },
};

const PRIMARY_COLOR = { r: 30, g: 64, b: 175 }; // Blue

function formatCurrency(amount: number): string {
  return amount.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(date: Date, lang: "th" | "en" = "th"): string {
  const thaiMonths = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
  const engMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const day = date.getDate();
  const month = date.getMonth();
  const year = date.getFullYear();

  if (lang === "th") {
    return `${day} ${thaiMonths[month]} ${year + 543}`;
  }
  return `${engMonths[month]} ${day}, ${year}`;
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
    const body = await request.json();
    const lang = (body.lang || "th") as "th" | "en";

    const contract = await prisma.leaseContract.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            name: true,
            nameTh: true,
            companyName: true,
            companyNameTh: true,
            companyAddress: true,
            taxId: true,
            logoUrl: true,
            ownerId: true,
          },
        },
        unit: { select: { unitNumber: true, floor: true, size: true, type: true } },
        tenant: {
          select: {
            name: true,
            nameTh: true,
            email: true,
            phone: true,
            address: true,
            idCard: true,
            taxId: true,
            tenantType: true,
          },
        },
      },
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    if (contract.project.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const t = translations[lang];
    const doc = await createPDFWithThaiFont();

    // Page setup
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let y = 20;

    // Logo
    if (contract.project.logoUrl) {
      try {
        const logoBase64 = await fetchImageAsBase64(contract.project.logoUrl);
        if (logoBase64) {
          doc.addImage(logoBase64, "PNG", margin, y, 30, 30);
        }
      } catch (e) {
        console.error("Failed to load logo:", e);
      }
    }

    // Header
    setThaiFont(doc, "bold");
    doc.setFontSize(18);
    doc.setTextColor(PRIMARY_COLOR.r, PRIMARY_COLOR.g, PRIMARY_COLOR.b);
    doc.text(t.title, pageWidth / 2, y + 10, { align: "center" });

    y += 20;
    setThaiFont(doc, "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`${t.contractNo}: ${contract.contractNo}`, pageWidth / 2, y, { align: "center" });

    y += 5;
    doc.text(`${t.date}: ${formatDate(contract.createdAt, lang)}`, pageWidth / 2, y, { align: "center" });

    // Horizontal line
    y += 10;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);

    // Parties section
    y += 15;
    setThaiFont(doc, "bold");
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(t.between, margin, y);

    y += 10;
    setThaiFont(doc, "bold");
    doc.setFontSize(10);
    doc.text(t.landlord + ":", margin, y);
    setThaiFont(doc, "normal");
    doc.setFontSize(10);
    const landlordName = lang === "th"
      ? contract.project.companyNameTh || contract.project.companyName || contract.project.nameTh || contract.project.name
      : contract.project.companyName || contract.project.name;
    doc.text(landlordName || "", margin + 35, y);

    if (contract.project.companyAddress) {
      y += 5;
      doc.text(contract.project.companyAddress, margin + 35, y);
    }

    y += 10;
    setThaiFont(doc, "bold");
    doc.setFontSize(10);
    doc.text(t.tenant + ":", margin, y);
    setThaiFont(doc, "normal");
    doc.setFontSize(10);
    const tenantName = lang === "th"
      ? contract.tenant.nameTh || contract.tenant.name
      : contract.tenant.name;
    doc.text(tenantName, margin + 35, y);

    if (contract.tenant.address) {
      y += 5;
      doc.text(contract.tenant.address, margin + 35, y);
    }

    // Property details
    y += 15;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);

    y += 10;
    setThaiFont(doc, "bold");
    doc.setFontSize(12);
    doc.text(t.property, margin, y);

    y += 8;
    setThaiFont(doc, "normal");
    doc.setFontSize(10);
    doc.text(`${t.unit}: ${contract.unit.unitNumber}`, margin, y);
    doc.text(`${t.floor}: ${contract.unit.floor}`, margin + 60, y);
    if (contract.unit.size) {
      doc.text(`${t.size}: ${contract.unit.size} ${t.sqm}`, margin + 100, y);
    }

    // Rental terms
    y += 15;
    setThaiFont(doc, "bold");
    doc.setFontSize(12);
    doc.text(t.rentalTerms, margin, y);

    y += 8;
    setThaiFont(doc, "normal");
    doc.setFontSize(10);
    doc.text(
      `${t.period}: ${formatDate(contract.contractStart, lang)} ${t.to} ${formatDate(contract.contractEnd, lang)}`,
      margin,
      y
    );

    y += 6;
    doc.text(`${t.monthlyRent}: ${formatCurrency(contract.baseRent)} ${t.baht}`, margin, y);

    if (contract.commonFee) {
      y += 6;
      doc.text(`${t.commonFee}: ${formatCurrency(contract.commonFee)} ${t.baht}`, margin, y);
    }

    if (contract.deposit) {
      y += 6;
      doc.text(`${t.deposit}: ${formatCurrency(contract.deposit)} ${t.baht}`, margin, y);
    }

    // Terms and conditions (clauses)
    const clauses = contract.clauses as Clause[] | null;
    if (clauses && clauses.length > 0) {
      y += 15;
      setThaiFont(doc, "bold");
    doc.setFontSize(12);
      doc.text(t.terms, margin, y);

      setThaiFont(doc, "normal");
      doc.setFontSize(9);
      clauses.forEach((clause, index) => {
        y += 8;
        if (y > 260) {
          doc.addPage();
          y = 20;
        }

        const title = lang === "th" ? clause.titleTh || clause.title : clause.title;
        const content = lang === "th" ? clause.contentTh || clause.content : clause.content;

        setThaiFont(doc, "bold");
        doc.setFontSize(9);
        doc.text(`${index + 1}. ${title}`, margin, y);

        y += 5;
        setThaiFont(doc, "normal");
      doc.setFontSize(9);
        const lines = doc.splitTextToSize(content, pageWidth - margin * 2);
        lines.forEach((line: string) => {
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
          doc.text(line, margin + 5, y);
          y += 4;
        });
      });
    }

    // Signatures section
    if (y > 200) {
      doc.addPage();
      y = 20;
    } else {
      y += 20;
    }

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);

    y += 10;
    setThaiFont(doc, "bold");
    doc.setFontSize(12);
    doc.text(t.signatures, margin, y);

    y += 15;
    const sigBoxWidth = (pageWidth - margin * 3) / 2;

    // Landlord signature box
    doc.setDrawColor(200, 200, 200);
    doc.rect(margin, y, sigBoxWidth, 40);
    setThaiFont(doc, "bold");
    doc.setFontSize(10);
    doc.text(t.landlord, margin + sigBoxWidth / 2, y + 35, { align: "center" });

    if (contract.landlordSignature && contract.landlordSignedAt) {
      try {
        const sigBase64 = await fetchImageAsBase64(contract.landlordSignature);
        if (sigBase64) {
          doc.addImage(sigBase64, "PNG", margin + 10, y + 5, sigBoxWidth - 20, 20);
        }
      } catch (e) {
        console.error("Failed to load landlord signature:", e);
      }
      setThaiFont(doc, "normal");
      doc.setFontSize(8);
      doc.text(`${t.signedOn}: ${formatDate(new Date(contract.landlordSignedAt), lang)}`, margin + sigBoxWidth / 2, y + 45, { align: "center" });
    } else {
      setThaiFont(doc, "normal");
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(t.notSigned, margin + sigBoxWidth / 2, y + 20, { align: "center" });
      doc.setTextColor(0, 0, 0);
    }

    // Tenant signature box
    const tenantBoxX = margin * 2 + sigBoxWidth;
    doc.rect(tenantBoxX, y, sigBoxWidth, 40);
    setThaiFont(doc, "bold");
    doc.setFontSize(10);
    doc.text(t.tenant, tenantBoxX + sigBoxWidth / 2, y + 35, { align: "center" });

    if (contract.tenantSignature && contract.tenantSignedAt) {
      try {
        const sigBase64 = await fetchImageAsBase64(contract.tenantSignature);
        if (sigBase64) {
          doc.addImage(sigBase64, "PNG", tenantBoxX + 10, y + 5, sigBoxWidth - 20, 20);
        }
      } catch (e) {
        console.error("Failed to load tenant signature:", e);
      }
      setThaiFont(doc, "normal");
      doc.setFontSize(8);
      doc.text(`${t.signedOn}: ${formatDate(new Date(contract.tenantSignedAt), lang)}`, tenantBoxX + sigBoxWidth / 2, y + 45, { align: "center" });
    } else {
      setThaiFont(doc, "normal");
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(t.notSigned, tenantBoxX + sigBoxWidth / 2, y + 20, { align: "center" });
      doc.setTextColor(0, 0, 0);
    }

    // Generate PDF buffer and upload to S3
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
    const timestamp = Date.now();
    const s3Key = `contracts/${id}/${lang}-${timestamp}.pdf`;
    await uploadFile(s3Key, pdfBuffer, "application/pdf");

    // Update contract with PDF key
    await prisma.leaseContract.update({
      where: { id },
      data: { pdfS3Key: s3Key },
    });

    const presignedUrl = await getPresignedUrl(s3Key, 3600);

    return NextResponse.json({
      success: true,
      url: presignedUrl,
      key: s3Key,
      filename: `${contract.contractNo}-${lang}.pdf`,
    });
  } catch (error) {
    console.error("Error generating contract PDF:", error);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}
