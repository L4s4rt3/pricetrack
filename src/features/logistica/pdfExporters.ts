import type { LogisticsPreset, TripFields } from "./types";
import { buildGoodsLine, firstLine, formatDate, routeDestination, routeMerchandiseDescription, splitLines } from "./formatters";

const CMR_TEMPLATE_PATH = "/templates/plantilla-cmr.pdf";
const ROUTE_TEMPLATE_PATH = "/templates/plantilla-hoja-ruta.pdf";

export async function generateExactCmrPdf(preset: LogisticsPreset, trip: TripFields, company: string) {
  const { PDFDocument, StandardFonts } = await import("pdf-lib");
  const templateBytes = await fetch(CMR_TEMPLATE_PATH).then((response) => {
    if (!response.ok) throw new Error("No se pudo cargar la plantilla CMR vacia.");
    return response.arrayBuffer();
  });

  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const date = formatDate(trip.fechaCarga);
  const successive = trip.successiveCarriersEnabled ? splitLines(trip.successiveCarriers, 4) : [];

  const values: Record<string, string> = {
    "001": company,
    NumCarta: trip.numeroCarta,
    "002": preset.consignee,
    "003_1": "ECIJA",
    "003_2": "ESPAÑA",
    "003_3": date,
    "004_1": preset.delivery_place ? `TRANSITARIO: ${preset.delivery_place}` : "",
    "004_2": preset.delivery_country,
    "005": trip.instructions,
    "006": preset.carrier,
    "007_1": successive[0] ?? "",
    "007_2": successive[1] ?? "",
    "007_3": successive[2] ?? "",
    "007_4": successive[3] ?? "",
    "008_01": trip.carrierReservations,
    "008_02": "",
    "009": trip.documents || [trip.documento1, trip.documento2].filter(Boolean).join("\n"),
    "010_01": buildGoodsLine(trip),
    "014_01": trip.peso,
    "015_01": trip.volume,
    "016": trip.specialAgreements,
    "021_01": "ECIJA",
    "021_02": date,
    "021_03": "",
    "022": company,
    "023": preset.carrier,
    TRACTORA: trip.tractora,
    REMOLQUE: trip.remolque,
  };

  for (const [name, value] of Object.entries(values)) {
    try {
      form.getTextField(name).setText(value ?? "");
    } catch {
      // Historic and blank templates do not always expose every optional field.
    }
  }

  form.updateFieldAppearances(font);
  form.flatten();
  return pdfDoc.save();
}

function wrapPdfLines(text: string, maxWidth: number, size: number, font: { widthOfTextAtSize: (line: string, size: number) => number }, maxLines = 4) {
  const clean = String(text ?? "").replace(/\r/g, "");
  const lines: string[] = [];

  for (const paragraph of clean.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }

    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        current = next;
      } else {
        if (current) lines.push(current);
        current = word;
      }
      if (lines.length >= maxLines) break;
    }
    if (lines.length >= maxLines) break;
    if (current) lines.push(current);
    if (lines.length >= maxLines) break;
  }

  return lines.slice(0, maxLines);
}

export async function generateExactRoutePdf(preset: LogisticsPreset, trip: TripFields) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const templateBytes = await fetch(ROUTE_TEMPLATE_PATH).then((response) => {
    if (!response.ok) throw new Error("No se pudo cargar la plantilla de hoja de ruta.");
    return response.arrayBuffer();
  });

  const pdfDoc = await PDFDocument.load(templateBytes);
  while (pdfDoc.getPageCount() > 1) pdfDoc.removePage(1);

  const page = pdfDoc.getPage(0);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.05, 0.05, 0.06);
  const small = 9.5;
  const normal = 10.5;

  const draw = (text: string, x: number, y: number, options: { size?: number; maxWidth?: number; maxLines?: number; lineHeight?: number; bold?: boolean } = {}) => {
    const size = options.size ?? normal;
    const selectedFont = options.bold ? bold : font;
    const maxWidth = options.maxWidth ?? 220;
    const lineHeight = options.lineHeight ?? size + 2.5;
    const lines = wrapPdfLines(text, maxWidth, size, selectedFont, options.maxLines ?? 4);
    lines.forEach((line, index) => {
      page.drawText(line, { x, y: y - index * lineHeight, size, font: selectedFont, color: ink });
    });
  };

  const carrierName = trip.routeCarrierName || firstLine(preset.carrier);
  const vehicle = [
    trip.vehiclePlate ? `Matrícula: ${trip.vehiclePlate}` : "",
    trip.tractora ? `Tractora: ${trip.tractora}` : "",
    trip.remolque ? `Remolque: ${trip.remolque}` : "",
  ].filter(Boolean);

  draw(trip.routeOperator, 322, 670, { maxWidth: 220, maxLines: 5 });
  draw(carrierName, 62, 431, { maxWidth: 210, maxLines: 5 });
  draw(preset.consignee || preset.name, 322, 431, { maxWidth: 225, maxLines: 6 });
  draw(vehicle[0] ?? "", 62, 338, { maxWidth: 205, maxLines: 1 });
  draw(trip.tractora, 112, 328, { maxWidth: 150, maxLines: 1 });
  draw(trip.remolque, 112, 299, { maxWidth: 150, maxLines: 1 });
  draw("ECIJA", 330, 328, { maxWidth: 120, maxLines: 1, bold: true });
  draw(routeDestination(preset), 330, 299, { maxWidth: 210, maxLines: 3 });
  draw(`${formatDate(trip.fechaCarga)} ${trip.horaCarga}`.trim(), 132, 226, { maxWidth: 120, maxLines: 1 });
  draw(`${formatDate(trip.fechaDescarga)} ${trip.horaDescarga}`.trim(), 410, 226, { maxWidth: 120, maxLines: 1 });
  draw(routeMerchandiseDescription(trip), 62, 162, { size: small, maxWidth: 390, maxLines: 7, lineHeight: 11.5 });
  draw(trip.peso, 490, 162, { size: small, maxWidth: 70, maxLines: 1 });
  draw(trip.observaciones, 62, 34, { size: 8.5, maxWidth: 480, maxLines: 3, lineHeight: 10 });

  return pdfDoc.save();
}
