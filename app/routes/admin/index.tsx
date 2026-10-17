import { Link } from "react-router";

export function meta() {
  return [{ title: "Verwaltung · Tee-Etiketten" }];
}

const items = [
  ["/verwaltung/import", "Import", "Alte Photoshop-PDFs per Texterkennung übernehmen, Tees als CSV importieren oder exportieren."],
  ["/verwaltung/vorlagen", "Vorlagen", "Gestaltung der Etiketten: Variante, Schriften, Größen und sichtbare Elemente."],
  ["/verwaltung/bogenformate", "Bogenformate", "Seitengröße und Raster der Etikettenbögen."],
  ["/verwaltung/einstellungen", "Einstellungen", "Shopname, Adresse, Bio-Kontrollstelle und Verhalten bei zu langem Text."],
  ["/verwaltung/benutzer", "Benutzer", "Zugänge für das Personal anlegen, Rollen und Passwörter verwalten."],
  ["/verwaltung/protokoll", "Protokoll", "Wer hat wann was geändert oder gedruckt."],
  ["/verwaltung/sicherung", "Sicherung", "Datenbank herunterladen oder eine Sicherung wiederherstellen."],
] as const;

export default function AdminIndex() {
  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl tracking-wide uppercase">Verwaltung</h1>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(([to, title, text]) => (
          <li key={to}>
            <Link to={to} className="card block h-full transition hover:border-brand-600 hover:shadow-md">
              <span className="font-display text-lg tracking-wide uppercase">{title}</span>
              <span className="mt-1 block text-sm text-stone-600">{text}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
