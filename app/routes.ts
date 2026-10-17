import { type RouteConfig, index, layout, prefix, route } from "@react-router/dev/routes";

export default [
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.ts"),
  layout("routes/app-layout.tsx", [
    index("routes/teas.tsx"),
    route("tees/neu", "routes/tea-new.tsx"),
    route("tees/:teaId", "routes/tea-edit.tsx"),
    route("tees/:teaId/etiketten.pdf", "routes/tea-pdf.ts"),
    route("tees/:teaId/bild", "routes/tea-image.ts"),
    route("bilder/:imageId", "routes/image.ts"),
    route("sammeldruck", "routes/mixed-print.tsx"),
    route("sammeldruck.pdf", "routes/mixed-pdf.ts"),
    route("drucker", "routes/printers.tsx"),
    route("drucker/:printerId", "routes/printer.tsx"),
    route("drucker/:printerId/testbogen.pdf", "routes/printer-test-pdf.ts"),
    route("konto", "routes/account.tsx"),
    layout("routes/admin-layout.tsx", [
      ...prefix("verwaltung", [
        index("routes/admin/index.tsx"),
        route("einstellungen", "routes/admin/settings.tsx"),
        route("bogenformate", "routes/admin/formats.tsx"),
        route("bogenformate/:formatId", "routes/admin/format-edit.tsx"),
        route("vorlagen", "routes/admin/templates.tsx"),
        route("vorlagen/:templateId", "routes/admin/template-edit.tsx"),
        route("benutzer", "routes/admin/users.tsx"),
        route("protokoll", "routes/admin/audit.tsx"),
        route("sicherung", "routes/admin/backup.tsx"),
        route("sicherung/datenbank.sqlite", "routes/admin/backup-download.ts"),
        route("import", "routes/admin/import.tsx"),
        route("import/status", "routes/admin/import-status.ts"),
        route("import/:itemId/vorschau.png", "routes/admin/import-preview.ts"),
        route("export.csv", "routes/admin/export-csv.ts"),
      ]),
    ]),
  ]),
] satisfies RouteConfig;
