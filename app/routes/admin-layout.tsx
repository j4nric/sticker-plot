import { NavLink, Outlet } from "react-router";
import { requireAdmin } from "~/lib/session.server";
import type { Route } from "./+types/admin-layout";

export const middleware: Route.MiddlewareFunction[] = [requireAdmin];

const links = [
  ["/verwaltung/import", "Import"],
  ["/verwaltung/vorlagen", "Vorlagen"],
  ["/verwaltung/bogenformate", "Bogenformate"],
  ["/verwaltung/einstellungen", "Einstellungen"],
  ["/verwaltung/benutzer", "Benutzer"],
  ["/verwaltung/protokoll", "Protokoll"],
  ["/verwaltung/sicherung", "Sicherung"],
] as const;

export default function AdminLayout() {
  return (
    <div className="space-y-5">
      <nav className="flex flex-wrap gap-1 border-b border-stone-200 pb-3 text-sm">
        <NavLink to="/verwaltung" end className={({ isActive }) => `rounded-md px-3 py-1.5 font-semibold ${isActive ? "bg-stone-800 text-white" : "text-stone-700 hover:bg-stone-200"}`}>
          Übersicht
        </NavLink>
        {links.map(([to, label]) => (
          <NavLink key={to} to={to} className={({ isActive }) => `rounded-md px-3 py-1.5 font-semibold ${isActive ? "bg-stone-800 text-white" : "text-stone-700 hover:bg-stone-200"}`}>
            {label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
