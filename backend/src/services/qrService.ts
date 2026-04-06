// backend/src/services/qrService.ts
import QRCode from "qrcode";

export async function generateQRCode(url: string, size = 300): Promise<string> {
  const dataUrl = await QRCode.toDataURL(url, {
    width: size,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
    errorCorrectionLevel: "M",
  });
  return dataUrl;
}

export async function generateQRCodeBuffer(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    width: 300,
    margin: 2,
    errorCorrectionLevel: "M",
  });
}

export async function generateQRCodeSVG(url: string): Promise<string> {
  return QRCode.toString(url, { type: "svg", width: 300, margin: 2 });
}
