import base64
import json
import os
import subprocess
import tempfile
import time
import unicodedata
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

import uno
from com.sun.star.beans import PropertyValue


HOST = "0.0.0.0"
PORT = int(os.environ.get("PORT", "8080"))
RENDERER_TOKEN = os.environ.get("RENDERER_TOKEN", "")
SOFFICE_PORT = int(os.environ.get("SOFFICE_PORT", "2002"))

ROUTE_LABELS = {
    "conductor": (["CONDUCTOR"], 1),
    "tractora": (["Tractora"], 1),
    "remolque": (["Remolque"], 1),
    "origen": (["Origen"], 1),
    "destino": (["Destino"], 1),
    "fechaCarga": (["Fecha Carga", "FECHA"], 1),
    "fechaDescarga": (["Fecha Descarga"], 2),
    "observaciones": (["Observaciones"], 1),
}


def prop(name, value):
    item = PropertyValue()
    item.Name = name
    item.Value = value
    return item


def normalize(value):
    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    return text.casefold().strip()


def file_url(path):
    return uno.systemPathToFileUrl(str(Path(path).resolve()))


def start_soffice():
    command = [
        "soffice",
        "--headless",
        "--nologo",
        "--nodefault",
        "--norestore",
        "--nofirststartwizard",
        f"--accept=socket,host=127.0.0.1,port={SOFFICE_PORT};urp;StarOffice.ComponentContext",
    ]
    process = subprocess.Popen(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    local_context = uno.getComponentContext()
    resolver = local_context.ServiceManager.createInstanceWithContext(
        "com.sun.star.bridge.UnoUrlResolver",
        local_context,
    )

    for _ in range(60):
        try:
            context = resolver.resolve(
                f"uno:socket,host=127.0.0.1,port={SOFFICE_PORT};urp;StarOffice.ComponentContext"
            )
            desktop = context.ServiceManager.createInstanceWithContext("com.sun.star.frame.Desktop", context)
            return process, desktop
        except Exception:
            time.sleep(0.25)

    process.terminate()
    raise RuntimeError("No se pudo arrancar LibreOffice")


SOFFICE_PROCESS, DESKTOP = start_soffice()


def used_range(sheet):
    cursor = sheet.createCursor()
    cursor.gotoStartOfUsedArea(False)
    cursor.gotoEndOfUsedArea(True)
    address = cursor.RangeAddress
    return address.EndRow, address.EndColumn


def cell_text(cell):
    text = getattr(cell, "String", "")
    if text:
        return text
    value = getattr(cell, "Value", None)
    return "" if value in (None, 0) else str(value)


def find_cell(sheet, labels):
    max_row, max_col = used_range(sheet)
    needles = [normalize(label) for label in labels]
    for row in range(max_row + 1):
        for col in range(max_col + 1):
            haystack = normalize(cell_text(sheet.getCellByPosition(col, row)))
            if haystack and any(needle in haystack for needle in needles):
                return row, col
    return None


def set_right_of_label(sheet, labels, value, offset=1):
    if value in (None, ""):
        return
    found = find_cell(sheet, labels)
    if not found:
        return
    row, col = found
    sheet.getCellByPosition(col + offset, row).String = str(value)


def set_below_label(sheet, labels, value, row_offset=2, col_offset=1):
    if value in (None, ""):
        return
    found = find_cell(sheet, labels)
    if not found:
        return
    row, col = found
    sheet.getCellByPosition(col + col_offset, row + row_offset).String = str(value)


def fill_route(document, fields):
    sheet = document.Sheets.getByIndex(0)

    for key, (labels, offset) in ROUTE_LABELS.items():
        set_right_of_label(sheet, labels, fields.get(key), offset)

    set_below_label(sheet, ["Descripcion", "Descripción", "DESCRIPCION"], fields.get("mercancia"))
    set_below_label(sheet, ["KG", "PESO"], fields.get("peso"), row_offset=2, col_offset=0)


def load_document(input_path):
    return DESKTOP.loadComponentFromURL(
        file_url(input_path),
        "_blank",
        0,
        (
            prop("Hidden", True),
            prop("ReadOnly", False),
            prop("UpdateDocMode", 0),
        ),
    )


def export_document(document, output_path, output):
    if output == "pdf":
        document.storeToURL(file_url(output_path), (prop("FilterName", "calc_pdf_Export"),))
        return "application/pdf"

    document.storeToURL(file_url(output_path), (prop("FilterName", "Calc MS Excel 2007 XML"),))
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def render_route(payload):
    file_bytes = base64.b64decode(payload["fileBase64"])
    extension = str(payload.get("extension") or "xls").lower().lstrip(".")
    output = payload.get("output") if payload.get("output") in ("pdf", "xlsx") else "pdf"
    fields = payload.get("fields") or {}

    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = Path(tmpdir) / f"template.{extension}"
        output_path = Path(tmpdir) / f"route.{output}"
        input_path.write_bytes(file_bytes)

        document = load_document(input_path)
        if not document:
            raise RuntimeError("LibreOffice no pudo abrir la plantilla")

        try:
            fill_route(document, fields)
            content_type = export_document(document, output_path, output)
        finally:
            document.close(True)

        return content_type, output_path.read_bytes()


class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "authorization, content-type")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.end_headers()

    def do_GET(self):
        if urlparse(self.path).path != "/health":
            self.respond_json(404, {"error": "Not found"})
            return
        self.respond_json(200, {"ok": True})

    def do_POST(self):
        if urlparse(self.path).path != "/render-route":
            self.respond_json(404, {"error": "Not found"})
            return

        expected = f"Bearer {RENDERER_TOKEN}"
        if RENDERER_TOKEN and self.headers.get("Authorization") != expected:
            self.respond_json(401, {"error": "Unauthorized"})
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(content_length))
            content_type, output = render_route(payload)
            request_id = uuid.uuid4().hex
            extension = "pdf" if content_type == "application/pdf" else "xlsx"

            self.send_response(200)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Disposition", f'attachment; filename="hoja-ruta-{request_id}.{extension}"')
            self.send_header("Content-Length", str(len(output)))
            self.end_headers()
            self.wfile.write(output)
        except Exception as error:
            self.respond_json(500, {"error": str(error)})

    def respond_json(self, status, body):
        encoded = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def log_message(self, _format, *args):
        return


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    try:
        server.serve_forever()
    finally:
        SOFFICE_PROCESS.terminate()
