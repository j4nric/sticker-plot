import type { CSSProperties, ReactNode } from "react";
import { calibrationStyle, NO_CALIBRATION, SHEET, slotPosition, type Calibration } from "./geometry";

export interface LabelData {
  name: string;
  teaType: string;
  description: string;
  ingredients: string;
  color: string;
}

export interface ShopInfo {
  name: string;
  url: string;
}

/** Fit-Grenzen in pt; gilt für Vorschau und PDF gleichermaßen. */
export const FIT = {
  title: { max: 15, min: 8.5 },
  body: { max: 7.4, min: 5.2 },
} as const;

function LeafIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path className="tl-c-leaf" d="M20.5 3.5C11 3.6 4.6 8.2 4.2 15.6c-.1 1.6.3 3 1 4.2 1-3.6 3.5-6.7 7.3-8.9-3 2.6-5 5.6-5.8 9 1 .5 2.2.7 3.5.6 7.2-.6 10.9-7.4 10.3-17Z" />
    </svg>
  );
}

function TeaCup() {
  return (
    <svg viewBox="0 0 120 100" aria-hidden="true">
      <circle className="tl-c-bg" cx="60" cy="52" r="46" />
      <circle className="tl-c-ring" cx="60" cy="52" r="46" />
      <circle className="tl-c-dots" cx="60" cy="52" r="41.5" />
      {/* Dampf */}
      <path className="tl-c-steam" d="M50 36c-4-4 4-7 0-12s3-8 1-11" />
      <path className="tl-c-steam" d="M61 34c-4-5 5-8 0-14s4-8 2-12" />
      <path className="tl-c-steam" d="M72 36c-4-4 4-7 0-12s3-8 1-11" />
      {/* Untertasse */}
      <ellipse className="tl-c-dark" cx="60" cy="82" rx="40" ry="7.5" />
      <ellipse className="tl-c-mid" cx="60" cy="80.6" rx="30" ry="4.6" />
      {/* Henkel */}
      <path className="tl-c-handle" d="M89 52c13-3 15 15-4 19" />
      {/* Tasse */}
      <path className="tl-c-tea" d="M27 45h66c0 19-11 34-27 35H54C38 79 27 64 27 45Z" />
      <path className="tl-c-shine" d="M35 52c1 9 5 17 12 22" />
      <ellipse className="tl-c-dark" cx="60" cy="45" rx="33" ry="6" />
      <ellipse className="tl-c-liquor" cx="60" cy="45.6" rx="29" ry="4.2" />
      {/* Blatt auf der Tasse */}
      <g transform="translate(51 54) rotate(-12)">
        <path className="tl-c-leaf" d="M0 12C1 4 8-1 18 0c-1 9-8 14-18 12Z" />
        <path className="tl-c-vein" d="M2 11C7 7 11 4 16 1.5" />
      </g>
    </svg>
  );
}

export function Label({ data, shop }: { data: LabelData; shop: ShopInfo }) {
  const style = { "--tea": data.color } as CSSProperties;
  return (
    <div className="tl-label" style={style} lang="de">
      <div className="tl-frame" />
      <div className="tl-content">
        <div className="tl-art">
          <TeaCup />
        </div>
        <div className="tl-title" data-fit="" data-fit-max={FIT.title.max} data-fit-min={FIT.title.min}>
          <span>{data.name || "Teename"}</span>
        </div>
        {data.teaType ? <div className="tl-type">{data.teaType}</div> : null}
        <div className="tl-body" data-fit="" data-fit-max={FIT.body.max} data-fit-min={FIT.body.min}>
          {data.description ? <p className="tl-desc">{data.description}</p> : null}
          {data.ingredients ? (
            <p className="tl-ingredients">
              <b>Zutaten:</b> {data.ingredients}
            </p>
          ) : null}
        </div>
        <div className="tl-footer">
          <span>{shop.name}</span>
          <LeafIcon />
          <span>{shop.url}</span>
        </div>
      </div>
    </div>
  );
}

/** Ein A4-Bogen; `slots` enthält 12 Einträge, null = Feld frei lassen. */
export function SheetPage({ slots, calibration = NO_CALIBRATION }: { slots: (ReactNode | null)[]; calibration?: Calibration }) {
  return (
    <div className="tl-page">
      <div className="tl-sheet" style={calibrationStyle(calibration)}>
        {slots.map((content, i) => {
          if (content == null) return null;
          const p = slotPosition(i);
          return (
            <div key={i} className="tl-slot" style={{ left: `${p.x}mm`, top: `${p.y}mm` }}>
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { SHEET };
