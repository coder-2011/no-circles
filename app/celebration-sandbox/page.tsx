"use client";

import { useEffect, useState } from "react";

const CELEBRATION_PARTICLES = [
  { left: "6%", delay: "0ms", duration: "1950ms", size: 7, color: "#34D399" },
  { left: "13%", delay: "140ms", duration: "2100ms", size: 8, color: "#22C55E" },
  { left: "21%", delay: "80ms", duration: "1880ms", size: 6, color: "#10B981" },
  { left: "29%", delay: "220ms", duration: "2240ms", size: 9, color: "#F59E0B" },
  { left: "37%", delay: "40ms", duration: "2000ms", size: 6, color: "#34D399" },
  { left: "45%", delay: "260ms", duration: "2180ms", size: 8, color: "#16A34A" },
  { left: "53%", delay: "100ms", duration: "2050ms", size: 7, color: "#2DD4BF" },
  { left: "61%", delay: "320ms", duration: "2320ms", size: 8, color: "#38BDF8" },
  { left: "69%", delay: "180ms", duration: "2020ms", size: 6, color: "#34D399" },
  { left: "77%", delay: "50ms", duration: "2140ms", size: 9, color: "#10B981" },
  { left: "85%", delay: "240ms", duration: "2200ms", size: 7, color: "#FBBF24" },
  { left: "93%", delay: "120ms", duration: "1930ms", size: 6, color: "#86EFAC" }
] as const;

const CELEBRATION_DURATION_MS = 3000;

export default function CelebrationSandboxPage() {
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    if (!showCelebration) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setShowCelebration(false);
    }, CELEBRATION_DURATION_MS);

    return () => window.clearTimeout(timeout);
  }, [showCelebration]);

  function triggerCelebration() {
    setShowCelebration(false);
    window.setTimeout(() => setShowCelebration(true), 0);
  }

  return (
    <main className="min-h-screen bg-[#F3ECD8] px-6 py-10 text-[#2D3426] md:px-10 md:py-12">
      <div className="relative mx-auto w-full max-w-4xl overflow-hidden rounded-3xl border border-[#C9BD9A] bg-[#FAF5E8] p-8 shadow-sm md:p-10">
        {showCelebration ? (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            {CELEBRATION_PARTICLES.map((particle, index) => (
              <span
                className="absolute top-[-18px] rounded-sm opacity-90"
                key={index}
                style={{
                  left: particle.left,
                  width: `${particle.size}px`,
                  height: `${particle.size * 1.4}px`,
                  backgroundColor: particle.color,
                  animationName: "onboarding-confetti-fall",
                  animationDuration: particle.duration,
                  animationDelay: particle.delay,
                  animationTimingFunction: "cubic-bezier(0.2, 0.72, 0.2, 1)",
                  animationFillMode: "forwards"
                }}
              />
            ))}
          </div>
        ) : null}

        <h1 className="text-3xl font-semibold tracking-tight text-[#2B3125] md:text-4xl">Celebration Sandbox</h1>
        <p className="mt-2 text-sm text-[#5A6650]">
          Temporary page to verify the exact onboarding save celebration in isolation.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <div className="relative flex items-center gap-2">
            <button
              className="rounded-lg bg-[#3D6F49] px-4 py-2 text-sm font-medium text-[#F3ECD8] transition hover:bg-[#315E3E]"
              onClick={triggerCelebration}
              type="button"
            >
              Random button A
            </button>
            <span
              className={`pointer-events-none absolute -bottom-7 left-0 inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 transition duration-300 ${
                showCelebration ? "translate-x-0 opacity-100" : "translate-x-1 opacity-0"
              }`}
            >
              <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Saved
            </span>
          </div>
          <button
            className="rounded-lg border border-[#B8AA84] px-4 py-2 text-sm font-medium text-[#40503A] transition hover:bg-[#EFE5CD]"
            onClick={triggerCelebration}
            type="button"
          >
            Random button B
          </button>
          <button
            className="rounded-lg border border-[#B8AA84] px-4 py-2 text-sm font-medium text-[#40503A] transition hover:bg-[#EFE5CD]"
            onClick={triggerCelebration}
            type="button"
          >
            Random button C
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes onboarding-confetti-fall {
          0% {
            transform: translate3d(0, -8px, 0) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 0.95;
          }
          100% {
            transform: translate3d(0, 105vh, 0) rotate(520deg);
            opacity: 0;
          }
        }
      `}</style>
    </main>
  );
}
