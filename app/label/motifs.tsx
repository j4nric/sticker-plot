/** Motive für den oberen Etikettbereich. Alle Farben kommen aus CSS-Variablen der Sorte. */

export type MotifId = "tasse" | "kanne" | "kraeuter" | "fruechte" | "bild" | "keins";
export type MotifChoice = MotifId | "auto";

export const MOTIFS: Record<MotifChoice, string> = {
  auto: "Automatisch nach Teeart",
  tasse: "Teetasse",
  kanne: "Teekanne",
  kraeuter: "Kräuterzweig",
  fruechte: "Früchte",
  bild: "Eigenes Bild",
  keins: "Kein Motiv",
};

/** „auto“ wählt das Motiv anhand der Teeart. */
export function resolveMotif(choice: string, teaType: string, hasImage: boolean): MotifId {
  if (choice === "bild") return hasImage ? "bild" : "tasse";
  if (choice !== "auto" && choice in MOTIFS) return choice as MotifId;
  const t = teaType.toLowerCase();
  if (/kräuter|kraeuter|minze|kamille|ingwer|rooibos|honeybush/.test(t)) return t.includes("rooibos") ? "kanne" : "kraeuter";
  if (/frucht|früchte|fruechte|beere/.test(t)) return "fruechte";
  return "tasse";
}

/**
 * Punktring als fertiger Pfad. Eine Strichelung per stroke-dasharray zerlegt
 * Chromium im PDF in über tausend Kurvenstücke je Etikett; kurze Striche mit
 * runden Enden sehen gleich aus und bleiben schlank.
 */
const DOT_RING = (() => {
  const r = 41.5;
  const dots = 96;
  let d = "";
  for (let i = 0; i < dots; i++) {
    const a = (i / dots) * 2 * Math.PI - Math.PI / 2;
    d += `M${(60 + r * Math.cos(a)).toFixed(2)} ${(52 + r * Math.sin(a)).toFixed(2)}h.1`;
  }
  return d;
})();

function Backdrop() {
  return (
    <>
      <circle className="tl-c-bg" cx="60" cy="52" r="46" />
      <circle className="tl-c-ring" cx="60" cy="52" r="46" />
      <path className="tl-c-dots" d={DOT_RING} />
    </>
  );
}

function Leaf({ transform }: { transform: string }) {
  return (
    <g transform={transform}>
      <path className="tl-c-leaf" d="M0 12C1 4 8-1 18 0c-1 9-8 14-18 12Z" />
      <path className="tl-c-vein" d="M2 11C7 7 11 4 16 1.5" />
    </g>
  );
}

function Cup() {
  return (
    <>
      <path className="tl-c-steam" d="M50 36c-4-4 4-7 0-12s3-8 1-11" />
      <path className="tl-c-steam" d="M61 34c-4-5 5-8 0-14s4-8 2-12" />
      <path className="tl-c-steam" d="M72 36c-4-4 4-7 0-12s3-8 1-11" />
      <ellipse className="tl-c-dark" cx="60" cy="82" rx="40" ry="7.5" />
      <ellipse className="tl-c-mid" cx="60" cy="80.6" rx="30" ry="4.6" />
      <path className="tl-c-handle" d="M89 52c13-3 15 15-4 19" />
      <path className="tl-c-tea" d="M27 45h66c0 19-11 34-27 35H54C38 79 27 64 27 45Z" />
      <path className="tl-c-shine" d="M35 52c1 9 5 17 12 22" />
      <ellipse className="tl-c-dark" cx="60" cy="45" rx="33" ry="6" />
      <ellipse className="tl-c-liquor" cx="60" cy="45.6" rx="29" ry="4.2" />
      <Leaf transform="translate(51 54) rotate(-12)" />
    </>
  );
}

function Teapot() {
  return (
    <>
      <path className="tl-c-steam" d="M20 30c-3-4 3-6 0-10s2-6 1-9" />
      <ellipse className="tl-c-dark" cx="60" cy="85" rx="30" ry="4.5" />
      <path className="tl-c-spout" d="M34 60C23 59 19 49 14 40" />
      <path className="tl-c-handle" d="M87 47c16-3 17 26-2 27" />
      <path className="tl-c-tea" d="M28 56c0-16 14-22 32-22s32 6 32 22c0 17-12 28-32 28S28 73 28 56Z" />
      <path className="tl-c-dark" d="M39 40c3-7 11-10 21-10s18 3 21 10c-6 3-13 4-21 4s-15-1-21-4Z" />
      <circle className="tl-c-dark" cx="60" cy="27" r="4.5" />
      <path className="tl-c-band" d="M30 62c18 7 42 7 60 0" />
      <path className="tl-c-shine" d="M36 54c0 8 4 15 10 19" />
      <Leaf transform="translate(52 50) rotate(-12)" />
    </>
  );
}

function Herbs() {
  const leaves = [
    [70, "-38"],
    [58, "-42"],
    [46, "-46"],
    [34, "-52"],
  ] as const;
  return (
    <>
      <ellipse className="tl-c-mid" cx="60" cy="86" rx="22" ry="3.5" />
      <path className="tl-c-stem" d="M60 86C57 68 63 46 59 18" />
      {leaves.map(([y, r]) => (
        <g key={y}>
          <path className="tl-c-tea" transform={`translate(60.5 ${y}) rotate(${r})`} d="M0 0C7-8 21-8 28 0C21 8 7 8 0 0Z" />
          <path className="tl-c-tea" transform={`translate(59.5 ${y - 6}) scale(-1 1) rotate(${r})`} d="M0 0C7-8 21-8 28 0C21 8 7 8 0 0Z" />
        </g>
      ))}
      {leaves.map(([y, r]) => (
        <path key={`v${y}`} className="tl-c-vein-light" transform={`translate(60.5 ${y}) rotate(${r})`} d="M2 0H25" />
      ))}
      <path className="tl-c-tea" d="M59 18c-6-6-4-12 0-14 4 2 6 8 0 14Z" />
    </>
  );
}

function Fruits() {
  return (
    <>
      <ellipse className="tl-c-mid" cx="60" cy="86" rx="32" ry="4" />
      <circle className="tl-c-tea" cx="50" cy="60" r="23" />
      <circle className="tl-c-liquor" cx="50" cy="60" r="18.5" />
      {Array.from({ length: 8 }, (_, i) => (
        <path key={i} className="tl-c-segment" transform={`translate(50 60) rotate(${i * 45})`} d="M0 0L0 -18" />
      ))}
      <circle className="tl-c-tea" cx="50" cy="60" r="2.2" />
      <path className="tl-c-stem" d="M84 32c-2 6-6 10-10 12M84 32c2 8 6 12 8 14" />
      <circle className="tl-c-dark" cx="74" cy="50" r="9" />
      <circle className="tl-c-dark" cx="92" cy="54" r="8.5" />
      <circle className="tl-c-shine-dot" cx="71" cy="47" r="2.2" />
      <circle className="tl-c-shine-dot" cx="89.5" cy="51" r="2" />
      <path className="tl-c-tea" d="M84 32c6-6 14-6 18-2-5 5-12 6-18 2Z" />
    </>
  );
}

export function Motif({ id, imageSrc }: { id: MotifId; imageSrc?: string | null }) {
  if (id === "keins") return null;
  if (id === "bild" && imageSrc) {
    return <img className="tl-art-img" src={imageSrc} alt="" />;
  }
  return (
    <svg viewBox="0 0 120 100" aria-hidden="true">
      <Backdrop />
      {id === "kanne" ? <Teapot /> : id === "kraeuter" ? <Herbs /> : id === "fruechte" ? <Fruits /> : <Cup />}
    </svg>
  );
}
