import QRCode from "qrcode";

/** Render a QR code for the given content as an SVG data URI (dark on light). */
export async function qrSvgDataUri(content: string): Promise<string> {
  const svg = await QRCode.toString(content, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: { dark: "#0b0c10ff", light: "#ffffffff" },
  });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}