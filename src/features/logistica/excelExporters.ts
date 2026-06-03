import type { DocumentKind, LogisticsPreset, TripFields } from "./types";
import { buildGoodsLine, firstLine, formatDate, routeDestination, routeMerchandiseDescription } from "./formatters";

function escapeXml(value?: string) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function worksheetXml(kind: DocumentKind, preset: LogisticsPreset, trip: TripFields) {
  if (kind === "route") {
    const carrierName = trip.routeCarrierName || firstLine(preset.carrier);
    return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Title"><Alignment ss:Horizontal="Center"/><Font ss:Bold="1" ss:Size="14"/></Style>
    <Style ss:ID="SubTitle"><Alignment ss:Horizontal="Center"/><Font ss:Size="10"/></Style>
    <Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Color="#E5E7EB" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>
    <Style ss:ID="Label"><Font ss:Bold="1"/><Interior ss:Color="#F9FAFB" ss:Pattern="Solid"/></Style>
    <Style ss:ID="Text"><Alignment ss:WrapText="1" ss:Vertical="Top"/></Style>
    <Style ss:ID="Box"><Alignment ss:WrapText="1" ss:Vertical="Top"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>
    <Style ss:ID="Signature"><Alignment ss:Vertical="Top"/><Font ss:Bold="1"/></Style>
  </Styles>
  <Worksheet ss:Name="Hoja de ruta">
    <Table>
      <Column ss:Width="105"/><Column ss:Width="105"/><Column ss:Width="105"/><Column ss:Width="105"/><Column ss:Width="105"/><Column ss:Width="105"/>
      <Row ss:Height="22"><Cell ss:MergeAcross="5" ss:StyleID="Title"><Data ss:Type="String">DOCUMENTO DE CONTROL DE MERCANCIAS</Data></Cell></Row>
      <Row ss:Height="18"><Cell ss:MergeAcross="5" ss:StyleID="SubTitle"><Data ss:Type="String">Orden FOM 238/2003 - BOE Núm. 38 de 13 de Febrero de 2003</Data></Cell></Row>
      <Row ss:Height="22"><Cell ss:MergeAcross="2" ss:StyleID="Header"><Data ss:Type="String">EMPRESA CARGADORA</Data></Cell><Cell ss:MergeAcross="2" ss:StyleID="Header"><Data ss:Type="String">OPERADOR DE TRANSPORTE</Data></Cell></Row>
      <Row ss:Height="22"><Cell ss:MergeAcross="2" ss:StyleID="Text"><Data ss:Type="String">Lasarte Cítricos S.L.</Data></Cell><Cell ss:MergeAcross="2" ss:StyleID="Text"><Data ss:Type="String">${escapeXml(trip.routeOperator)}</Data></Cell></Row>
      <Row ss:Height="22"><Cell ss:MergeAcross="2" ss:StyleID="Text"><Data ss:Type="String">CIF: B14800304</Data></Cell><Cell ss:MergeAcross="2" ss:StyleID="Text"><Data ss:Type="String"></Data></Cell></Row>
      <Row ss:Height="22"><Cell ss:MergeAcross="2" ss:StyleID="Text"><Data ss:Type="String">Ctra. Madrid-Cádiz, km 461</Data></Cell><Cell ss:MergeAcross="2" ss:StyleID="Text"><Data ss:Type="String"></Data></Cell></Row>
      <Row ss:Height="22"><Cell ss:MergeAcross="2" ss:StyleID="Text"><Data ss:Type="String">41400</Data></Cell><Cell ss:MergeAcross="2" ss:StyleID="Text"><Data ss:Type="String"></Data></Cell></Row>
      <Row ss:Height="22"><Cell ss:MergeAcross="2" ss:StyleID="Header"><Data ss:Type="String">NOMBRE TRANSPORTISTA</Data></Cell><Cell ss:MergeAcross="2" ss:StyleID="Header"><Data ss:Type="String">DESTINATARIO</Data></Cell></Row>
      <Row ss:Height="76"><Cell ss:MergeAcross="2" ss:StyleID="Box"><Data ss:Type="String">${escapeXml(carrierName)}</Data></Cell><Cell ss:MergeAcross="2" ss:StyleID="Box"><Data ss:Type="String">${escapeXml(preset.consignee || preset.name)}</Data></Cell></Row>
      <Row ss:Height="22"><Cell ss:MergeAcross="2" ss:StyleID="Header"><Data ss:Type="String">MATRICULA DEL VEHICULO</Data></Cell><Cell ss:MergeAcross="2" ss:StyleID="Header"><Data ss:Type="String">DATOS EXPEDICION</Data></Cell></Row>
      <Row ss:Height="24"><Cell ss:StyleID="Label"><Data ss:Type="String">Matricula:</Data></Cell><Cell ss:MergeAcross="1" ss:StyleID="Text"><Data ss:Type="String">${escapeXml(trip.vehiclePlate)}</Data></Cell><Cell ss:StyleID="Label"><Data ss:Type="String">Origen:</Data></Cell><Cell ss:MergeAcross="1" ss:StyleID="Text"><Data ss:Type="String">ECIJA</Data></Cell></Row>
      <Row ss:Height="24"><Cell ss:StyleID="Label"><Data ss:Type="String">Tractora:</Data></Cell><Cell ss:MergeAcross="1" ss:StyleID="Text"><Data ss:Type="String">${escapeXml(trip.tractora)}</Data></Cell><Cell ss:StyleID="Label"><Data ss:Type="String">Destino:</Data></Cell><Cell ss:MergeAcross="1" ss:StyleID="Text"><Data ss:Type="String">${escapeXml(routeDestination(preset))}</Data></Cell></Row>
      <Row ss:Height="24"><Cell ss:StyleID="Label"><Data ss:Type="String">Remolque:</Data></Cell><Cell ss:MergeAcross="1" ss:StyleID="Text"><Data ss:Type="String">${escapeXml(trip.remolque)}</Data></Cell><Cell ss:MergeAcross="2" ss:StyleID="Text"><Data ss:Type="String"></Data></Cell></Row>
      <Row ss:Height="22"><Cell ss:MergeAcross="5" ss:StyleID="Header"><Data ss:Type="String">MERCANCIA</Data></Cell></Row>
      <Row ss:Height="24"><Cell ss:StyleID="Label"><Data ss:Type="String">Fecha Carga:</Data></Cell><Cell ss:MergeAcross="1" ss:StyleID="Text"><Data ss:Type="String">${escapeXml(`${formatDate(trip.fechaCarga)} ${trip.horaCarga}`.trim())}</Data></Cell><Cell ss:StyleID="Label"><Data ss:Type="String">Fecha Descarga:</Data></Cell><Cell ss:MergeAcross="1" ss:StyleID="Text"><Data ss:Type="String">${escapeXml(`${formatDate(trip.fechaDescarga)} ${trip.horaDescarga}`.trim())}</Data></Cell></Row>
      <Row ss:Height="22"><Cell ss:MergeAcross="4" ss:StyleID="Label"><Data ss:Type="String">Descripcion</Data></Cell><Cell ss:StyleID="Label"><Data ss:Type="String">Peso Kg.</Data></Cell></Row>
      <Row ss:Height="78"><Cell ss:MergeAcross="4" ss:StyleID="Box"><Data ss:Type="String">${escapeXml(routeMerchandiseDescription(trip))}</Data></Cell><Cell ss:StyleID="Box"><Data ss:Type="String">${escapeXml(trip.peso)}</Data></Cell></Row>
      <Row ss:Height="22"><Cell ss:MergeAcross="5" ss:StyleID="Header"><Data ss:Type="String">OBSERVACIONES</Data></Cell></Row>
      <Row ss:Height="56"><Cell ss:MergeAcross="5" ss:StyleID="Box"><Data ss:Type="String">${escapeXml(trip.observaciones)}</Data></Cell></Row>
      <Row ss:Height="60"><Cell ss:MergeAcross="1" ss:StyleID="Signature"><Data ss:Type="String">Firma Cargador:</Data></Cell><Cell ss:MergeAcross="1" ss:StyleID="Signature"><Data ss:Type="String">Firma Transportista:</Data></Cell><Cell ss:MergeAcross="1" ss:StyleID="Signature"><Data ss:Type="String">Firma Destinatario:</Data></Cell></Row>
    </Table>
    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
      <PageSetup><Layout x:Orientation="Portrait"/><PageMargins x:Bottom="0.35" x:Left="0.35" x:Right="0.35" x:Top="0.35"/></PageSetup>
      <FitToPage/>
      <Print><FitWidth>1</FitWidth><FitHeight>1</FitHeight></Print>
    </WorksheetOptions>
  </Worksheet>
</Workbook>`;
  }

  const rows = [
          ["CARTA DE PORTE CMR", ""],
          ["N. CMR", trip.numeroCarta],
          ["Expedidor", preset.sender],
          ["Destinatario", preset.consignee],
          ["Lugar carga", preset.load_place],
          ["Pais carga", preset.load_country],
          ["Fecha carga", formatDate(trip.fechaCarga)],
          ["Lugar entrega", preset.delivery_place],
          ["Pais entrega", preset.delivery_country],
          ["Cuadro 5 - Instrucciones", trip.instructions],
          ["Transportista", preset.carrier],
          ["Cuadro 7 - Successive carriers", trip.successiveCarriersEnabled ? trip.successiveCarriers : ""],
          ["Cuadro 8 - Reservas carrier", trip.carrierReservations],
          ["Cuadro 9 - Documentos", trip.documents || [trip.documento1, trip.documento2].filter(Boolean).join(" / ")],
          ["Cuadros 10-13 - Linea mercancia", buildGoodsLine(trip)],
          ["Cuadro 14 - Peso bruto kg", trip.peso],
          ["Cuadro 15 - Volumen m3", trip.volume],
          ["Cuadro 16 - Acuerdos especiales", trip.specialAgreements],
          ["Cuadro 17 - Otras indicaciones", trip.usefulParticulars17],
          ["Cuadro 18 - Parte no contractual", trip.nonContractual18],
          ["Cuadro 19 - Reembolso", trip.cashOnDelivery19],
          ["Conductor", trip.conductor],
          ["Tractora", trip.tractora],
          ["Remolque", trip.remolque],
          ["Cuadro 20", "This carriage is subject, notwithstanding any clause to the contrary, to the Convention on the Contract for the international Carriage of Goods by Road (CMR)"],
          ["Cuadro 21 - Establecido en", `ECIJA - ${formatDate(trip.fechaCarga)}`],
          ["Cuadro 24 - Recepcion destinatario", trip.consigneeReceipt24],
        ];

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Title"><Font ss:Bold="1" ss:Size="16"/><Interior ss:Color="#E5E7EB" ss:Pattern="Solid"/></Style>
    <Style ss:ID="Label"><Font ss:Bold="1"/><Interior ss:Color="#F9FAFB" ss:Pattern="Solid"/></Style>
    <Style ss:ID="Text"><Alignment ss:WrapText="1" ss:Vertical="Top"/></Style>
  </Styles>
  <Worksheet ss:Name="${kind === "route" ? "Hoja de ruta" : "CMR"}">
    <Table>
      <Column ss:Width="150"/>
      <Column ss:Width="430"/>
      ${rows
        .map((row, index) => `<Row ss:Height="${index === 0 ? 28 : 42}">
        <Cell ss:StyleID="${index === 0 ? "Title" : "Label"}"><Data ss:Type="String">${escapeXml(row[0])}</Data></Cell>
        <Cell ss:StyleID="Text"><Data ss:Type="String">${escapeXml(row[1])}</Data></Cell>
      </Row>`)
        .join("")}
    </Table>
  </Worksheet>
</Workbook>`;
}
