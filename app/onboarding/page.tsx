"use client";

import { SiteCursor } from "@/components/site-cursor";
import { OnboardingForm } from "@/app/onboarding/onboarding-form";
import { useOnboardingController } from "@/app/onboarding/use-onboarding-controller";

export default function OnboardingPage() {
  const controller = useOnboardingController();
  return (
    <>
      <SiteCursor />
      <OnboardingForm controller={controller} />
    </>
  );
}
