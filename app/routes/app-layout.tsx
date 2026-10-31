import { Form, NavLink, Outlet, useNavigation } from "react-router";
import { currentUser, requireLogin } from "~/lib/session.server";
import type { Route } from "./+types/app-layout";

export const middleware: Route.MiddlewareFunction[] = [requireLogin];

export function loader({ context }: Route.LoaderArgs) {
  return { user: currentUser(context) };
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex min-h-12 items-center rounded-xl px-4 text-base font-semibold transition-colors ${isActive ? "bg-white/15 text-white" : "text-brand-100 hover:bg-white/10 hover:text-white"}`;

export default function AppLayout({ loaderData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const { user } = loaderData;
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 bg-brand-800 pt-[env(safe-area-inset-top)] text-white print:hidden">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-2">
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
          <div className="ml-auto flex items-center gap-2 text-base">
            <NavLink to="/konto" className="inline-flex min-h-12 items-center rounded-xl px-3 text-brand-100 hover:text-white" title="Konto und Passwort">
              {user.displayName}
            </NavLink>
            <Form method="post" action="/logout">
              <button className="min-h-12 rounded-xl px-3 text-brand-100 hover:text-white">Abmelden</button>
            </Form>
          </div>
        </div>
        <div className={`h-0.5 bg-brand-100 transition-opacity ${navigation.state === "idle" ? "opacity-0" : "animate-pulse opacity-100"}`} />
      </header>
      <main className="mx-auto max-w-7xl px-5 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
    </div>
  );
}
