import { useEffect, useState } from "react";
import type { SheetGeometry } from "~/label/geometry";

export interface PrinterOption {
  id: number;
  name: string;
  isDefault: boolean;
  nextSlot: number;
}
export type FormatOption = SheetGeometry & { id: number; name: string; isDefault: boolean };

const store = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // privater Modus o. Ä.: Merken ist nur Komfort
    }
  },
};

/** Drucker und Format für dieses Gerät merken und wiederherstellen. */
export function useDeviceChoice(printers: PrinterOption[], formats: FormatOption[]) {
  const def = (list: { id: number; isDefault: boolean }[]) => (list.find((x) => x.isDefault) ?? list[0])!.id;
  const [printerId, setPrinterId] = useState(def(printers));
  const [formatId, setFormatId] = useState(def(formats));
  useEffect(() => {
    const p = Number(store.get("tee.drucker"));
    if (printers.some((x) => x.id === p)) setPrinterId(p);
    const f = Number(store.get("tee.format"));
    if (formats.some((x) => x.id === f)) setFormatId(f);
  }, [printers, formats]);
  return {
    printerId,
    formatId,
    printer: printers.find((p) => p.id === printerId) ?? printers[0]!,
    format: formats.find((f) => f.id === formatId) ?? formats[0]!,
    choosePrinter(id: number) {
      setPrinterId(id);
      store.set("tee.drucker", String(id));
    },
    chooseFormat(id: number) {
      setFormatId(id);
      store.set("tee.format", String(id));
    },
  };
}
