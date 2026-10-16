import { Form, NavLink, Outlet, useNavigation } from "react-router";
import { requireLogin } from "~/lib/session.server";
import type { Route } from "./+types/app-layout";

export const middleware: Route.MiddlewareFunction[] = [requireLogin];

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
    isActive ? "bg-white/15 text-white" : "text-brand-100 hover:bg-white/10 hover:text-white"
  }`;

export default function AppLayout() {
  const navigation = useNavigation();
  return (
    <div className="min-h-screen">
      <header className="bg-brand-800 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <NavLink to="/" className="font-display text-xl tracking-wide uppercase">
            Tee-Etiketten
          </NavLink>
          <nav className="flex gap-1">
            <NavLink to="/" end className={navClass}>
              Tees
            </NavLink>
            <NavLink to="/drucker" className={navClass}>
              Drucker
            </NavLink>
          </nav>
          <Form method="post" action="/logout" className="ml-auto">
            <button className="text-sm text-brand-100 hover:text-white">Abmelden</button>
          </Form>
        </div>
        <div className={`h-0.5 bg-brand-100 transition-opacity ${navigation.state === "idle" ? "opacity-0" : "animate-pulse opacity-100"}`} />
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
