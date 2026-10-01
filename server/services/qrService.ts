import QRCode from "qrcode";
import { qrSettingsSchema } from "@shared/api";
import type { QrStyle } from "../repositories/qrRepository";

export const DEFAULT_QR_STYLE: QrStyle = qrSettingsSchema.parse({}) as QrStyle;

export async function renderQr(text: string, style: QrStyle, format: "png" | "svg"): Promise<Buffer | string> {
  const options = {
    errorCorrectionLevel: style.errorCorrection as "L" | "M" | "Q" | "H",
    margin: 2,
    width: style.size,
    color: { dark: style.darkColor, light: style.lightColor },
  };
  return format === "svg"
    ? QRCode.toString(text, { ...options, type: "svg" })
    : QRCode.toBuffer(text, { ...options, type: "png" });
}
