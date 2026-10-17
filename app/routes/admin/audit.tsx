import { listAudit } from "~/models/audit.server";
import { formatLogTime } from "~/lib/locale";
import type { Route } from "./+types/audit";

export function meta() {
  return [{ title: "Protokoll · Tee-Etiketten" }];
}

export function loader() {
  return { entries: listAudit(300) };
}

export default function Audit({ loaderData }: Route.ComponentProps) {
  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl tracking-wide uppercase">Protokoll</h1>
      <p className="text-stone-700">Die letzten 300 Änderungen und Anmeldungen. Drucke stehen zusätzlich bei jeder Sorte unter „Zuletzt gedruckt“.</p>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-stone-50 text-stone-600">
            <tr>
              <th className="px-4 py-2 font-semibold">Zeit</th>
              <th className="px-4 py-2 font-semibold">Benutzer</th>
              <th className="px-4 py-2 font-semibold">Aktion</th>
              <th className="px-4 py-2 font-semibold">Bereich</th>
              <th className="px-4 py-2 font-semibold">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {loaderData.entries.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-2 whitespace-nowrap text-stone-600">{formatLogTime(e.createdAt)}</td>
                <td className="px-4 py-2">{e.userName}</td>
                <td className="px-4 py-2">{e.action}</td>
                <td className="px-4 py-2">{e.entity}</td>
                <td className="px-4 py-2 text-stone-600">{e.summary}</td>
              </tr>
            ))}
            {!loaderData.entries.length ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-stone-500">
                  Noch keine Einträge.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
