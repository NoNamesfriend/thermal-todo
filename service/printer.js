import { ThermalPrinter, PrinterTypes } from "node-thermal-printer";
import { env } from "./config.js";

function resolvePrinterType(envType) {
  if (!envType) return PrinterTypes.EPSON;
  // Accept values like 'EPSON' or 'STAR' (case-insensitive)
  const key = String(envType).toUpperCase();
  return PrinterTypes[key] || PrinterTypes.EPSON;
}

export async function printImage(base64Image) {
  const type = resolvePrinterType(env.PRINTER_TYPE);
  const iface = env.PRINTER_INTERFACE || "usb";

  const printer = new ThermalPrinter({
    type,
    interface: iface,
    // examples: "usb", "tcp://192.168.0.50", "/dev/usb/lp0"
    options: { timeout: 5000 },
  });

  const imageBuffer = Buffer.from(
    base64Image.replace(/^data:image\/png;base64,/, ""),
    "base64"
  );

  await printer.printImageBuffer(imageBuffer);
  printer.cut();

  const isConnected = await printer.isPrinterConnected();
  if (!isConnected) throw new Error("Printer not available");

  await printer.execute();
}
