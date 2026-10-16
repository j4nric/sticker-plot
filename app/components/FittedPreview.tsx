import { useLayoutEffect, useRef, type ReactNode } from "react";
import { fitLabelText } from "~/label/fit-text";

/**
 * Zeigt Etikett oder Bogen in echter Größe (mm), optisch skaliert,
 * und passt die Schriftgrößen genauso an wie der PDF-Renderer.
 */
export function FittedPreview({
  widthMm,
  heightMm,
  scale,
  fitKey,
  onOverflow,
  children,
  className = "",
}: {
  widthMm: number;
  heightMm: number;
  scale: number;
  fitKey: string;
  onOverflow?: (count: number) => void;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onOverflowRef = useRef(onOverflow);
  onOverflowRef.current = onOverflow;

  useLayoutEffect(() => {
    let alive = true;
    const run = () => {
      if (alive && ref.current) onOverflowRef.current?.(fitLabelText(ref.current));
    };
    run();
    document.fonts.ready.then(run);
    document.fonts.addEventListener("loadingdone", run);
    return () => {
      alive = false;
      document.fonts.removeEventListener("loadingdone", run);
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
