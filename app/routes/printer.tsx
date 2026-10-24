import { useState } from "react";
import { data, Form, Link, redirect, useNavigation } from "react-router";
import { CrosshairHelp } from "~/components/CrosshairHelp";
import { applyMeasurement, NO_CALIBRATION, referencePoints, type Calibration } from "~/label/geometry";
import { currentUser } from "~/lib/session.server";
import { audit } from "~/models/audit.server";
import { getFormat, listFormats } from "~/models/format.server";
import { readCalibration, readMeasurement } from "~/lib/validation";
import {
  deletePrinter,
  getPrinter,
  listPrinters,
  renamePrinter,
  setCalibration,
  setDefaultPrinter,
  toCalibration,
} from "~/models/printer.server";
import { formatNumber, formatSigned } from "~/lib/locale";
import { parseId } from "~/lib/params";
import { Notice } from "~/components/Notice";
import { useRememberedFormat } from "~/components/useDeviceChoice";
import type { Route } from "./+types/printer";

function printerIdFrom(params: { printerId: string }) {
  const printer = getPrinter(parseId(params.printerId));
  if (!printer) throw data("Drucker nicht gefunden", { status: 404 });
  return printer;
}

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.printer.name ?? "Drucker"} · Tee-Etiketten` }];
}

export function loader({ params, context }: Route.LoaderArgs) {
  const user = currentUser(context);
  const printer = printerIdFrom(params);
  const formats = listFormats().map((f) => ({ ...f, ref: referencePoints(f) }));
  return { printer, printerCount: listPrinters().length, formats, isAdmin: user.role === "admin" };
}

type ActionResult = { message?: string; errors?: Record<string, string>; calibrated?: boolean };

/** Kennung einer Korrektur; Ablesewerte gelten nur für den Stand, mit dem der Testbogen gedruckt wurde. */
const calibrationKey = (c: Calibration) => [c.offsetX, c.offsetY, c.scaleX, c.scaleY].join("/");

export async function action({ request, params, context }: Route.ActionArgs) {
  const user = currentUser(context);
  const printer = printerIdFrom(params);
  const form = await request.formData();
  const intent = form.get("intent");
  const log = (what: string, summary = "") => audit(user.username, what, "drucker", printer.id, `${printer.name}${summary ? ": " + summary : ""}`);

  switch (intent) {
    case "measure": {
      // Ablesewerte beziehen sich auf die Korrektur, mit der der Testbogen gedruckt wurde. Hat sie
      // sich seit dem Laden der Seite geändert (zweiter Tab, doppelt eingetragen), nicht noch
      // einmal verrechnen: Das würde die Korrektur verdoppeln.
      if (form.get("basis") !== calibrationKey(toCalibration(printer))) {
        return data<ActionResult>(
          { errors: { form: "Die Korrektur wurde inzwischen schon geändert. Die Werte gehören zu einem älteren Testbogen. Bitte einen neuen Testbogen drucken und dessen Werte eintragen." } },
          { status: 409 },
        );
      }
      const m = readMeasurement(form);
      if (!m.ok) return data<ActionResult>({ errors: m.errors }, { status: 400 });
      const format = getFormat(Number(form.get("format"))) ?? listFormats()[0]!;
      const next = applyMeasurement(toCalibration(printer), m.values, format);
      setCalibration(printer.id, next);
      log("kalibrieren", `X ${next.offsetX} mm, Y ${next.offsetY} mm, ${(next.scaleX * 100).toFixed(2)} % / ${(next.scaleY * 100).toFixed(2)} %`);
      return { message: "Korrektur übernommen.", calibrated: true } as ActionResult;
    }
    case "manual": {
      const c = readCalibration(form);
      if (!c.ok) return data<ActionResult>({ errors: c.errors }, { status: 400 });
      setCalibration(printer.id, c.value);
      log("kalibrieren", "Werte direkt eingetragen");
      return { message: "Werte gespeichert." } as ActionResult;
    }
    case "reset":
      setCalibration(printer.id, NO_CALIBRATION);
      log("kalibrierung zurücksetzen");
      return { message: "Korrektur zurückgesetzt." } as ActionResult;
    case "rename": {
      const name = String(form.get("name") ?? "").trim();
      if (!name || name.length > 60) return data<ActionResult>({ errors: { name: "Höchstens 60 Zeichen, nicht leer." } }, { status: 400 });
      renamePrinter(printer.id, name);
      log("umbenennen", name);
      return { message: "Name gespeichert." } as ActionResult;
    }
    case "default":
      setDefaultPrinter(printer.id);
      log("als standard setzen");
      return { message: "Als Standarddrucker gesetzt." } as ActionResult;
    case "delete":
      if (user.role !== "admin") throw data("Nur Administratoren dürfen Drucker löschen.", { status: 403 });
      log("löschen");
      if (!deletePrinter(printer.id)) return data<ActionResult>({ errors: { delete: "Der letzte Drucker kann nicht gelöscht werden." } }, { status: 400 });
      throw redirect("/drucker");
    default:
      throw data("Unbekannte Aktion", { status: 400 });
  }
}

function NumberField({ name, label, defaultValue, error, suffix }: { name: string; label: string; defaultValue?: string; error?: string; suffix: string }) {
  return (
    <div>
      <label className="field-label" htmlFor={name}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input id={name} name={name} inputMode="decimal" defaultValue={defaultValue} placeholder="0" className="field-input w-24 text-right" autoComplete="off" />
        <span className="text-sm text-stone-600">{suffix}</span>
      </div>
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}

export default function PrinterPage({ loaderData, actionData }: Route.ComponentProps) {
  const { printer, printerCount, formats, isAdmin } = loaderData;
  const { formatId, format, chooseFormat } = useRememberedFormat(formats);
  // Nach dem Speichern die Eingabe ausblenden, damit dieselben Werte nicht ein zweites Mal verrechnet werden
  const [reopenedFor, setReopenedFor] = useState<ActionResult | undefined>();
  const awaitingTestSheet = Boolean(actionData?.calibrated) && reopenedFor !== actionData;
  const testSheetUrl = `/drucker/${printer.id}/testbogen.pdf?format=${format.id}`;
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";
  const errors = actionData?.errors ?? {};
  const intent = navigation.formData?.get("intent");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/drucker" className="text-sm text-stone-600 hover:text-stone-900">
          ‹ Alle Drucker
        </Link>
        <h1 className="flex w-full items-center gap-3 font-display text-3xl tracking-wide uppercase">
          {printer.name}
          {printer.isDefault ? <span className="rounded-full bg-brand-100 px-2 py-0.5 font-sans text-xs font-semibold tracking-normal text-brand-800 normal-case">Standard</span> : null}
        </h1>
      </div>

      {actionData?.message ? <Notice>{actionData.message}</Notice> : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card space-y-3">
          <h2 className="font-display text-lg tracking-wide uppercase">1. Testbogen drucken</h2>
          <p className="text-stone-700">
            Den Testbogen auf einen <b>leeren Etikettenbogen</b> drucken, in tatsächlicher Größe (100 %). Der Bogen enthält die aktuelle
            Korrektur, so lässt sich jede Einstellung direkt überprüfen.
          </p>
          {formats.length > 1 ? (
            <div>
              <label className="field-label" htmlFor="format-select">
                Bogenformat
              </label>
              <select id="format-select" value={formatId} onChange={(e) => chooseFormat(Number(e.target.value))} className="field-input">
                {formats.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <a href={testSheetUrl} target="_blank" rel="noreferrer" className="btn-primary">
            Testbogen als PDF öffnen
          </a>
          <div className="rounded-lg bg-stone-50 p-3 text-sm text-stone-700">
            <p className="font-semibold">Aktuelle Korrektur</p>
            <p>
              Verschiebung X {formatSigned(printer.offsetX)} mm, Y {formatSigned(printer.offsetY)} mm
              <br />
              Skalierung {formatNumber(printer.scaleX * 100)} % breit, {formatNumber(printer.scaleY * 100)} % hoch
            </p>
          </div>
        </section>

        <section className="card space-y-4">
          <h2 className="font-display text-lg tracking-wide uppercase">2. Ablesewerte eintragen</h2>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <p className="text-sm text-stone-700">
              An jedem Kreuz ablesen, bei welchem Strich die <b>echte Etikettkante</b> die Skala schneidet. Links und oben sind die
              Werte negativ, rechts und unten positiv. Leere Felder zählen als 0.
            </p>
            <CrosshairHelp />
          </div>
          {awaitingTestSheet ? (
            <div className="space-y-3 rounded-lg border border-brand-100 bg-brand-50 p-4 text-sm text-brand-800">
              <p>
                <b>Die Ablesewerte sind verrechnet.</b> Dieselben Werte nicht noch einmal eintragen, sonst verdoppelt sich die
                Korrektur.
              </p>
              <p>Jetzt einen neuen Testbogen drucken. Sitzen beide Kreuze auf den Ecken, ist der Drucker fertig.</p>
              <div className="flex flex-wrap gap-3">
                <a href={testSheetUrl} target="_blank" rel="noreferrer" className="btn-primary">
                  Neuen Testbogen öffnen
                </a>
                <button type="button" className="btn-secondary" onClick={() => setReopenedFor(actionData)}>
                  Werte vom neuen Testbogen eintragen
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="rounded-lg bg-stone-50 p-3 text-sm text-stone-700">
                Die Werte müssen von einem Testbogen stammen, auf dem die <b>aktuelle Korrektur</b> steht (X {formatSigned(printer.offsetX)} mm, Y{" "}
                {formatSigned(printer.offsetY)} mm, {formatNumber(printer.scaleX * 100)} % / {formatNumber(printer.scaleY * 100)} %) und das
                Bogenformat <b>{format.name}</b>. Steht auf dem Bogen etwas anderes, zuerst einen neuen Testbogen drucken.
              </p>
              {/* key: nach jeder Änderung leeren, damit Werte nicht doppelt angewendet werden */}
              <Form method="post" className="space-y-4" key={`m-${calibrationKey(printer)}`}>
                <input type="hidden" name="intent" value="measure" />
                <input type="hidden" name="format" value={format.id} />
                <input type="hidden" name="basis" value={calibrationKey(printer)} />
                <fieldset className="grid grid-cols-2 gap-4">
                  <legend className="mb-2 text-sm font-semibold text-stone-800">Kreuz A (Etikett {format.ref.aIndex + 1})</legend>
                  <NumberField name="ax" label="X waagerecht" suffix="mm" error={errors.ax} />
                  <NumberField name="ay" label="Y senkrecht" suffix="mm" error={errors.ay} />
                </fieldset>
                <fieldset className="grid grid-cols-2 gap-4">
                  <legend className="mb-2 text-sm font-semibold text-stone-800">Kreuz B (Etikett {format.ref.bIndex + 1})</legend>
                  <NumberField name="bx" label="X waagerecht" suffix="mm" error={errors.bx} />
                  <NumberField name="by" label="Y senkrecht" suffix="mm" error={errors.by} />
                </fieldset>
                {errors.form ? <p className="field-error">{errors.form}</p> : null}
                <button className="btn-primary" disabled={busy}>
                  {busy && intent === "measure" ? "Rechnet …" : "Korrektur berechnen und speichern"}
                </button>
              </Form>
            </>
          )}
        </section>
      </div>

      <details className="card">
        <summary className="cursor-pointer font-semibold text-stone-800">Erweitert: Werte direkt bearbeiten oder zurücksetzen</summary>
        <Form method="post" className="mt-4 flex flex-wrap items-end gap-4" key={`${printer.offsetX}/${printer.offsetY}/${printer.scaleX}/${printer.scaleY}`}>
          <input type="hidden" name="intent" value="manual" />
          <NumberField name="offsetX" label="Verschiebung X" suffix="mm" defaultValue={formatNumber(printer.offsetX)} error={errors.offsetX} />
          <NumberField name="offsetY" label="Verschiebung Y" suffix="mm" defaultValue={formatNumber(printer.offsetY)} error={errors.offsetY} />
          <NumberField name="scaleX" label="Skalierung breit" suffix="%" defaultValue={formatNumber(printer.scaleX * 100, 3)} error={errors.scaleX} />
          <NumberField name="scaleY" label="Skalierung hoch" suffix="%" defaultValue={formatNumber(printer.scaleY * 100, 3)} error={errors.scaleY} />
          <button className="btn-secondary" disabled={busy}>
            Speichern
          </button>
        </Form>
        <Form method="post" className="mt-4" onSubmit={(e) => !confirm("Korrektur wirklich auf 0 zurücksetzen?") && e.preventDefault()}>
          <input type="hidden" name="intent" value="reset" />
          <button className="btn-danger" disabled={busy}>
            Korrektur zurücksetzen
          </button>
        </Form>
      </details>

      <section className="card space-y-4">
        <h2 className="font-display text-lg tracking-wide uppercase">Einstellungen</h2>
        <Form method="post" className="flex flex-wrap items-end gap-3" key={printer.name}>
          <input type="hidden" name="intent" value="rename" />
          <div className="min-w-48 flex-1">
            <label className="field-label" htmlFor="name">
              Name
            </label>
            <input id="name" name="name" defaultValue={printer.name} required maxLength={60} className="field-input" />
            {errors.name ? <p className="field-error">{errors.name}</p> : null}
          </div>
          <button className="btn-secondary" disabled={busy}>
            Umbenennen
          </button>
        </Form>
        <div className="flex flex-wrap gap-3 border-t border-stone-200 pt-4">
          {!printer.isDefault ? (
            <Form method="post">
              <input type="hidden" name="intent" value="default" />
              <button className="btn-secondary" disabled={busy}>
                Als Standard verwenden
              </button>
            </Form>
          ) : null}
          {printerCount > 1 && isAdmin ? (
            <Form method="post" onSubmit={(e) => !confirm(`Drucker „${printer.name}“ löschen?`) && e.preventDefault()}>
              <input type="hidden" name="intent" value="delete" />
              <button className="btn-danger" disabled={busy}>
                Drucker löschen
              </button>
            </Form>
          ) : null}
          {errors.delete ? <p className="field-error">{errors.delete}</p> : null}
        </div>
      </section>
    </div>
  );
}
