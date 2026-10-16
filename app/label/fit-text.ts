/**
 * Verkleinert Texte, bis sie in ihr Feld passen.
 *
 * Elemente mit `data-fit` erhalten `data-fit-max` und `data-fit-min` in pt.
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
    const overflows = () => el.scrollHeight > el.clientHeight + 0.5 || el.scrollWidth > el.clientWidth + 0.5;
    let size = max;
    el.style.fontSize = size + "pt";
    while (overflows() && size > min) {
      size = Math.max(min, Math.round((size - 0.2) * 100) / 100);
      el.style.fontSize = size + "pt";
    }
    const over = overflows();
    if (over) {
      el.setAttribute("data-overflow", "");
      overflowing++;
    } else {
      el.removeAttribute("data-overflow");
    }
  });
  return overflowing;
}
