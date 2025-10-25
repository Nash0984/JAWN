import { BenefitsCliffCalculator } from "@/components/BenefitsCliffCalculator";
import { TrendingUp } from "lucide-react";

export default function CliffCalculator() {
  return (
    <>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <TrendingUp className="w-8 h-8 text-primary" />
            Benefits Cliff Calculator
          </h1>
          <p className="text-muted-foreground text-lg">
            Compare income scenarios to understand how wage changes affect your combined resources from work, benefits, and tax credits.
          </p>
        </div>

        <BenefitsCliffCalculator />

        <div className="mt-12 p-6 bg-muted rounded-lg">
          <h2 className="text-xl font-semibold mb-3">What is a Benefits Cliff?</h2>
          <p className="mb-4">
            A "benefits cliff" occurs when earning more money from work actually <strong>decreases</strong> your 
            total household resources because the reduction in benefits and increase in taxes outweighs the wage increase.
          </p>
          <p className="mb-4">
            This calculator helps you avoid these cliffs by showing:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Your net income (wages + benefits - taxes) in both scenarios</li>
            <li>How each benefit program (SNAP, Medicaid, EITC, etc.) changes</li>
            <li>Whether the wage increase results in a net gain or loss</li>
            <li>Recommendations for navigating benefit phase-outs</li>
          </ul>
          <p className="mt-4 text-sm text-muted-foreground">
            <strong>Note:</strong> Calculations are estimates based on federal and Maryland state benefit rules. 
            Actual benefit amounts may vary based on additional factors and case-specific circumstances.
          </p>
        </div>
      </div>
    </>
  );
}
