"use client";

import Link from "next/link";
import { BRAIN_DUMP_WORD_LIMIT } from "@/app/onboarding/onboarding-config";
import type { OnboardingController } from "@/app/onboarding/use-onboarding-controller";

type OnboardingFormProps = {
  controller: OnboardingController;
};

export function OnboardingForm({ controller }: OnboardingFormProps) {
  const meterBars = controller.dictationLevels.length > 0 ? controller.dictationLevels : Array.from({ length: 12 }, () => 0);
  const isWarming = controller.dictationState === "warming";
  const isRecording = controller.dictationState === "recording";

  return (
    <main className="min-h-screen bg-[#F3ECD8] px-6 py-12 text-[#2D3426]">
      <div className="mx-auto w-full max-w-3xl rounded-3xl border border-[#C9BD9A] bg-[#FAF5E8] p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.18em] text-[#6B775D]">Onboarding</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#2B3125]">What are you curious about?</h1>
        <p className="mt-3 text-sm leading-6 text-[#4B5943]">
          Leave breadcrumbs for tomorrow-you: obsessions, rabbit holes, and what to skip.
        </p>

        <div className="mt-5 rounded-lg border border-[#D8CCAA] bg-[#F4EEDC] px-4 py-3 text-sm">
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
          <form className="mt-7 space-y-5" onSubmit={controller.submitOnboarding}>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-[#3E4A36]">Preferred name</span>
              <input
                className="w-full rounded-lg border border-[#C7BA95] bg-[#FFFDF8] px-3 py-2 text-sm focus:border-[#3D6F49] focus:outline-none"
                onChange={(event) => controller.setPreferredName(event.target.value)}
                onKeyDown={controller.completePreferredNameOnTab}
                placeholder={controller.preferredNameSuggestion}
                required
                value={controller.preferredName}
              />
              <span className="mt-1 block text-xs text-[#6B775D]">Press Tab to accept the suggested name.</span>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-[#3E4A36]">Timezone</span>
                <select
                  className="w-full rounded-lg border border-[#C7BA95] bg-[#FFFDF8] px-3 py-2 text-sm focus:border-[#3D6F49] focus:outline-none"
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
                <span className="mb-1 block text-sm font-medium text-[#3E4A36]">Send time (local)</span>
                <div className="rounded-lg border border-[#C7BA95] bg-[#FFFDF8] p-2">
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      className="rounded-md border border-[#D7CCAE] bg-[#FFFDF8] px-2 py-2 text-sm focus:border-[#3D6F49] focus:outline-none"
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
                      className="rounded-md border border-[#D7CCAE] bg-[#FFFDF8] px-2 py-2 text-sm focus:border-[#3D6F49] focus:outline-none"
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
                      className="rounded-md border border-[#D7CCAE] bg-[#FFFDF8] px-2 py-2 text-sm focus:border-[#3D6F49] focus:outline-none"
                      onChange={(event) => controller.setSendMeridiem(event.target.value as "AM" | "PM")}
                      value={controller.sendMeridiem}
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                  <span className="mt-1 block text-xs text-[#6B775D]">Your local delivery time.</span>
                </div>
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-[#3E4A36]">Interest brain dump</span>
              <textarea
                className="h-48 w-full rounded-lg border border-[#C7BA95] bg-[#FFFDF8] px-3 py-2 text-sm leading-6 focus:border-[#3D6F49] focus:outline-none"
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

                  const allowedKeys = new Set([
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

                  if (event.metaKey || event.ctrlKey || event.altKey || allowedKeys.has(event.key)) {
                    return;
                  }

                  event.preventDefault();
                }}
                placeholder="Add what you want more of, less of, and what kind of ideas you want to stumble into."
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
              <div className="mt-2 flex flex-wrap gap-2.5">
                {controller.quickSparks.map((spark) => (
                  <button
                    className="rounded-full border border-[#CDBF98] bg-[#F6EFD9] px-3 py-1 text-xs font-medium text-[#4F5D45] transition hover:bg-[#ECE2C8]"
                    key={spark}
                    onClick={() => controller.appendQuickSpark(spark)}
                    type="button"
                  >
                    {spark}
                  </button>
                ))}
              </div>
              <span className="mt-1 block text-xs text-[#6B775D]">
                {controller.dictationState === "warming" && "Preparing microphone..."}
                {controller.dictationState === "recording" && "Listening..."}
                {controller.dictationState === "stopping" && "Finishing transcript..."}
              </span>
              {controller.dictationError ? (
                <span className="mt-2 block text-xs text-rose-700">{controller.dictationError}</span>
              ) : null}
            </label>

            <div className="flex flex-wrap gap-3">
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
    </main>
  );
}
