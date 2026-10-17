import { useEffect, useRef } from "react";

/** Zeigt ein PDF in der Seite an (Browser-eigener PDF-Betrachter). */
export function PdfDialog({ url, onClose }: { url: string | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (url && !d.open) d.showModal();
    if (!url && d.open) d.close();
  }, [url]);
  return (
    <dialog ref={ref} onClose={onClose} className="m-auto h-[90vh] w-[min(1100px,95vw)] rounded-xl p-0 shadow-2xl backdrop:bg-black/50">
      {url ? (
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-4 py-2">
            <span className="font-semibold">PDF-Vorschau</span>
            <div className="flex gap-2">
              <a href={url} target="_blank" rel="noreferrer" className="btn-secondary px-3 py-1">
                In neuem Tab öffnen
              </a>
              <button type="button" className="btn-primary px-3 py-1" onClick={onClose}>
                Schließen
              </button>
            </div>
          </div>
          <iframe title="PDF-Vorschau" src={url} className="w-full flex-1" />
        </div>
      ) : null}
    </dialog>
  );
}
