import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.ts"),
  layout("routes/app-layout.tsx", [
    index("routes/teas.tsx"),
    route("tees/neu", "routes/tea-new.tsx"),
    route("tees/:teaId", "routes/tea-edit.tsx"),
    route("tees/:teaId/etiketten.pdf", "routes/tea-pdf.ts"),
    route("drucker", "routes/printers.tsx"),
    route("drucker/:printerId", "routes/printer.tsx"),
    route("drucker/:printerId/testbogen.pdf", "routes/printer-test-pdf.ts"),
  ]),
] satisfies RouteConfig;
