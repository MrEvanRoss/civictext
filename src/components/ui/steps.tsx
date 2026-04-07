"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface Step {
  title: string;
  description?: string;
}

interface StepsProps {
  steps: Step[];
  currentStep: number;
}

export function Steps({ steps, currentStep }: StepsProps) {
  return (
    <nav aria-label="Progress">
      <ol className="flex items-center">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className={cn("flex items-center", index < steps.length - 1 && "flex-1")}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-medium",
                  index < currentStep
                    ? "border-primary bg-primary text-primary-foreground"
                    : index === currentStep
                      ? "border-primary text-primary"
                      : "border-muted-foreground/30 text-muted-foreground/50"
                )}
              >
                {index < currentStep ? (
                  <Check className="h-4 w-4" />
                ) : (
                  index + 1
                )}
              </div>
              <div className="hidden sm:block">
                <p
                  className={cn(
                    "text-sm font-medium",
                    index <= currentStep
                      ? "text-foreground"
                      : "text-muted-foreground/50"
                  )}
                >
                  {step.title}
                </p>
                {step.description && (
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                )}
              </div>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "mx-4 h-0.5 flex-1",
                  index < currentStep ? "bg-primary" : "bg-muted-foreground/20"
                )}
              />
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
