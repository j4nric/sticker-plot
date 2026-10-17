import { useLayoutEffect, useRef, type ReactNode } from "react";
import { fitLabelText } from "~/label/fit-text";
import { formatCompact } from "~/lib/locale";

export interface FitReport {
  /** Felder, die selbst in kleinster Schrift überlaufen */
  overflow: number;
  /** gewählte Schriftgröße des Haupttextes im ersten Etikett (pt) */
  bodyPt: number | null;
  titlePt: number | null;
}

function readPt(root: HTMLElement, selector: string): number | null {
  const el = root.querySelector<HTMLElement>(selector);
  const v = el ? parseFloat(el.style.fontSize) : NaN;
  return Number.isFinite(v) ? v : null;
}

/**
 * Zeigt Etikett oder Bogen in echter Größe (mm), optisch skaliert,
 * und passt die Schriftgrößen genauso an wie der PDF-Renderer.
 */
export function FittedPreview({
  widthMm,
  heightMm,
  scale,
  fitKey,
  onFit,
  children,
  className = "",
}: {
  widthMm: number;
  heightMm: number;
  scale: number;
  fitKey: string;
  onFit?: (report: FitReport) => void;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onFitRef = useRef(onFit);
  onFitRef.current = onFit;
  const lastReport = useRef("");

  useLayoutEffect(() => {
    let alive = true;
    const run = () => {
      const el = ref.current;
      if (!alive || !el) return;
      const report: FitReport = { overflow: fitLabelText(el), bodyPt: readPt(el, ".tl-body"), titlePt: readPt(el, ".tl-title") };
      // nur bei Änderung melden, sonst rendert das Formular bei jedem Tastendruck erneut
      const key = JSON.stringify(report);
      if (key === lastReport.current) return;
      lastReport.current = key;
      onFitRef.current?.(report);
    };
    run();
    // Schriften noch nicht geladen: nach dem Laden erneut messen
    if (document.fonts.status !== "loaded") void document.fonts.ready.then(run);
    document.fonts.addEventListener("loadingdone", run);
    const imgs = Array.from(ref.current?.querySelectorAll("img") ?? []);
    imgs.forEach((img) => img.addEventListener("load", run));
    return () => {
      alive = false;
      document.fonts.removeEventListener("loadingdone", run);
      imgs.forEach((img) => img.removeEventListener("load", run));
    };
  }, [fitKey, scale]);

  return (
    <div className={`relative ${className}`} style={{ width: `calc(${widthMm}mm * ${scale})`, height: `calc(${heightMm}mm * ${scale})` }}>
      <div ref={ref} className="tl-preview absolute top-0 left-0 origin-top-left" style={{ transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}

/** Anzeige, wie viel Platz der Text noch hat. */
export function FitMeter({ report, min, max }: { report: FitReport | null; min: number; max: number }) {
  if (!report || report.bodyPt == null) return null;
  const pt = report.bodyPt;
  const ratio = max > min ? (pt - min) / (max - min) : 1;
  const state =
    report.overflow > 0
      ? { text: "Passt nicht – bitte kürzen", bar: "bg-red-600", width: 100 }
      : ratio >= 0.999
        ? { text: "Viel Platz", bar: "bg-brand-600", width: 35 }
        : ratio > 0.5
          ? { text: "Gut lesbar", bar: "bg-brand-600", width: 60 }
          : ratio > 0.15
            ? { text: "Etwas eng", bar: "bg-amber-500", width: 80 }
            : { text: "Sehr eng – kleinste Schrift", bar: "bg-amber-600", width: 95 };
  return (
    <div className="text-xs text-stone-600" aria-live="polite">
      <div className="mb-1 flex justify-between">
        <span>Platz auf dem Etikett: {state.text}</span>
        <span>Textgröße {formatCompact(pt, 1)} pt</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-stone-200">
        <div className={`h-full ${state.bar}`} style={{ width: `${state.width}%` }} />
      </div>
    </div>
  );
}
