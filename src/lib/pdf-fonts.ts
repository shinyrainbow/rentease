import { jsPDF } from "jspdf";

// Thai font support for jsPDF
// We use Sarabun font from Google Fonts which supports Thai characters

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

  // Sarabun font from Google Fonts CDN (v17)
  const [regular, bold] = await Promise.all([
    fetchFontAsBase64(
      "https://fonts.gstatic.com/s/sarabun/v17/DtVjJx26TKEr37c9WBI.ttf"
    ),
    fetchFontAsBase64(
      "https://fonts.gstatic.com/s/sarabun/v17/DtVmJx26TKEr37c9YK5sulw.ttf"
    ),
  ]);

  fontCache = { regular, bold };
  return fontCache;
}

export async function createPDFWithThaiFont(): Promise<jsPDF> {
  const doc = new jsPDF();
  const fonts = await loadFonts();

  // Add font to virtual file system
  doc.addFileToVFS("Sarabun-Regular.ttf", fonts.regular);
  doc.addFileToVFS("Sarabun-Bold.ttf", fonts.bold);

  // Register fonts
  doc.addFont("Sarabun-Regular.ttf", "Sarabun", "normal");
  doc.addFont("Sarabun-Bold.ttf", "Sarabun", "bold");

  // Set default font to Sarabun
  doc.setFont("Sarabun", "normal");

  return doc;
}

// Helper to set font style
export function setThaiFont(doc: jsPDF, style: "normal" | "bold" = "normal") {
  doc.setFont("Sarabun", style);
}
