"use client";

import { OnboardingForm } from "@/app/onboarding/onboarding-form";
import { useOnboardingController } from "@/app/onboarding/use-onboarding-controller";

export default function OnboardingPage() {
  const controller = useOnboardingController();
  return <OnboardingForm controller={controller} />;
}
