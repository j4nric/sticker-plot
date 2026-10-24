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

const defaultId = (list: { id: number; isDefault: boolean }[]) => (list.find((x) => x.isDefault) ?? list[0])!.id;

/**
 * Bogenformat für dieses Gerät merken. Etikettendruck, Testbogen und
 * Kalibrierung nutzen dieselbe Auswahl, damit nicht versehentlich mit einem
 * anderen Format gemessen als gedruckt wird.
 */
export function useRememberedFormat<T extends { id: number; isDefault: boolean }>(formats: T[]) {
  const [formatId, setFormatId] = useState(defaultId(formats));
  useEffect(() => {
    const f = Number(store.get("tee.format"));
    if (formats.some((x) => x.id === f)) setFormatId(f);
  }, [formats]);
  return {
    formatId,
    format: formats.find((f) => f.id === formatId) ?? formats[0]!,
    chooseFormat(id: number) {
      setFormatId(id);
      store.set("tee.format", String(id));
    },
  };
}

/** Drucker und Format für dieses Gerät merken und wiederherstellen. */
export function useDeviceChoice(printers: PrinterOption[], formats: FormatOption[]) {
  const [printerId, setPrinterId] = useState(defaultId(printers));
  const formatChoice = useRememberedFormat(formats);
  useEffect(() => {
    const p = Number(store.get("tee.drucker"));
    if (printers.some((x) => x.id === p)) setPrinterId(p);
  }, [printers]);
  return {
    ...formatChoice,
    printerId,
    printer: printers.find((p) => p.id === printerId) ?? printers[0]!,
    choosePrinter(id: number) {
      setPrinterId(id);
      store.set("tee.drucker", String(id));
    },
  };
}
