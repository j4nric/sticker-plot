import { useRef, useState } from "react";
import { useRevalidator } from "react-router";

/** Lädt alte Etiketten-PDFs einzeln hoch; die Erkennung läuft danach im Hintergrund. */
export function PdfUploader() {
  const [progress, setProgress] = useState<{ done: number; total: number; errors: string[] } | null>(null);
  const revalidator = useRevalidator();
  const input = useRef<HTMLInputElement>(null);

  async function upload(files: FileList) {
    const list = Array.from(files).filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    const errors: string[] = [];
    setProgress({ done: 0, total: list.length, errors });
    for (let i = 0; i < list.length; i++) {
      const body = new FormData();
      body.set("pdf", list[i]!);
      try {
        const res = await fetch("/verwaltung/import/status", { method: "POST", body });
        if (!res.ok) errors.push(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? `${list[i]!.name}: Fehler ${res.status}`);
      } catch {
        errors.push(`${list[i]!.name}: Verbindung unterbrochen`);
      }
      setProgress({ done: i + 1, total: list.length, errors: [...errors] });
      if (i % 5 === 4) revalidator.revalidate();
    }
    if (input.current) input.current.value = "";
    revalidator.revalidate();
  }

  return (
    <section className="card space-y-3">
      <h2 className="font-display text-lg tracking-wide uppercase">Alte Etiketten (PDF) übernehmen</h2>
      <p className="text-sm text-stone-700">
        PDFs aus Photoshop auswählen, gern alle auf einmal. Die App liest auf dem ersten Etikett jedes Bogens Name, Teeart, Beschreibung und Tassenfarbe per
        Texterkennung. Danach erscheinen die Ergebnisse unten zur Prüfung. Pro Datei dauert das einige Sekunden.
      </p>
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="text-sm"
        onChange={(e) => e.target.files?.length && upload(e.target.files)}
        disabled={Boolean(progress && progress.done < progress.total)}
        aria-label="PDF-Dateien auswählen"
      />
      {progress ? (
        <div className="space-y-1 text-sm">
          <p>
            {progress.done} von {progress.total} Dateien hochgeladen
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-stone-200">
            <div className="h-full bg-brand-600" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
          </div>
          {progress.errors.map((e) => (
            <p key={e} className="field-error">
              {e}
            </p>
          ))}
        </div>
      ) : null}
      <p className="field-hint">
        Für sehr viele Dateien gibt es zusätzlich ein Kommandozeilen-Werkzeug auf dem Server, siehe Dokumentation „Import“.
      </p>
    </section>
  );
}
