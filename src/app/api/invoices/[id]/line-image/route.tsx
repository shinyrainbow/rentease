import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

interface LineItem {
  description: string;
  amount: number;
  quantity?: number;
  unitPrice?: number;
  usage?: number;
  rate?: number;
}

const PRIMARY_COLOR = "#16a34a"; // green-600

function numberToThaiText(num: number): string {
  const thaiDigits = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const positions = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];
  // Round to 2 decimal places to avoid floating point issues
  num = Math.round(num * 100) / 100;
  if (num === 0) return "ศูนย์บาทถ้วน";
  const intPart = Math.floor(Math.abs(num));
  const decPart = Math.round((Math.abs(num) - intPart) * 100);
  function convert(n: number): string {
    if (n === 0) return "";
    if (n > 999999) return convert(Math.floor(n / 1000000)) + "ล้าน" + convert(n % 1000000);
    const str = n.toString();
    let result = "";
    const len = str.length;
    for (let i = 0; i < len; i++) {
      const d = parseInt(str[i]);
      const pos = len - i - 1;
      if (d === 0) continue;
      if (pos === 0 && d === 1 && len > 1) { result += "เอ็ด"; }
      else if (pos === 1 && d === 1) { result += "สิบ"; }
      else if (pos === 1 && d === 2) { result += "ยี่สิบ"; }
      else { result += thaiDigits[d] + positions[pos]; }
    }
    return result;
  }
  let text = convert(intPart) + "บาท";
  text += decPart > 0 ? convert(decPart) + "สตางค์" : "ถ้วน";
  return text;
}

const BANK_NAMES: Record<string, string> = {
  kbank: "ธนาคารกสิกรไทย",
  scb: "ธนาคารไทยพาณิชย์",
  bbl: "ธนาคารกรุงเทพ",
  ktb: "ธนาคารกรุงไทย",
  bay: "ธนาคารกรุงศรีอยุธยา",
  ttb: "ธนาคารทหารไทยธนชาต",
  gsb: "ธนาคารออมสิน",
  uob: "ธนาคารยูโอบี",
  cimb: "ธนาคารซีไอเอ็มบี ไทย",
  lhbank: "ธนาคารแลนด์ แอนด์ เฮ้าส์",
  tisco: "ธนาคารทิสโก้",
  kkp: "ธนาคารเกียรตินาคินภัทร",
  icbc: "ธนาคารไอซีบีซี (ไทย)",
  baac: "ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร",
  ghb: "ธนาคารอาคารสงเคราะห์",
};

const translations = {
  en: {
    invoice: "INVOICE",
    invoiceRent: "RENTAL INVOICE",
    invoiceUtility: "UTILITY INVOICE",
    invoiceNo: "Invoice No",
    date: "Date",
    dueDate: "Due Date",
    taxId: "Tax ID",
    billTo: "Bill To",
    unit: "Unit",
    name: "Name",
    address: "Address",
    description: "Description",
    amount: "Amount (THB)",
    subtotal: "Subtotal",
    withholdingTax: "Withholding Tax",
    total: "Total",
    pleasePayBy: "Please pay by the due date",
    paymentInfo: "Payment Information",
    bankNameLabel: "Bank",
    accountName: "Account Name",
    accountNumber: "Account Number",
    biller: "Biller",
    detail: "Description",
    price: "Price",
    whLabel: "WH",
    colTotal: "Total",
    grandTotal: "Grand Total",
    quantity: "Quantity",
    unitPrice: "Unit Price",
    note: "Remark",
    transferTo: "Please transfer to",
    acctNoInline: "Account No.",
    acctNameInline: "Account Name",
  },
  th: {
    invoice: "ใบแจ้งหนี้",
    invoiceRent: "ใบแจ้งหนี้ค่าเช่า",
    invoiceUtility: "ใบแจ้งหนี้ค่าสาธารณูปโภค",
    invoiceNo: "เลขที่",
    date: "วันที่",
    dueDate: "ครบกำหนด",

    taxId: "เลขประจำตัวผู้เสียภาษี",
    billTo: "เรียกเก็บจาก",
    unit: "ห้อง",
    name: "ชื่อ",
    address: "ที่อยู่",
    description: "รายการ",
    amount: "จำนวนเงิน (บาท)",
    subtotal: "รวม",
    withholdingTax: "หัก ณ ที่จ่าย",
    total: "ยอดรวมทั้งสิ้น",
    pleasePayBy: "กรุณาชำระภายในกำหนด",
    paymentInfo: "ข้อมูลการชำระเงิน",
    bankNameLabel: "ธนาคาร",
    accountName: "ชื่อบัญชี",
    accountNumber: "เลขที่บัญชี",
    biller: "ผู้วางบิล",
    detail: "รายละเอียด",
    price: "ราคา",
    whLabel: "ณ ที่จ่าย WH",
    colTotal: "จำนวนเงิน",
    grandTotal: "จำนวนเงินทั้งสิ้น",
    quantity: "จำนวน",
    unitPrice: "ราคา",
    note: "หมายเหตุ",
    transferTo: "สามารถโอนเงินเข้าได้ที่",
    acctNoInline: "เลขที่บัญชี",
    acctNameInline: "ชื่อบัญชี",
  },
};

export async function GET(request: NextRequest) {
  try {
    // Load THSarabun font for proper Thai character rendering
    let fontData: ArrayBuffer | null = null;
    let fontDataBold: ArrayBuffer | null = null;

    try {
      // Get base URL from request
      const url = new URL(request.url);
      const baseUrl = `${url.protocol}//${url.host}`;

      // Using IBM Plex Sans Thai from our own public folder
      const fontPromise = fetch(
        `${baseUrl}/fonts/IBMPlexSansThai-Regular.ttf`
      ).then((res) => {
        if (!res.ok) throw new Error(`Font fetch failed: ${res.status}`);
        return res.arrayBuffer();
      });

      const fontBoldPromise = fetch(
        `${baseUrl}/fonts/IBMPlexSansThai-Bold.ttf`
      ).then((res) => {
        if (!res.ok) throw new Error(`Font bold fetch failed: ${res.status}`);
        return res.arrayBuffer();
      });

      const results = await Promise.race([
        Promise.all([fontPromise, fontBoldPromise]),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
      ]);

      if (results) {
        [fontData, fontDataBold] = results as [ArrayBuffer, ArrayBuffer];
      }
    } catch (fontError) {
      console.error("Font loading failed:", fontError);
    }

    const { searchParams } = new URL(request.url);

    const invoiceNo = searchParams.get("invoiceNo") || "";

    const dueDate = searchParams.get("dueDate") || "";
    const dateCreated = searchParams.get("dateCreated") || "";
    const totalAmount = Number(searchParams.get("totalAmount") || 0);
    const unitNumber = searchParams.get("unitNumber") || "";
    const tenantName = searchParams.get("tenantName") || "";
    const tenantAddress = searchParams.get("tenantAddress") || "";
    const tenantTaxId = searchParams.get("tenantTaxId") || "";
    const companyName = searchParams.get("companyName") || "";
    const companyAddress = searchParams.get("companyAddress") || "";
    const taxId = searchParams.get("taxId") || "";
    const logoUrl = searchParams.get("logoUrl") || "";
    const lang = (searchParams.get("lang") as "en" | "th") || "th";
    const isCopy = searchParams.get("copy") === "true";
    const invoiceType = searchParams.get("invoiceType") || "";

    const subtotal = Number(searchParams.get("subtotal") || 0);
    const withholdingTax = Number(searchParams.get("withholdingTax") || 0);
    const withholdingTaxPercent = Number(searchParams.get("withholdingTaxPercent") || 0);
    const lineItemsStr = searchParams.get("lineItems") || "[]";
    const lineItems: LineItem[] = JSON.parse(lineItemsStr);

    // Payment info
    const bankName = searchParams.get("bankName") || "";
    const bankAccountName = searchParams.get("bankAccountName") || "";
    const bankAccountNumber = searchParams.get("bankAccountNumber") || "";
    const ownerName = searchParams.get("ownerName") || "";

    const displayBankName = bankName ? (BANK_NAMES[bankName] || bankName) : "";

    // For UTILITY invoices, use subtotal (no WH deduction)
    const displayTotal = invoiceType === "UTILITY" ? subtotal : totalAmount;

    const t = translations[lang] || translations.th;

    const formatCurrency = (amount: number) => {
      return amount.toLocaleString(lang === "th" ? "th-TH" : "en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    };

    const thaiMonths = ["มค", "กพ", "มีค", "เมย", "พค", "มิย", "กค", "สค", "กย", "ตค", "พย", "ธค"];
    const engMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const formatDate = (dateStr: string) => {
      if (!dateStr) return "";
      const d = new Date(dateStr);
      const day = d.getDate();
      const month = lang === "th" ? thaiMonths[d.getMonth()] : engMonths[d.getMonth()];
      const year = d.getFullYear();
      return `${day} ${month} ${year}`;
    };

    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            backgroundColor: "#ffffff",
            fontFamily: "IBM Plex Sans Thai, sans-serif",
            padding: "60px 80px",
          }}
        >
          {/* Company Header - Logo on Top, Details Below */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", marginBottom: "40px" }}>
            {logoUrl && (
              <img
                src={logoUrl}
                alt="Logo"
                width={100}
                height={100}
                style={{ objectFit: "contain", borderRadius: "8px", marginBottom: "12px" }}
              />
            )}
            <span style={{ fontSize: "16px", fontWeight: "normal", color: "#111827" }}>
              {companyName}
            </span>
            {companyAddress && (
              <span style={{ fontSize: "16px", fontWeight: "normal", color: "#111827", marginTop: "4px" }}>
                {companyAddress}
              </span>
            )}
            {taxId && (
              <span style={{ fontSize: "16px", fontWeight: "normal", color: "#111827", marginTop: "4px" }}>
                {t.taxId}: {taxId}
              </span>
            )}
          </div>

          {/* Invoice Title + Details - Right Aligned */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "32px" }}>
            <div style={{ display: "flex", flexDirection: "column", width: "50%" }}>
              {/* Title */}
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "28px", fontWeight: "bold", color: "#111827" }}>
                  {invoiceType === "RENT" ? t.invoiceRent : invoiceType === "UTILITY" ? t.invoiceUtility : t.invoice} {isCopy ? (lang === "th" ? "(สำเนา)" : "(Copy)") : (lang === "th" ? "(ต้นฉบับ)" : "(Original)")}
                </span>
              </div>
              {/* Separator under title */}
              <div style={{ width: "100%", height: "1px", backgroundColor: "#E5E7EB", marginBottom: "12px" }} />
              {/* Invoice No */}
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ fontSize: "16px", fontWeight: "bold", color: "#111827" }}>{t.invoiceNo}</span>
                <span style={{ fontSize: "16px", color: "#111827" }}>{invoiceNo}</span>
              </div>
              {/* Date */}
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ fontSize: "16px", fontWeight: "bold", color: "#111827" }}>{t.date}</span>
                <span style={{ fontSize: "16px", color: "#111827" }}>{formatDate(dateCreated)}</span>
              </div>
              {/* Due Date */}
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontSize: "16px", fontWeight: "bold", color: "#111827" }}>{t.dueDate}</span>
                <span style={{ fontSize: "16px", color: "#111827" }}>{formatDate(dueDate)}</span>
              </div>
              {/* Separator under due date */}
              <div style={{ width: "100%", height: "1px", backgroundColor: "#E5E7EB" }} />
            </div>
          </div>

          {/* Bill To Section */}
          <div style={{ display: "flex", flexDirection: "column", marginBottom: "32px" }}>
            <div style={{ display: "flex", marginBottom: "4px" }}>
              <span style={{ fontSize: "16px", color: "#6B7280", width: "220px" }}>{t.unit}:</span>
              <span style={{ fontSize: "16px", color: "#111827" }}>{unitNumber}</span>
            </div>
            <div style={{ display: "flex", marginBottom: "4px" }}>
              <span style={{ fontSize: "16px", color: "#6B7280", width: "220px" }}>{t.name}:</span>
              <span style={{ fontSize: "16px", color: "#111827" }}>{tenantName}</span>
            </div>
            {tenantAddress && (
              <div style={{ display: "flex", marginBottom: "4px" }}>
                <span style={{ fontSize: "16px", color: "#6B7280", width: "220px" }}>{t.address}:</span>
                <span style={{ fontSize: "16px", color: "#111827", flex: 1 }}>{tenantAddress}</span>
              </div>
            )}
            {tenantTaxId && (
              <div style={{ display: "flex", marginBottom: "4px" }}>
                <span style={{ fontSize: "16px", color: "#6B7280", width: "220px" }}>{t.taxId}:</span>
                <span style={{ fontSize: "16px", color: "#111827" }}>{tenantTaxId}</span>
              </div>
            )}
          </div>

          {/* Black line above header */}
          <div style={{ width: "100%", height: "2px", backgroundColor: "#000000" }} />

          {/* Table Header - Bilingual (English + Thai), all centered */}
          <div
            style={{
              display: "flex",
              backgroundColor: "#ffffff",
              padding: "10px 0",
            }}
          >
            <div style={{ width: "50px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: "13px", fontWeight: "bold", color: "#111827" }}>#</span>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ fontSize: "13px", fontWeight: "bold", color: "#111827" }}>Description</span>
              <span style={{ fontSize: "13px", fontWeight: "bold", color: "#111827" }}>{t.detail}</span>
            </div>
            {invoiceType === "UTILITY" ? (
              <>
                <div style={{ width: "140px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", fontWeight: "bold", color: "#111827" }}>Quantity</span>
                  <span style={{ fontSize: "13px", fontWeight: "bold", color: "#111827" }}>{t.quantity}</span>
                </div>
                <div style={{ width: "140px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", fontWeight: "bold", color: "#111827" }}>Unit Price</span>
                  <span style={{ fontSize: "13px", fontWeight: "bold", color: "#111827" }}>{t.unitPrice}</span>
                </div>
              </>
            ) : (
              <>
                <div style={{ width: "140px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", fontWeight: "bold", color: "#111827" }}>Price</span>
                  <span style={{ fontSize: "13px", fontWeight: "bold", color: "#111827" }}>{t.price}</span>
                </div>
                <div style={{ width: "140px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", fontWeight: "bold", color: "#111827" }}>{`WH ${withholdingTaxPercent}%`}</span>
                  <span style={{ fontSize: "13px", fontWeight: "bold", color: "#111827" }}>{`${t.whLabel} ${withholdingTaxPercent}%`}</span>
                </div>
              </>
            )}
            <div style={{ width: "140px", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ fontSize: "13px", fontWeight: "bold", color: "#111827" }}>Total</span>
              <span style={{ fontSize: "13px", fontWeight: "bold", color: "#111827" }}>{t.colTotal}</span>
            </div>
          </div>

          {/* Black line under header */}
          <div style={{ width: "100%", height: "2px", backgroundColor: "#000000" }} />

          {/* Table Rows */}
          {lineItems.map((item, index) => {
            const itemWh = invoiceType !== "UTILITY" && withholdingTaxPercent > 0 ? item.amount * withholdingTaxPercent / 100 : 0;
            const itemTotal = invoiceType === "UTILITY" ? item.amount : item.amount - itemWh;
            const qty = item.quantity ?? item.usage ?? 0;
            const uPrice = item.unitPrice ?? item.rate ?? 0;
            return (
              <div
                key={index}
                style={{
                  display: "flex",
                  padding: "14px 0",
                  backgroundColor: "#ffffff",
                  borderBottom: "1px solid #E5E7EB",
                }}
              >
                <div style={{ width: "50px", display: "flex", justifyContent: "center" }}>
                  <span style={{ fontSize: "15px", color: "#111827" }}>{index + 1}</span>
                </div>
                <div style={{ flex: 1, display: "flex", paddingLeft: "8px" }}>
                  <span style={{ fontSize: "15px", color: "#111827" }}>{item.description}</span>
                </div>
                {invoiceType === "UTILITY" ? (
                  <>
                    <div style={{ width: "140px", display: "flex", justifyContent: "flex-end", paddingRight: "12px" }}>
                      <span style={{ fontSize: "15px", color: "#111827" }}>{formatCurrency(qty)}</span>
                    </div>
                    <div style={{ width: "140px", display: "flex", justifyContent: "flex-end", paddingRight: "12px" }}>
                      <span style={{ fontSize: "15px", color: "#111827" }}>{formatCurrency(uPrice)}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ width: "140px", display: "flex", justifyContent: "flex-end", paddingRight: "12px" }}>
                      <span style={{ fontSize: "15px", color: "#111827" }}>{formatCurrency(item.amount)}</span>
                    </div>
                    <div style={{ width: "140px", display: "flex", justifyContent: "flex-end", paddingRight: "12px" }}>
                      <span style={{ fontSize: "15px", color: "#111827" }}>{formatCurrency(itemWh)}</span>
                    </div>
                  </>
                )}
                <div style={{ width: "140px", display: "flex", justifyContent: "flex-end", paddingRight: "16px" }}>
                  <span style={{ fontSize: "15px", color: "#111827" }}>{formatCurrency(itemTotal)}</span>
                </div>
              </div>
            );
          })}

          {/* Space above summary row (~2 rows) */}
          <div style={{ height: "56px" }} />

          {/* Separator above summary row */}
          <div style={{ width: "100%", height: "2px", backgroundColor: "#000000" }} />

          {/* Bottom Summary Row (merged col2+col3, green bg on baht text + total) */}
          <div
            style={{
              display: "flex",
              backgroundColor: "#ffffff",
            }}
          >
            <div style={{ width: "50px", backgroundColor: "#DCFCE7", padding: "14px 0" }} />
            <div style={{ flex: 1, display: "flex", alignItems: "center", paddingLeft: "8px", backgroundColor: "#DCFCE7", padding: "14px 0 14px 8px" }}>
              <span style={{ fontSize: "15px", fontWeight: "bold", color: "#111827" }}>{numberToThaiText(displayTotal)}</span>
            </div>
            <div style={{ width: "280px", display: "flex", justifyContent: "center", alignItems: "center", padding: "14px 0" }}>
              <span style={{ fontSize: "15px", fontWeight: "bold", color: "#111827" }}>{t.grandTotal}</span>
            </div>
            <div style={{ width: "140px", display: "flex", justifyContent: "flex-end", alignItems: "center", backgroundColor: "#DCFCE7", padding: "14px 16px 14px 0" }}>
              <span style={{ fontSize: "15px", fontWeight: "bold", color: "#111827" }}>{formatCurrency(displayTotal)}</span>
            </div>
          </div>

          {/* Note and Signature Section */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "40px" }}>
            {/* Note section */}
            {(displayBankName || bankAccountName || bankAccountNumber) && (
              <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                <span style={{ fontSize: "18px", fontWeight: "bold", color: "#111827", marginBottom: "12px" }}>
                  {t.note}
                </span>
                <span style={{ fontSize: "16px", color: "#111827", marginBottom: "6px" }}>
                  {t.transferTo}
                </span>
                {(displayBankName || bankAccountNumber) && (
                  <span style={{ fontSize: "16px", color: "#111827", marginBottom: "6px" }}>
                    {displayBankName} {t.acctNoInline} {bankAccountNumber}
                  </span>
                )}
                {bankAccountName && (
                  <span style={{ fontSize: "16px", color: "#111827" }}>
                    {t.acctNameInline} {bankAccountName}
                  </span>
                )}
              </div>
            )}

            {/* Signature Section */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "300px" }}>
              <div style={{ width: "200px", borderBottom: "2px solid #111827", marginBottom: "12px", marginTop: "60px" }} />
              <span style={{ fontSize: "16px", color: "#111827" }}>{t.biller}</span>
              {ownerName && (
                <span style={{ fontSize: "15px", color: "#6B7280", marginTop: "4px" }}>({ownerName})</span>
              )}
            </div>
          </div>

          {/* Footer - Separator */}
          <div style={{ display: "flex", marginTop: "auto", paddingTop: "40px" }}>
            <div style={{ width: "100%", height: "2px", backgroundColor: "#000000" }} />
          </div>
        </div>
      ),
      {
        width: 1024,
        height: 1366,
        ...(fontData && fontDataBold ? {
          fonts: [
            {
              name: "IBM Plex Sans Thai",
              data: fontData,
              weight: 400 as const,
              style: "normal" as const,
            },
            {
              name: "IBM Plex Sans Thai",
              data: fontDataBold,
              weight: 700 as const,
              style: "normal" as const,
            },
          ],
        } : {}),
      }
    );
  } catch (error) {
    console.error("Error generating invoice image:", error);
    return new Response("Error generating image", { status: 500 });
  }
}
