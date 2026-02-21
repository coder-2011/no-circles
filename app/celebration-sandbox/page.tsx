"use client";

import { useEffect, useState } from "react";

const CELEBRATION_PARTICLES = [
  { left: "4%", delay: "0ms", duration: "2680ms", size: 9, drift: "-30px", color: "#34D399" },
  { left: "9%", delay: "120ms", duration: "2820ms", size: 10, drift: "24px", color: "#22C55E" },
  { left: "14%", delay: "260ms", duration: "2920ms", size: 9, drift: "-22px", color: "#10B981" },
  { left: "20%", delay: "80ms", duration: "2740ms", size: 11, drift: "28px", color: "#14B8A6" },
  { left: "27%", delay: "210ms", duration: "3000ms", size: 10, drift: "-26px", color: "#38BDF8" },
  { left: "33%", delay: "50ms", duration: "2700ms", size: 9, drift: "20px", color: "#60A5FA" },
  { left: "39%", delay: "300ms", duration: "3060ms", size: 11, drift: "-24px", color: "#A78BFA" },
  { left: "45%", delay: "160ms", duration: "2860ms", size: 10, drift: "30px", color: "#F472B6" },
  { left: "51%", delay: "20ms", duration: "2760ms", size: 9, drift: "-20px", color: "#FB7185" },
  { left: "57%", delay: "240ms", duration: "3020ms", size: 11, drift: "26px", color: "#F97316" },
  { left: "63%", delay: "100ms", duration: "2840ms", size: 10, drift: "-28px", color: "#F59E0B" },
  { left: "69%", delay: "340ms", duration: "3100ms", size: 11, drift: "22px", color: "#FBBF24" },
  { left: "75%", delay: "70ms", duration: "2780ms", size: 9, drift: "-24px", color: "#84CC16" },
  { left: "81%", delay: "280ms", duration: "2980ms", size: 10, drift: "18px", color: "#4ADE80" },
  { left: "86%", delay: "140ms", duration: "2880ms", size: 9, drift: "-18px", color: "#2DD4BF" },
  { left: "90%", delay: "320ms", duration: "3040ms", size: 11, drift: "32px", color: "#22D3EE" },
  { left: "94%", delay: "190ms", duration: "2940ms", size: 10, drift: "-30px", color: "#E879F9" },
  { left: "97%", delay: "30ms", duration: "2720ms", size: 9, drift: "16px", color: "#86EFAC" }
] as const;

const CELEBRATION_DURATION_MS = 3400;

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
                  animationFillMode: "forwards",
                  "--confetti-drift-x": particle.drift
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
            transform: translate3d(calc(var(--confetti-drift-x, 0px) * -0.2), -16px, 0) rotate(0deg) scale(1.08);
            opacity: 0;
          }
          10% {
            opacity: 0.95;
          }
          100% {
            transform: translate3d(var(--confetti-drift-x, 0px), 112vh, 0) rotate(640deg) scale(0.96);
            opacity: 0;
          }
        }
      `}</style>
    </main>
  );
}
