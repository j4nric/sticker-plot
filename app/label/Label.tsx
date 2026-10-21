import type { CSSProperties, ReactNode } from "react";
import { barcodeSvg, normalizeEan, qrSvg } from "./codes";
import { fillColor, inkColor, validColor } from "./color";
import { calibrationStyle, DEFAULT_SHEET, labelBox, NO_CALIBRATION, slotPosition, type Calibration, type SheetGeometry } from "./geometry";
import { Motif, resolveMotif } from "./motifs";
import { DEFAULT_TEMPLATE_PARAMS, FONTS, type TemplateParams } from "./template";
import { hyphenate, normalizeParagraphs, parseMarkup } from "./text";

/** Alles, was zu einer Sorte auf das Etikett kommt. */
export interface LabelContent {
  name: string;
  teaType: string;
  description: string;
  ingredients: string;
  color: string;
  motif?: string;
  /** URL oder data:-URL des eigenen Bildes */
  imageSrc?: string | null;
  brewAmount?: string;
  brewTemp?: number | null;
  brewTime?: string;
  organic?: boolean;
  ean?: string;
  productUrl?: string;
  price?: string;
}

/** Angaben, die pro Druckauftrag wechseln. */
export interface PrintExtras {
  netWeight?: string;
  bestBefore?: string;
  lot?: string;
}

export type FooterSeparator = "blatt" | "punkt" | "strich" | "keins";

export const FOOTER_SEPARATORS: Record<FooterSeparator, string> = {
  blatt: "Blatt",
  punkt: "Punkt ·",
  strich: "Strich |",
  keins: "kein Trenner",
};

/**
 * Fußzeile: Text links und rechts (mit Trenner dazwischen) und eine optionale
 * zweite Zeile. Alle Texte dürfen *fett*, _kursiv_ und ++unterstrichen++ enthalten.
 */
export interface ShopInfo {
  /** Fußzeile links, z. B. Shopname */
  name: string;
  /** Fußzeile rechts, z. B. Internetadresse */
  url: string;
  /** zweite Zeile, z. B. Anschrift */
  address?: string;
  organicCode?: string;
  separator?: FooterSeparator;
  /** Fußzeile kursiv (Standard) oder aufrecht */
  footerItalic?: boolean;
}

/** Grenzen für einzeilige Felder in pt (Titel und Text kommen aus der Vorlage). */
export const LINE_FIT = {
  type: { max: 6.4, min: 4.6 },
  brew: { max: 6, min: 4.6 },
  meta: { max: 5.6, min: 4.4 },
  footer: { max: 5.6, min: 4.2 },
} as const;

/** Text mit *fett*, _kursiv_ und ++unterstrichen++; optional mit Silbentrennung. */
export function RichText({ text, hyphens = false }: { text: string; hyphens?: boolean }) {
  return (
    <>
      {parseMarkup(text).map((seg, i) => {
        const content = hyphens ? hyphenate(seg.text) : seg.text;
        const cls = [seg.bold ? "tl-b" : "", seg.italic ? "tl-i" : "", seg.underline ? "tl-u" : ""].filter(Boolean).join(" ");
        return cls ? (
          <span key={i} className={cls}>
            {content}
          </span>
        ) : (
          <span key={i}>{content}</span>
        );
      })}
    </>
  );
}

function FooterSeparatorMark({ kind }: { kind: FooterSeparator }) {
  if (kind === "blatt") return <LeafIcon />;
  if (kind === "punkt") return <span className="tl-sep">·</span>;
  if (kind === "strich") return <span className="tl-sep">|</span>;
  return <span className="tl-sep-gap" />;
}

function LeafIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path className="tl-c-leaf" d="M20.5 3.5C11 3.6 4.6 8.2 4.2 15.6c-.1 1.6.3 3 1 4.2 1-3.6 3.5-6.7 7.3-8.9-3 2.6-5 5.6-5.8 9 1 .5 2.2.7 3.5.6 7.2-.6 10.9-7.4 10.3-17Z" />
    </svg>
  );
}

const icons = {
  amount: <path className="tl-i" d="M4 3.5c2 0 3 1.6 3 3.3S6 9.8 4 9.8 1 8.5 1 6.8s1-3.3 3-3.3ZM6.4 8.6 14.5 14" />,
  temp: <path className="tl-i" d="M8 2.2a1.6 1.6 0 0 1 1.6 1.6v6.1a3 3 0 1 1-3.2 0V3.8A1.6 1.6 0 0 1 8 2.2ZM8 7v5" />,
  time: <path className="tl-i" d="M4 2h8M4 14h8M5 2c0 4 6 4 6 6s-6 2-6 6M11 2c0 4-6 4-6 6s6 2 6 6" />,
};

function Fit({ max, min, className, children }: { max: number; min: number; className: string; children: ReactNode }) {
  return (
    <div className={className} data-fit="" data-fit-max={max} data-fit-min={min} style={{ fontSize: `${max}pt` }}>
      {children}
    </div>
  );
}

function fontClass(key: TemplateParams["titleFont"]) {
  return key === "oswald" ? "tl-oswald" : key === "playfair" ? "tl-playfair" : "tl-serif";
}

export function Label({
  data,
  shop,
  template = DEFAULT_TEMPLATE_PARAMS,
  size = DEFAULT_SHEET,
  extras,
}: {
  data: LabelContent;
  shop: ShopInfo;
  template?: TemplateParams;
  size?: Pick<SheetGeometry, "labelWidth" | "labelHeight">;
  extras?: PrintExtras;
}) {
  const t = template;
  const color = validColor(data.color);
  const box = labelBox(size);
  const motif = resolveMotif(data.motif ?? "auto", data.teaType, Boolean(data.imageSrc));
  const showArt = t.artHeight > 0 && motif !== "keins";
  const ean = data.ean ? normalizeEan(data.ean) : "";
  const showCodes = t.showCodes && Boolean(ean || data.productUrl || data.price);
  const brew = [
    data.brewAmount ? (["amount", data.brewAmount] as const) : null,
    data.brewTemp ? (["temp", `${data.brewTemp} °C`] as const) : null,
    data.brewTime ? (["time", data.brewTime] as const) : null,
  ].filter(Boolean) as (readonly ["amount" | "temp" | "time", string])[];
  const extrasLine = [extras?.netWeight, extras?.bestBefore ? `MHD ${extras.bestBefore}` : "", extras?.lot ? `Los ${extras.lot}` : ""]
    .filter(Boolean)
    .join(" · ");
  const description = hyphenate(normalizeParagraphs(data.description));
  const ingredients = normalizeParagraphs(data.ingredients).replace(/\n+/g, " ");

  const style = {
    "--tea": fillColor(color),
    "--tea-ink": inkColor(color),
    "--title-font": FONTS[t.titleFont].family,
    "--body-font": FONTS[t.bodyFont].family,
    "--art-h": `${t.artHeight}mm`,
    "--title-h": `${Math.max(8, Math.round(t.titleMax * 0.83 * 10) / 10)}mm`,
    width: `${box.innerWidth}mm`,
    height: `${box.innerHeight}mm`,
    transform: box.scale === 1 ? undefined : `scale(${box.scale})`,
  } as CSSProperties;

  return (
    <div className="tl-box" style={{ width: `${size.labelWidth}mm`, height: `${size.labelHeight}mm` }}>
      <div className={`tl-label tl-v-${t.variant}${t.titleUppercase ? " tl-upper" : ""}`} style={style} lang="de">
        <div className="tl-frame" />
        <div className="tl-content">
          {showArt ? (
            <div className="tl-art">
              <Motif id={motif} imageSrc={data.imageSrc} />
            </div>
          ) : (
            <div className="tl-art-none" />
          )}
          <Fit className={`tl-title ${fontClass(t.titleFont)}`} max={t.titleMax} min={t.titleMin}>
            <span>{hyphenate(data.name.trim() || "Teename", 9)}</span>
          </Fit>
          {t.showTeaType && data.teaType.trim() ? (
            <Fit className={`tl-line tl-type${data.teaType.trim().length > 20 ? " tl-wrap2" : ""}`} {...LINE_FIT.type}>
              {data.teaType.trim()}
            </Fit>
          ) : null}
          {t.showBrew && brew.length ? (
            <Fit className="tl-line tl-brew" {...LINE_FIT.brew}>
              {brew.map(([kind, text]) => (
                <span key={kind}>
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    {icons[kind]}
                  </svg>
                  {text}
                </span>
              ))}
            </Fit>
          ) : null}
          <Fit className="tl-body" max={t.bodyMax} min={t.bodyMin}>
            {description ? <p className="tl-desc">{description}</p> : null}
            {ingredients ? (
              <p className="tl-ingredients">
                <span className="tl-lead">Zutaten:</span> <RichText text={ingredients} hyphens />
              </p>
            ) : null}
          </Fit>
          {data.organic || extrasLine ? (
            <Fit className="tl-line tl-meta tl-wrap2" {...LINE_FIT.meta}>
              {data.organic ? <span className="tl-bio">BIO{shop.organicCode ? ` · ${shop.organicCode}` : ""}</span> : null}
              {data.organic && extrasLine ? " · " : null}
              {extrasLine}
            </Fit>
          ) : null}
          {showCodes ? (
            <div className="tl-codes">
              {ean ? <span className="tl-ean" dangerouslySetInnerHTML={{ __html: barcodeSvg(ean) }} /> : null}
              {data.productUrl ? <span className="tl-qr" dangerouslySetInnerHTML={{ __html: qrSvg(data.productUrl) }} /> : null}
              {data.price ? <span className="tl-price">{data.price}</span> : null}
            </div>
          ) : null}
          {t.showFooter && (shop.name || shop.url || shop.address) ? (
            <Fit className={`tl-line tl-footer${shop.footerItalic === false ? " tl-footer-upright" : ""}`} {...LINE_FIT.footer}>
              {shop.name || shop.url ? (
                <div className="tl-fline">
                  {shop.name ? (
                    <span>
                      <RichText text={shop.name} />
                    </span>
                  ) : null}
                  {shop.name && shop.url ? <FooterSeparatorMark kind={shop.separator ?? "blatt"} /> : null}
                  {shop.url ? (
                    <span>
                      <RichText text={shop.url} />
                    </span>
                  ) : null}
                </div>
              ) : null}
              {shop.address ? (
                <div className="tl-addr">
                  <RichText text={shop.address} />
                </div>
              ) : null}
            </Fit>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Ein Bogen; `slots` enthält einen Eintrag je Feld, null = Feld frei lassen. */
export function SheetPage({
  slots,
  calibration = NO_CALIBRATION,
  format = DEFAULT_SHEET,
}: {
  slots: (ReactNode | null)[];
  calibration?: Calibration;
  format?: SheetGeometry;
}) {
  return (
    <div className="tl-page" style={{ width: `${format.pageWidth}mm`, height: `${format.pageHeight}mm` }}>
      <div className="tl-sheet" style={calibrationStyle(calibration, format)}>
        {slots.map((content, i) => {
          if (content == null) return null;
          const p = slotPosition(i, format);
          return (
            <div key={i} className="tl-slot" style={{ left: `${p.x}mm`, top: `${p.y}mm`, width: `${format.labelWidth}mm`, height: `${format.labelHeight}mm` }}>
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
