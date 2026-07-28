import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Stepper } from "@/components/stepper";

export function WizardHeader({
  title,
  backHref,
  currentStep,
  totalSteps = 4,
}: {
  title: string;
  backHref: string;
  currentStep: number;
  totalSteps?: number;
}) {
  return (
    <header className="flex flex-col items-center gap-4 border-b border-border bg-card px-4 py-4 sm:px-6">
      <div className="flex w-full max-w-md items-center gap-3">
        <Link
          href={backHref}
          aria-label="Voltar"
          className="flex size-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="font-heading text-lg font-bold text-foreground">{title}</h1>
      </div>
      <Stepper currentStep={currentStep} totalSteps={totalSteps} />
    </header>
  );
}
