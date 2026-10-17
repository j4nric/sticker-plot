import type { ReactNode } from "react";

const TONES = {
  success: "bg-brand-50 px-4 py-2 text-brand-800",
  warning: "border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900",
} as const;

/** Hinweis nach einer Aktion (grün) oder Warnung (gelb). */
export function Notice({ tone = "success", children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return (
    <p className={`rounded-lg ${TONES[tone]}`} role={tone === "warning" ? "alert" : "status"}>
      {children}
    </p>
  );
}
