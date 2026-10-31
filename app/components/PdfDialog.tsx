import { useEffect, useRef, useState } from "react";

export interface PdfRequest {
  url: string;
  /** Dateiname beim Teilen/Speichern */
  fileName: string;
  /** echter Druck (wird gebucht) oder nur Vorschau */
  kind: "print" | "preview";
  /** Überschrift des Fensters, sonst je nach Art */
  title?: string;
}

type State =
  | { status: "loading" }
  | { status: "error"; message: string; canForce: boolean }
  | { status: "ready"; blobUrl: string; file: File };

/** iPad/iPhone: Drucken über das Teilen-Menü; am Computer über den Druckdialog. */
const prefersShare = () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

/**
 * Erzeugt das PDF in der App und zeigt es in einem Fenster an, statt einen
 * neuen Tab zu öffnen. In der installierten App (Home-Bildschirm) gäbe es
 * aus dem PDF-Betrachter keinen Weg zurück.
 */
export function PdfDialog({ request, onClose, onCreated }: { request: PdfRequest | null; onClose: () => void; onCreated?: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [state, setState] = useState<State>({ status: "loading" });
  const [force, setForce] = useState(false);
  const [hint, setHint] = useState("");

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (request && !d.open) d.showModal();
    if (!request && d.open) d.close();
  }, [request]);

  // PDF laden; „Trotzdem erstellen“ lädt mit trotzdem=1 erneut
  useEffect(() => {
    if (!request) return;
    let alive = true;
    let blobUrl = "";
    setState({ status: "loading" });
    setHint("");
    const url = force ? `${request.url}${request.url.includes("?") ? "&" : "?"}trotzdem=1` : request.url;
    fetch(url, { headers: { Accept: "application/json, application/pdf" } })
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { message?: string; canForce?: boolean } | null;
          throw Object.assign(new Error(body?.message ?? `Das PDF konnte nicht erstellt werden (Fehler ${res.status}).`), { canForce: Boolean(body?.canForce) });
        }
        const blob = await res.blob();
        if (!alive) return;
        blobUrl = URL.createObjectURL(blob);
        const name = res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? request.fileName;
        setState({ status: "ready", blobUrl, file: new File([blob], name, { type: "application/pdf" }) });
        if (request.kind === "print") onCreated?.();
      })
      .catch((e: Error & { canForce?: boolean }) => {
        if (alive) setState({ status: "error", message: e.message || "Verbindung unterbrochen. Bitte erneut versuchen.", canForce: Boolean(e.canForce) });
      });
    return () => {
      alive = false;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
    // onCreated bewusst nicht als Abhängigkeit: sonst würde bei jedem Rendern neu geladen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request, force]);

  const close = () => {
    setForce(false);
    onClose();
  };

  const print = async () => {
    if (state.status !== "ready") return;
    if (prefersShare() && navigator.canShare?.({ files: [state.file] })) {
      try {
        await navigator.share({ files: [state.file], title: state.file.name });
      } catch (e) {
        // Abbrechen im Teilen-Menü ist kein Fehler
        if ((e as Error).name !== "AbortError") setHint("Teilen nicht möglich. Bitte „PDF speichern“ nutzen und aus der Dateien-App drucken.");
      }
      return;
    }
    try {
      frameRef.current?.contentWindow?.focus();
      frameRef.current?.contentWindow?.print();
    } catch {
      window.open(state.blobUrl, "_blank");
    }
  };

  return (
    <dialog ref={ref} onClose={close} className="m-auto h-[92vh] w-[min(1200px,96vw)] rounded-2xl p-0 shadow-2xl backdrop:bg-black/50">
      {request ? (
        <div className="flex h-full flex-col">
          <div className="flex flex-wrap items-center gap-3 border-b border-stone-200 px-5 py-3">
            <span className="mr-auto text-lg font-semibold">{request.title ?? (request.kind === "preview" ? "Vorschau (wird nicht gebucht)" : "Etiketten drucken")}</span>
            {state.status === "ready" ? (
              <>
                <button type="button" className="btn-primary" onClick={print}>
                  Drucken
                </button>
                <a href={state.blobUrl} download={state.file.name} className="btn-secondary">
                  PDF speichern
                </a>
              </>
            ) : null}
            <button type="button" className="btn-secondary" onClick={close}>
              ‹ Zurück zur App
            </button>
          </div>
          {hint ? <p className="bg-amber-50 px-5 py-2 text-amber-900">{hint}</p> : null}
          {state.status === "loading" ? (
            <div className="flex flex-1 items-center justify-center text-lg text-stone-600">PDF wird erstellt …</div>
          ) : state.status === "error" ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
              <p className="max-w-xl text-lg text-stone-800">{state.message}</p>
              {state.canForce ? (
                <button type="button" className="btn-danger" onClick={() => setForce(true)}>
                  Trotzdem erstellen (Text wird abgeschnitten)
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <iframe ref={frameRef} title="PDF" src={state.blobUrl} className="w-full flex-1" />
              <p className="border-t border-stone-200 px-5 py-2 text-sm text-stone-600">
                {prefersShare()
                  ? "„Drucken“ öffnet das Teilen-Menü: dort „Drucken“ wählen. Danach geht es hier weiter."
                  : "Beim Drucken „Tatsächliche Größe“ bzw. 100 % wählen."}
              </p>
            </>
          )}
        </div>
      ) : null}
    </dialog>
  );
}
