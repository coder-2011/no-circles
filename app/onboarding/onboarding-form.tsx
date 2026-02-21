"use client";

import Link from "next/link";
import { BRAIN_DUMP_WORD_LIMIT } from "@/app/onboarding/onboarding-config";
import type { OnboardingController } from "@/app/onboarding/use-onboarding-controller";

type OnboardingFormProps = {
  controller: OnboardingController;
};

const BRAIN_DUMP_ALLOWED_KEYS = new Set([
  "Backspace",
  "Delete",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "Tab",
  "Escape"
]);
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

export function OnboardingForm({ controller }: OnboardingFormProps) {
  const meterBars = controller.dictationLevels;
  const isWarming = controller.dictationState === "warming";
  const isRecording = controller.dictationState === "recording";

  return (
    <main className="min-h-screen bg-[#F3ECD8] px-6 py-10 text-[#2D3426] md:px-10 md:py-12">
      <div className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-3xl border border-[#C9BD9A] bg-[#FAF5E8] p-8 shadow-sm md:p-10">
        {controller.showCelebration ? (
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
        <p className="text-sm uppercase tracking-[0.18em] text-[#6B775D]">Onboarding</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[#2B3125] md:text-5xl">What are you curious about?</h1>
        <p className="mt-3 text-base leading-7 text-[#4B5943]">
          Drop requests, rabbit holes, and the topics you have not had the courage to learn yet.
        </p>

        <div className="mt-6 rounded-lg border border-[#D8CCAA] bg-[#F4EEDC] px-4 py-3 text-base">
          <span className="font-medium text-[#3E4A36]">Session:</span>{" "}
          <span className="text-[#5A6650]">
            {controller.authState === "loading" && "Checking..."}
            {controller.authState === "signed_in" && `Signed in as ${controller.email}`}
            {controller.authState === "signed_out" && "Signed out. Redirecting..."}
            {controller.authState === "error" && "Unavailable"}
          </span>
        </div>

        {controller.authState === "signed_out" ? (
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              className="rounded-lg bg-[#3D6F49] px-4 py-2 text-sm font-medium text-[#F3ECD8] transition hover:bg-[#315E3E]"
              onClick={controller.signInWithGoogle}
              type="button"
            >
              Sign in again
            </button>
            <Link
              className="rounded-lg border border-[#B8AA84] px-4 py-2 text-sm font-medium text-[#40503A] transition hover:bg-[#EFE5CD]"
              href="/"
            >
              Back to home
            </Link>
          </div>
        ) : null}

        {controller.authState === "signed_in" ? (
          <form className="mt-8 space-y-6" onSubmit={controller.submitOnboarding}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-base font-medium text-[#3E4A36]">Timezone</span>
                <select
                  className="w-full rounded-lg border border-[#C7BA95] bg-[#FFFDF8] px-3 py-3 text-base focus:border-[#3D6F49] focus:outline-none"
                  onChange={(event) => controller.setTimezone(event.target.value)}
                  required
                  value={controller.timezone}
                >
                  {controller.timezoneOptions.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-base font-medium text-[#3E4A36]">Send time (local)</span>
                <div className="rounded-lg border border-[#C7BA95] bg-[#FFFDF8] p-2">
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      className="rounded-md border border-[#D7CCAE] bg-[#FFFDF8] px-2 py-2.5 text-base focus:border-[#3D6F49] focus:outline-none"
                      onChange={(event) => controller.setSendHour12(event.target.value)}
                      value={controller.sendHour12}
                    >
                      {Array.from({ length: 12 }, (_, index) => String(index + 1)).map((hour) => (
                        <option key={hour} value={hour}>
                          {hour}
                        </option>
                      ))}
                    </select>
                    <select
                      className="rounded-md border border-[#D7CCAE] bg-[#FFFDF8] px-2 py-2.5 text-base focus:border-[#3D6F49] focus:outline-none"
                      onChange={(event) => controller.setSendMinute(event.target.value)}
                      value={controller.sendMinute}
                    >
                      {Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, "0")).map((minute) => (
                        <option key={minute} value={minute}>
                          {minute}
                        </option>
                      ))}
                    </select>
                    <select
                      className="rounded-md border border-[#D7CCAE] bg-[#FFFDF8] px-2 py-2.5 text-base focus:border-[#3D6F49] focus:outline-none"
                      onChange={(event) => controller.setSendMeridiem(event.target.value as "AM" | "PM")}
                      value={controller.sendMeridiem}
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                  <span className="mt-2 block text-sm text-[#6B775D]">Your local delivery time.</span>
                </div>
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-base font-medium text-[#3E4A36]">Interest brain dump</span>
              <p className="mb-2 text-base leading-7 text-[#5E6B54]">
                This is your raw preference input. Mention what you want more of, less of, and what kind of insight is useful to you.
              </p>
              <textarea
                autoFocus
                className="h-56 w-full rounded-lg border border-[#C7BA95] bg-[#FFFDF8] px-4 py-3 text-base leading-7 focus:border-[#3D6F49] focus:outline-none"
                onChange={(event) => controller.setBrainDumpText(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                    return;
                  }

                  if (controller.brainDumpWordCount < BRAIN_DUMP_WORD_LIMIT) {
                    return;
                  }

                  if (event.metaKey || event.ctrlKey || event.altKey || BRAIN_DUMP_ALLOWED_KEYS.has(event.key)) {
                    return;
                  }

                  event.preventDefault();
                }}
                placeholder=""
                required
                value={controller.brainDumpText}
              />
              <div className="mt-3 flex items-start justify-between gap-3">
                <div className="flex items-end gap-3 pb-2">
                  <button
                    className="rounded-md border border-[#B8AA84] bg-[#FFF8E8] px-3 py-1.5 text-xs font-medium text-[#3F4E38] transition hover:bg-[#F2E7CC] disabled:opacity-50"
                    disabled={controller.dictationState === "warming" || controller.dictationState === "stopping"}
                    onClick={() => {
                      if (controller.dictationState === "recording") {
                        void controller.stopDictation();
                        return;
                      }

                      void controller.startDictation();
                    }}
                    type="button"
                  >
                    {controller.dictationState === "recording" ? "Stop dictation" : "Dictate"}
                  </button>
                  <div
                    aria-hidden="true"
                    className={`flex h-7 items-end gap-0.5 rounded-md border px-2 py-1 transition ${
                      isRecording
                        ? "border-emerald-300 bg-emerald-50"
                        : isWarming
                          ? "border-amber-300 bg-amber-50/70"
                          : "border-[#D7CCAE] bg-[#FFF8E8]"
                    }`}
                  >
                    {meterBars.map((level, index) => {
                      const effectiveLevel = Math.min(
                        1,
                        Math.max(0, isRecording ? level : isWarming ? 0.18 : 0)
                      );
                      const height = Math.max(2, Math.round(2 + effectiveLevel * 16));
                      return (
                        <span
                          className={`w-1 rounded-full transition-all duration-75 ${
                            isRecording ? "bg-emerald-500" : isWarming ? "bg-amber-500" : "bg-[#B8AA84]"
                          }`}
                          key={index}
                          style={
                            isWarming
                              ? {
                                  height: `${height}px`,
                                  animationName: "dictation-meter-boot",
                                  animationDuration: "900ms",
                                  animationTimingFunction: "ease-in-out",
                                  animationIterationCount: "infinite",
                                  animationDelay: `${index * 55}ms`
                                }
                              : { height: `${height}px` }
                          }
                        />
                      );
                    })}
                  </div>
                </div>
                <span
                  className={`rounded bg-[#FFF8E8] px-2 py-1 text-xs ${
                    controller.brainDumpWordCount >= BRAIN_DUMP_WORD_LIMIT ? "text-rose-700" : "text-[#6B775D]"
                  }`}
                >
                  {controller.brainDumpWordCount}/{BRAIN_DUMP_WORD_LIMIT} words
                </span>
              </div>
              <div className="mt-2">
                <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#5F6E54]">Quick Sparks</p>
                <p className="mt-1 text-sm text-[#6B775D]">
                  Popular starter interests. Tap any Quick Spark to add it to your brain dump.
                </p>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  className="rounded-md border border-[#CDBF98] bg-[#F6EFD9] px-3 py-1.5 text-xs font-semibold text-[#4F5D45] transition hover:bg-[#ECE2C8]"
                  onClick={controller.toggleQuickSparksExpanded}
                  type="button"
                >
                  {controller.quickSparksExpanded ? "Hide" : "More"}
                </button>
                <button
                  aria-label="Refresh quick sparks"
                  className="group inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#CDBF98] bg-[#F6EFD9] text-[#4F5D45] transition hover:bg-[#ECE2C8]"
                  onClick={controller.refreshQuickSparks}
                  type="button"
                >
                  <svg
                    aria-hidden="true"
                    className="h-5 w-5 transition-transform duration-200 group-hover:rotate-180"
                    fill="none"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M20 12a8 8 0 1 1-2.34-5.66M20 4v6h-6"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                  </svg>
                </button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2.5">
                {controller.quickSparks.map((spark) => (
                  <button
                    className="rounded-full border border-[#CDBF98] bg-[#F6EFD9] px-3.5 py-1.5 text-sm font-medium text-[#4F5D45] transition hover:bg-[#ECE2C8]"
                    key={spark}
                    onClick={() => controller.appendQuickSpark(spark)}
                    type="button"
                  >
                    {spark}
                  </button>
                ))}
              </div>
              {controller.quickSparksExpanded ? (
                <div className="mt-2 max-h-32 overflow-y-auto rounded-lg border border-[#D7CCAE] bg-[#FFF8E8] p-2">
                  <div className="flex flex-wrap gap-2">
                    {controller.quickSparksDrawer.map((spark) => (
                      <button
                        className="rounded-full border border-[#CDBF98] bg-[#F6EFD9] px-3 py-1.5 text-xs font-medium text-[#4F5D45] transition hover:bg-[#ECE2C8]"
                        key={spark}
                        onClick={() => controller.appendQuickSpark(spark)}
                        type="button"
                      >
                        {spark}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <span className="mt-1 block text-xs text-[#6B775D]">
                {controller.dictationState === "warming" && "Preparing microphone..."}
                {controller.dictationState === "recording" && "Listening..."}
                {controller.dictationState === "stopping" && "Finishing transcript..."}
              </span>
              {controller.dictationError ? (
                <span className="mt-2 block text-xs text-rose-700">{controller.dictationError}</span>
              ) : null}
            </label>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex items-center gap-2">
                  <button
                    className="rounded-lg bg-[#3D6F49] px-4 py-2 text-sm font-medium text-[#F3ECD8] transition hover:bg-[#315E3E] disabled:opacity-50"
                    disabled={controller.submitState === "saving"}
                    type="submit"
                  >
                    {controller.submitState === "saving" ? (
                      "Saving..."
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <span>Save preferences</span>
                        <span className="inline-flex items-center gap-1 rounded-md border border-[#7FAF8A] bg-[#2F5C3A] px-1.5 py-0.5 text-[10px] font-semibold text-[#E7F2DF]">
                          <span>⌘</span>
                          <span>↵</span>
                        </span>
                      </span>
                    )}
                  </button>
                  <span
                    className={`pointer-events-none absolute -bottom-7 left-0 inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 transition duration-300 ${
                      controller.showCelebration ? "translate-x-0 opacity-100" : "translate-x-1 opacity-0"
                    }`}
                  >
                    <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Saved
                  </span>
                </div>
                <button
                  className="rounded-lg border border-[#B8AA84] px-4 py-2 text-sm font-medium text-[#40503A] transition hover:bg-[#EFE5CD]"
                  onClick={controller.signOut}
                  type="button"
                >
                  Sign out
                </button>
              </div>
            </div>
            <div className="rounded-lg border border-[#EBA7A7] bg-[#FDE7E7] px-3 py-2">
              <p className="text-sm font-medium text-[#8F1D1D]">
                No-Circles is free through mid-March. After that, we plan to introduce a minimal at-cost subscription
                to cover infrastructure and API usage, with no profit margin.
              </p>
            </div>
          </form>
        ) : null}

        {controller.message ? (
          <p
            className={`mt-5 rounded-lg px-3 py-2 text-sm ${
              controller.submitState === "saved"
                ? "border border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border border-rose-300 bg-rose-50 text-rose-700"
            }`}
          >
            {controller.message}
          </p>
        ) : null}
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
