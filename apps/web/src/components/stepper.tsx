export function Stepper({
  currentStep,
  totalSteps,
}: {
  currentStep: number;
  totalSteps: number;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center">
        {Array.from({ length: totalSteps }, (_, index) => index + 1).map((step) => (
          <div key={step} className="flex items-center">
            <div
              className={`size-3 rounded-full ${step <= currentStep ? "bg-primary" : "bg-border"}`}
            />
            {step < totalSteps && (
              <div
                className={`h-0.5 w-8 ${step < currentStep ? "bg-primary" : "bg-border"}`}
              />
            )}
          </div>
        ))}
      </div>
      <span className="text-xs font-semibold text-muted-foreground">
        Passo {currentStep} de {totalSteps}
      </span>
    </div>
  );
}
