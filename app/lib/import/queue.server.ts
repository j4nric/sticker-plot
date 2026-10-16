import { saveImage } from "~/models/image.server";
import { getImportItem, nextQueued, requeueStale, setItemStatus } from "~/models/import.server";
import { extractFromPdf } from "./ocr.server";

const state = globalThis as unknown as { __importRunning?: Promise<void>; __importRequeued?: boolean };

/** Verarbeitet eine einzelne Importdatei (auch vom Kommandozeilen-Werkzeug genutzt). */
export async function processItem(id: number) {
  const item = getImportItem(id);
  if (!item?.source) {
    setItemStatus(id, { status: "error", error: "Datei fehlt" });
    return;
  }
  setItemStatus(id, { status: "processing" });
  try {
    const { result, preview } = await extractFromPdf(item.source, item.fileName);
    const previewImageId = saveImage("image/png", preview);
    setItemStatus(id, { status: "done", result: JSON.stringify(result), previewImageId, error: "", clearSource: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    setItemStatus(id, { status: "error", error: `Konnte nicht gelesen werden: ${message}`.slice(0, 400) });
  }
}

/** Startet die Hintergrundverarbeitung, falls sie nicht schon läuft. */
export function kickQueue(): Promise<void> {
  if (!state.__importRequeued) {
    requeueStale();
    state.__importRequeued = true;
  }
  if (!state.__importRunning) {
    state.__importRunning = (async () => {
      // erst nach der Zuweisung oben weiterlaufen, sonst setzt „finally“ das Kennzeichen zu früh zurück
      await Promise.resolve();
      try {
        for (let item = nextQueued(); item; item = nextQueued()) await processItem(item.id);
      } catch (e) {
        console.error("Import-Warteschlange:", e);
      } finally {
        state.__importRunning = undefined;
      }
    })();
  }
  return state.__importRunning;
}
