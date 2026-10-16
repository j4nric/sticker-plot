import type { ReactNode } from "react";
import {
  calibrationStyle,
  DEFAULT_SHEET,
  labelsPerSheet,
  referencePoints,
  slotPosition,
  type Calibration,
  type Point,
  type SheetGeometry,
} from "./geometry";

const fmt = (v: number, digits = 2) => v.toLocaleString("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const signed = (v: number) => (v > 0 ? "+" : "") + fmt(v);

/** Fadenkreuz mit 1-mm-Skala. Einheiten im SVG = mm. */
function Crosshair({ at, name }: { at: Point; name: string }) {
  const arm = 9;
  const ticks: ReactNode[] = [];
  for (let i = -8; i <= 8; i++) {
    if (i === 0) continue;
    const len = i % 5 === 0 ? 1.8 : 0.9;
    ticks.push(<line key={`h${i}`} x1={at.x + i} y1={at.y} x2={at.x + i} y2={at.y - len} />);
    ticks.push(<line key={`v${i}`} x1={at.x} y1={at.y + i} x2={at.x - len} y2={at.y + i} />);
  }
  const num = (key: string, x: number, y: number, t: string) => (
    <text key={key} x={x} y={y} fontSize="1.7" textAnchor="middle" fill="#333" stroke="none" fontFamily="Source Serif 4, serif">
      {t}
    </text>
  );
  return (
    <g stroke="#000" strokeWidth="0.12" fill="none">
      <line x1={at.x - arm} y1={at.y} x2={at.x + arm} y2={at.y} />
      <line x1={at.x} y1={at.y - arm} x2={at.x} y2={at.y + arm} />
      {ticks}
      <circle cx={at.x} cy={at.y} r="0.5" />
      {num("p5", at.x + 5, at.y - 2.4, "+5")}
      {num("m5", at.x - 5, at.y - 2.4, "−5")}
      {num("vp5", at.x - 3.6, at.y + 5.6, "+5")}
      {num("vm5", at.x - 3.6, at.y - 4.4, "−5")}
      <circle cx={at.x + 5} cy={at.y + 5} r="2.4" fill="#000" stroke="none" />
      <text x={at.x + 5} y={at.y + 5.95} fontSize="2.8" textAnchor="middle" fill="#fff" stroke="none" fontFamily="Oswald, sans-serif" fontWeight="600">
        {name}
      </text>
    </g>
  );
}

/**
 * Randmarken: kurze Striche, die 1 bis 8 mm vom Papierrand beginnen.
 * Der erste vollständig gedruckte Strich zeigt den unbedruckbaren Rand.
 */
function MarginScale({ format }: { format: SheetGeometry }) {
  const W = format.pageWidth;
  const H = format.pageHeight;
  const items: ReactNode[] = [];
  for (let d = 1; d <= 8; d++) {
    const off = (d - 4.5) * 2.6;
    const cx = W / 2 + off;
    const cy = H / 2 + off;
    const t = (key: string, x: number, y: number) => (
      <text key={key} x={x} y={y} fontSize="1.7" textAnchor="middle" fill="#333" stroke="none" fontFamily="Source Serif 4, serif">
        {d}
      </text>
    );
    items.push(<line key={`t${d}`} x1={cx} y1={d} x2={cx} y2={d + 4} />, t(`tt${d}`, cx, d + 6.2));
    items.push(<line key={`b${d}`} x1={cx} y1={H - d} x2={cx} y2={H - d - 4} />, t(`bt${d}`, cx, H - d - 5));
    items.push(<line key={`l${d}`} x1={d} y1={cy} x2={d + 4} y2={cy} />, t(`lt${d}`, d + 5.6, cy + 0.6));
    items.push(<line key={`r${d}`} x1={W - d} y1={cy} x2={W - d - 4} y2={cy} />, t(`rt${d}`, W - d - 5.6, cy + 0.6));
  }
  return (
    <g stroke="#000" strokeWidth="0.25">
      {items}
    </g>
  );
}

export function TestSheetPage({
  calibration,
  printerName,
  createdAt,
  format = DEFAULT_SHEET,
  formatName = "Standard",
}: {
  calibration: Calibration;
  printerName: string;
  createdAt: Date;
  format?: SheetGeometry;
  formatName?: string;
}) {
  const { a, b, aIndex, bIndex } = referencePoints(format);
  const W = format.pageWidth;
  const H = format.pageHeight;
  const svgStyle = { width: `${W}mm`, height: `${H}mm` };
  const textWidth = Math.min(88, W - 24);
  return (
    <div className="tl-page" style={{ width: `${W}mm`, height: `${H}mm` }}>
      {/* Randmarken beziehen sich auf das Papier, nicht auf den kalibrierten Bogen */}
      <svg className="tt-svg" style={svgStyle} viewBox={`0 0 ${W} ${H}`}>
        <MarginScale format={format} />
      </svg>
      <div className="tl-sheet" style={calibrationStyle(calibration, format)}>
        {Array.from({ length: labelsPerSheet(format) }, (_, i) => {
          const p = slotPosition(i, format);
          return (
            <div key={i}>
              <div className="tt-outline" style={{ left: `${p.x}mm`, top: `${p.y}mm`, width: `${format.labelWidth}mm`, height: `${format.labelHeight}mm` }} />
              <div className="tt-num" style={{ left: `${p.x + 2.5}mm`, top: `${p.y + format.labelHeight - 7}mm` }}>
                {i + 1}
              </div>
            </div>
          );
        })}
        <svg className="tt-svg" style={svgStyle} viewBox={`0 0 ${W} ${H}`}>
          <Crosshair at={a} name="A" />
          <Crosshair at={b} name="B" />
        </svg>
        <div className="tt-text" style={{ left: `${(W - textWidth) / 2}mm`, top: `${Math.min(22, H * 0.1)}mm`, width: `${textWidth}mm` }}>
          <h1>Testbogen Druckerkalibrierung</h1>
          <p className="tt-meta">
            Drucker: {printerName} · Bogen: {formatName} · erstellt am {createdAt.toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}
            <br />
            Aktuelle Korrektur: X {signed(calibration.offsetX)} mm, Y {signed(calibration.offsetY)} mm, Skalierung{" "}
            {fmt(calibration.scaleX * 100)} % / {fmt(calibration.scaleY * 100)} %
          </p>
          <ol>
            <li>
              Dieses PDF in <b>tatsächlicher Größe (100 %)</b> auf einen leeren Etikettenbogen drucken, nicht „An Seite anpassen“. Den
              Bogen so einlegen wie beim normalen Etikettendruck.
            </li>
            <li>
              Kreuz <b>A</b> gehört zur oberen linken Ecke von Etikett {aIndex + 1}, Kreuz <b>B</b> zur oberen linken Ecke von
              Etikett {bIndex + 1}.
              Ablesen, bei welchem Strich die echte Etikettkante die waagerechte Skala (X) und die senkrechte Skala (Y) schneidet. Jeder
              Strich ist 1 mm.
            </li>
            <li>
              Links bzw. oberhalb der Kreuzmitte sind die Werte negativ (−), rechts bzw. unterhalb positiv (+). Liegt die Kante genau
              auf der Mitte, ist der Wert 0.
            </li>
            <li>Die vier Ablesewerte in der Web-Oberfläche beim Drucker eintragen und erneut testen, bis beide Kreuze auf den Ecken sitzen.</li>
          </ol>
          <p className="tt-meta">
            Randmarken an allen vier Papierkanten: Die Zahl am ersten vollständig gedruckten Strich ist der unbedruckbare Rand des
            Druckers in mm.
          </p>
        </div>
      </div>
    </div>
  );
}
