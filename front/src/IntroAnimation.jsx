import { useEffect, useState } from "react";
import { useLanguage } from "./i18n";

export default function IntroAnimation({ onDone }) {
  const { t } = useLanguage();
  const [phase, setPhase] = useState("spinner");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("spinnerOut"), 2200);
    const t2 = setTimeout(() => setPhase("dot"),        2420);
    const t3 = setTimeout(() => setPhase("verdict"),    2640);
    const t4 = setTimeout(() => setPhase("verdictPop"), 2700);
    const t5 = setTimeout(() => setPhase("slide"),      3600);
    const t6 = setTimeout(() => { setPhase("done"); onDone?.(); }, 4250);
    return () => [t1, t2, t3, t4, t5, t6].forEach(clearTimeout);
  }, [onDone]);

  if (phase === "done") return null;

  const isSlide   = phase === "slide";
  const isPop     = phase === "verdictPop" || isSlide;
  const isVerdict = phase === "verdict" || isPop;

  return (
    <>
      <style>{`
        @keyframes _v_spin { to { transform: rotate(360deg); } }
        ._v_spinner {
          width: 44px; height: 44px;
          border: 3px solid rgba(255,255,255,0.12);
          border-top-color: #fff;
          border-radius: 50%;
          animation: _v_spin 0.9s linear infinite;
        }
      `}</style>

      <div style={{
        position: "fixed", inset: 0,
        background: "#111",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 9999, overflow: "hidden", pointerEvents: "none",
      }}>

        {/* Spinner */}
        <div style={{
          position: "absolute",
          transition: "transform 0.3s ease-in, opacity 0.25s ease-in",
          transform: phase === "spinnerOut" ? "scale(0.12)" : "scale(1)",
          opacity: phase === "spinner" ? 1 : 0,
        }}>
          <div className="_v_spinner" />
        </div>

        {/* Dot */}
        <div style={{
          position: "absolute",
          width: 6, height: 6,
          borderRadius: "50%",
          background: "#fff",
          transition: "transform 0.25s cubic-bezier(0.34,1.56,0.64,1), opacity 0.18s ease-in",
          transform: phase === "dot" ? "scale(1)" : "scale(0)",
          opacity: phase === "dot" ? 1 : 0,
        }} />

        {/* VERDICT — expands from center, then slides top-left */}
        {isVerdict && (
          <div style={{
            position: "absolute",
            left: isSlide ? 34 : "50%",
            top:  isSlide ? 18 : "50%",
            transform: isSlide
              ? "translate(0, 0)"
              : isPop
                ? "translate(-50%, -50%) scale(1)"
                : "translate(-50%, -50%) scale(1.25)",
            transition: isSlide
              ? "left 0.55s cubic-bezier(0.65,0,0.35,1), top 0.55s cubic-bezier(0.65,0,0.35,1), transform 0.55s cubic-bezier(0.65,0,0.35,1)"
              : "transform 0.18s cubic-bezier(0.34,1.4,0.64,1), opacity 0.18s ease-out",
            opacity: 1,
            display: "flex", flexDirection: "column", alignItems: "flex-start",
            whiteSpace: "nowrap",
          }}>
            {/* Glow */}
            <div style={{
              position: "absolute",
              inset: "-40px -60px",
              background: "radial-gradient(ellipse at center, rgba(255,59,59,0.25) 0%, rgba(255,255,255,0.06) 45%, transparent 70%)",
              filter: "blur(18px)",
              pointerEvents: "none",
              opacity: isSlide ? 0 : 1,
              transition: "opacity 0.4s ease",
            }} />
            <span style={{ fontSize: 25, fontWeight: 800, color: "#f2f2f2", lineHeight: 1, position: "relative" }}>
              VERDICT
            </span>
            <span style={{ marginTop: 10, color: "#9a9a9f", fontSize: 13, position: "relative" }}>
              {t("brandTagline")}
            </span>
          </div>
        )}
      </div>
    </>
  );
}
