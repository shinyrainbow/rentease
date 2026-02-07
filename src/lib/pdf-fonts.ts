import { jsPDF } from "jspdf";

// Thai font support for jsPDF
// We use Kanit font from Google Fonts which handles Thai diacritical marks well

let fontCache: { regular: string; bold: string } | null = null;

async function fetchFontAsBase64(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Font fetch failed: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return base64;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function loadFonts(): Promise<{ regular: string; bold: string }> {
  if (fontCache) {
    return fontCache;
  }

  // Kanit font from Google Fonts CDN (v15)
  const [regular, bold] = await Promise.all([
    fetchFontAsBase64(
      "https://fonts.gstatic.com/s/kanit/v15/nKKZ-Go6G5tXcraBGwA.ttf"
    ),
    fetchFontAsBase64(
      "https://fonts.gstatic.com/s/kanit/v15/nKKU-Go6G5tXcr5aPhyzVA.ttf"
    ),
  ]);

  fontCache = { regular, bold };
  return fontCache;
}

export async function createPDFWithThaiFont(): Promise<jsPDF> {
  const doc = new jsPDF();
  const fonts = await loadFonts();

  // Add font to virtual file system
  doc.addFileToVFS("Kanit-Regular.ttf", fonts.regular);
  doc.addFileToVFS("Kanit-Bold.ttf", fonts.bold);

  // Register fonts
  doc.addFont("Kanit-Regular.ttf", "Kanit", "normal");
  doc.addFont("Kanit-Bold.ttf", "Kanit", "bold");

  // Set default font to Kanit
  doc.setFont("Kanit", "normal");

  return doc;
}

// Helper to set font style
export function setThaiFont(doc: jsPDF, style: "normal" | "bold" = "normal") {
  doc.setFont("Kanit", style);
}
