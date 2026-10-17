import { Form, NavLink, Outlet, useNavigation } from "react-router";
import { currentUser, requireLogin } from "~/lib/session.server";
import type { Route } from "./+types/app-layout";

export const middleware: Route.MiddlewareFunction[] = [requireLogin];

export function loader({ context }: Route.LoaderArgs) {
  return { user: currentUser(context) };
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${isActive ? "bg-white/15 text-white" : "text-brand-100 hover:bg-white/10 hover:text-white"}`;

export default function AppLayout({ loaderData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const { user } = loaderData;
  return (
    <div className="min-h-screen">
      <header className="bg-brand-800 text-white print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <NavLink to="/" className="font-display text-xl tracking-wide uppercase">
            Tee-Etiketten
          </NavLink>
          <nav className="flex flex-wrap gap-1">
            <NavLink to="/" end className={navClass}>
              Tees
            </NavLink>
            <NavLink to="/sammeldruck" className={navClass}>
              Sammeldruck
            </NavLink>
            <NavLink to="/drucker" className={navClass}>
              Drucker
            </NavLink>
            {user.role === "admin" ? (
              <NavLink to="/verwaltung" className={navClass}>
                Verwaltung
              </NavLink>
            ) : null}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <NavLink to="/konto" className="text-brand-100 hover:text-white" title="Konto und Passwort">
              {user.displayName}
            </NavLink>
            <Form method="post" action="/logout">
              <button className="text-brand-100 hover:text-white">Abmelden</button>
            </Form>
          </div>
        </div>
        <div className={`h-0.5 bg-brand-100 transition-opacity ${navigation.state === "idle" ? "opacity-0" : "animate-pulse opacity-100"}`} />
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
