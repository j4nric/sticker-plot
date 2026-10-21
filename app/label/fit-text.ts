/**
 * Verkleinert Texte, bis sie in ihr Feld passen.
 *
 * Elemente mit `data-fit` erhalten `data-fit-max` und `data-fit-min` in pt.
 * Die Größen liegen im 0,2-pt-Raster von max abwärts bis min; gesucht wird
 * die größte, bei der nichts überläuft. Binäre Suche statt Schritt für
 * Schritt: höchstens etwa 6 statt bis zu 30 Layout-Durchläufe je Feld.
 * Gibt die Anzahl der Felder zurück, die selbst in kleinster Schrift überlaufen.
 *
 * WICHTIG: Die Funktion muss in sich geschlossen bleiben (keine Importe,
 * keine äußeren Variablen), weil Playwright sie für das PDF als Quelltext
 * in den Browser überträgt.
 */
export function fitLabelText(root?: ParentNode | null): number {
  const scope: ParentNode = root ?? document;
  const nodes = scope.querySelectorAll<HTMLElement>("[data-fit]");
  let overflowing = 0;
  nodes.forEach((el) => {
    const max = parseFloat(el.dataset.fitMax ?? "8");
    const min = parseFloat(el.dataset.fitMin ?? "5");
    const steps = Math.max(0, Math.ceil((max - min) / 0.2 - 1e-9));
    const sizeAt = (k: number) => (k >= steps ? min : Math.max(min, Math.round((max - 0.2 * k) * 100) / 100));
    const overflowsAt = (k: number) => {
      el.style.fontSize = sizeAt(k) + "pt";
      return el.scrollHeight > el.clientHeight + 0.5 || el.scrollWidth > el.clientWidth + 0.5;
    };
    let best = 0;
    if (overflowsAt(0)) {
      // kleinste Stufe, bei der es passt; passt es auch bei min nicht, bleibt min
      let lo = 1;
      let hi = steps;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (overflowsAt(mid)) lo = mid + 1;
        else hi = mid;
      }
      best = lo;
    }
    if (overflowsAt(best)) {
      el.setAttribute("data-overflow", "");
      overflowing++;
    } else {
      el.removeAttribute("data-overflow");
    }
  });
  return overflowing;
}

/**
 * PDF: Jede unterschiedliche Etikettvariante steht nur einmal im Dokument
 * (`[data-label-id]` im Bereich `.tl-stage`) und wird nach dem Anpassen der
 * Schrift in alle Felder kopiert, die sie per `data-label-ref` anfordern.
 * Gibt die Anzahl überlaufender Felder über alle Etiketten zurück, oder null,
 * wenn das Dokument keine solchen Verweise nutzt.
 *
 * Wie oben: in sich geschlossen halten.
 */
export function expandLabelRefs(): number | null {
  const stage = document.querySelector(".tl-stage");
  if (!stage) return null;
  const sources = new Map<string, Element>();
  stage.querySelectorAll<HTMLElement>("[data-label-id]").forEach((el) => {
    sources.set(el.dataset.labelId ?? "", el);
  });
  let overflowing = 0;
  document.querySelectorAll<HTMLElement>("[data-label-ref]").forEach((slot) => {
    const src = sources.get(slot.dataset.labelRef ?? "");
    if (!src) return;
    const clone = src.cloneNode(true) as Element;
    overflowing += clone.querySelectorAll("[data-overflow]").length;
    slot.replaceWith(...Array.from(clone.childNodes));
  });
  stage.remove();
  return overflowing;
}
