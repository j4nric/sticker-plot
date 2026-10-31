import type { RefObject } from "react";
import { MARKUP } from "~/label/text";

type Field = HTMLTextAreaElement | HTMLInputElement;

const BUTTONS = [
  { style: "bold", label: "F", title: "Fett: Text markieren und klicken (*Wort*)", className: "font-bold" },
  { style: "underline", label: "U", title: "Unterstrichen: Text markieren und klicken (++Wort++)", className: "underline" },
  { style: "italic", label: "K", title: "Kursiv: Text markieren und klicken (_Wort_)", className: "italic" },
] as const;

/**
 * Knöpfe für Fett, Unterstrichen und Kursiv. Umschließt den markierten Text im
 * Feld mit den Formatierungszeichen; ohne Markierung werden sie an der
 * Schreibmarke eingefügt.
 */
export function FormatToolbar({ fieldRef, value, onChange }: { fieldRef: RefObject<Field | null>; value: string; onChange: (next: string) => void }) {
  const apply = (marker: string) => {
    const el = fieldRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    // Leerzeichen am Rand der Markierung bleiben außerhalb der Zeichen
    let a = start;
    let b = end;
    while (a < b && /\s/.test(value[a]!)) a++;
    while (b > a && /\s/.test(value[b - 1]!)) b--;
    const selected = value.slice(a, b);
    const next = value.slice(0, a) + marker + selected + marker + value.slice(b);
    onChange(next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const caret = selected ? b + marker.length * 2 : a + marker.length;
      el.setSelectionRange(selected ? a : caret, caret);
    });
  };
  return (
    <div className="mb-1 flex gap-1" role="toolbar" aria-label="Formatierung">
      {BUTTONS.map((b) => (
        <button
          key={b.style}
          type="button"
          title={b.title}
          aria-label={b.title}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => apply(MARKUP[b.style])}
          className={`btn-secondary size-12 p-0 text-lg ${b.className}`}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}
