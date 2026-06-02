# Logistics PDF Renderer

This service renders route sheet templates without rebuilding their design in the browser.

## Why this exists

Most route sheet templates in `D:\transporte` are old `.xls` files. Browser libraries can read and write them, but they do not preserve the original print layout reliably. This renderer opens the original file with LibreOffice, fills only the variable cells, and exports either PDF or XLSX.

## Flow

1. The React app calls the Supabase Edge Function `logistics-generate-route`.
2. The Edge Function downloads the original template from Supabase Storage.
3. The Edge Function sends the file and variable fields to this renderer.
4. LibreOffice fills the original template and exports PDF or XLSX.
5. The Edge Function returns the generated file to the browser.

## Deploy the renderer

Build and run locally:

```powershell
docker build -t logistics-renderer services/logistics-renderer
docker run --rm -p 8080:8080 -e RENDERER_TOKEN="change-this-token" logistics-renderer
```

Health check:

```powershell
Invoke-WebRequest http://localhost:8080/health
```

Deploy the same Docker image to Render, Railway, Fly, a VPS, or any host that supports Docker.

## Configure Supabase

Set these secrets in the Supabase project:

```powershell
supabase secrets set LOGISTICS_RENDERER_URL="https://your-renderer.example.com"
supabase secrets set LOGISTICS_RENDERER_TOKEN="change-this-token"
```

Deploy the Edge Function:

```powershell
supabase functions deploy logistics-generate-route
```

The existing CMR function stays separate because CMR templates are already PDFs.

