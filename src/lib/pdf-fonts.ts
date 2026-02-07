import { jsPDF } from "jspdf";
import fs from "fs";
import path from "path";

// Thai font support for jsPDF
// THSarabun is the Thai government standard font for official documents
// It has proper Thai diacritical mark support and better spacing

let fontCache: { regular: string; bold: string } | null = null;

function loadFontsFromFile(): { regular: string; bold: string } {
  if (fontCache) {
    return fontCache;
  }

  // Load THSarabun fonts from public/fonts directory
  const fontsDir = path.join(process.cwd(), "public", "fonts", "THSarabun");

  const regularPath = path.join(fontsDir, "THSarabun.ttf");
  const boldPath = path.join(fontsDir, "THSarabun Bold.ttf");

  const regular = fs.readFileSync(regularPath).toString("base64");
  const bold = fs.readFileSync(boldPath).toString("base64");

  fontCache = { regular, bold };
  return fontCache;
}

export async function createPDFWithThaiFont(): Promise<jsPDF> {
  const doc = new jsPDF();
  const fonts = loadFontsFromFile();

  // Add font to virtual file system
  doc.addFileToVFS("THSarabun.ttf", fonts.regular);
  doc.addFileToVFS("THSarabun-Bold.ttf", fonts.bold);

  // Register fonts
  doc.addFont("THSarabun.ttf", "THSarabun", "normal");
  doc.addFont("THSarabun-Bold.ttf", "THSarabun", "bold");

  // Set default font to THSarabun
  doc.setFont("THSarabun", "normal");

  return doc;
}

// Helper to set font style
export function setThaiFont(doc: jsPDF, style: "normal" | "bold" = "normal") {
  doc.setFont("THSarabun", style);
}
