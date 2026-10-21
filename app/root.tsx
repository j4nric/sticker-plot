import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import type { Route } from "./+types/root";
import { browserFontCss } from "./label/fonts";
// Etikett-Styles als gemeinsame, im Browser zwischengespeicherte CSS-Datei
// (das PDF bettet dieselbe Datei roh ein, siehe lib/render.server.tsx)
import "./label/label.css";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "preload", href: "/fonts/oswald-latin-500-normal.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous" },
  { rel: "preload", href: "/fonts/source-serif-4-latin-400-normal.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        {/* Gleiche Schriften wie im PDF */}
        <style dangerouslySetInnerHTML={{ __html: browserFontCss }} />
      </head>
      <body className="min-h-screen font-sans antialiased">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Fehler";
  let details = "Ein unerwarteter Fehler ist aufgetreten.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "Nicht gefunden" : `Fehler ${error.status}`;
    details = error.status === 404 ? "Diese Seite gibt es nicht." : typeof error.data === "string" ? error.data : error.statusText || details;
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="container mx-auto max-w-3xl p-6 pt-16">
      <h1 className="font-display text-3xl uppercase">{message}</h1>
      <p className="mt-2 text-stone-700">{details}</p>
      <p className="mt-6">
        <a className="btn-secondary" href="/">
          Zur Startseite
        </a>
      </p>
      {stack && (
        <pre className="mt-6 w-full overflow-x-auto rounded-lg bg-stone-900 p-4 text-xs text-stone-100">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
