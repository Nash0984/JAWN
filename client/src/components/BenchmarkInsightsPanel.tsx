import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { BarChart3, AlertTriangle, CheckCircle2, TrendingUp, FileText } from 'lucide-react';

export function BenchmarkInsightsPanel() {
  return (
    <div className="space-y-6" data-testid="benchmark-insights-panel">
      {/* Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            <CardTitle>Industry Benchmarks & Research Insights</CardTitle>
          </div>
          <CardDescription>
            Context from industry research on LLM accuracy for benefits and tax calculations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Known LLM Limitations</AlertTitle>
            <AlertDescription>
              Industry research shows LLMs struggle with complex tax and benefits calculations.
              Our hybrid approach combines RAG + extracted rules + PolicyEngine verification to address these limitations.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Column Tax Baseline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Column Tax Federal Tax Baseline
          </CardTitle>
          <CardDescription>
            Research: "Can LLMs Replace Tax Professionals?" (TaxCalcBench, 2024)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">GPT-5 (Strict Evaluation)</span>
                <Badge variant="destructive">41% Accuracy</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Strict scoring: Exact numeric match required for tax calculations
              </p>
            </div>

            <div className="border rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">GPT-5 (Lenient Evaluation)</span>
                <Badge variant="outline">61% Accuracy</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Lenient scoring: ±10% variance allowed
              </p>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              Key Edge Cases from Research
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
              <li>Alternative Minimum Tax (AMT) calculations: 28% accuracy</li>
              <li>Capital gains with complex basis adjustments: 35% accuracy</li>
              <li>Self-employment tax with multiple businesses: 42% accuracy</li>
              <li>Child Tax Credit phase-outs: 55% accuracy</li>
              <li>Earned Income Tax Credit (EITC) with edge cases: 48% accuracy</li>
            </ul>
          </div>

          <Alert>
            <TrendingUp className="h-4 w-4" />
            <AlertTitle>Our Approach: VITA Hybrid System</AlertTitle>
            <AlertDescription className="space-y-2 mt-2">
              <p>We address these limitations with a three-layer architecture:</p>
              <ol className="list-decimal ml-4 space-y-1 text-sm">
                <li><strong>RAG Search:</strong> Retrieve relevant IRS Pub 4012 sections using Gemini embeddings</li>
                <li><strong>Extracted Rules:</strong> Show structured tax rules (eligibility, calculation, requirements)</li>
                <li><strong>PolicyEngine Verification:</strong> Third-party API validates calculations (2% variance tolerance)</li>
              </ol>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Propel SNAP Eval Patterns */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Propel SNAP Evaluation Framework
          </CardTitle>
          <CardDescription>
            Reference: Propel's "snap-eval" test case patterns for benefits accuracy
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">25-Case Test Structure (Adapted for Maryland):</p>
            <div className="grid md:grid-cols-3 gap-3">
              <div className="border rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-600 mb-1">Eligibility Rules (8 cases)</p>
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  <li>• MD asset limits</li>
                  <li>• MD drug felony policy</li>
                  <li>• Categorical eligibility</li>
                  <li>• Student eligibility</li>
                </ul>
              </div>

              <div className="border rounded-lg p-3">
                <p className="text-xs font-semibold text-green-600 mb-1">Benefit Calculations (12 cases)</p>
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  <li>• MD gross income test</li>
                  <li>• MD net income test</li>
                  <li>• Deductions (shelter, utilities)</li>
                  <li>• Household size scaling</li>
                </ul>
              </div>

              <div className="border rounded-lg p-3">
                <p className="text-xs font-semibold text-purple-600 mb-1">Edge Cases (5 cases)</p>
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  <li>• Mixed immigration status</li>
                  <li>• Elderly/disabled households</li>
                  <li>• MD recertification periods</li>
                  <li>• Income volatility</li>
                </ul>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-600" />
              Scoring Methodology
            </p>
            <div className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Pass@1 (First attempt correct)</span>
                <Badge variant="outline">Primary metric</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Industry standard for benefits accuracy. Our goal: {">"} 90% pass@1 for Maryland programs
              </p>
            </div>
          </div>

          <Alert>
            <FileText className="h-4 w-4" />
            <AlertTitle>Maryland-Specific Adaptations</AlertTitle>
            <AlertDescription className="space-y-2 mt-2">
              <p className="text-sm">Our evaluation framework adds Maryland-specific test cases:</p>
              <ul className="list-disc ml-4 space-y-1 text-sm">
                <li>MD SNAP asset limit: $2,250 (or $3,500 for elderly/disabled households)</li>
                <li>MD drug felony policy: No disqualification (unlike federal default)</li>
                <li>MD recertification: 12 months for most, 24 for elderly/disabled</li>
                <li>MD heating/cooling standard utility allowance (HCSUA) amounts</li>
                <li>MD broad-based categorical eligibility (BBCE) up to 200% FPL</li>
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* System Design Decisions */}
      <Card>
        <CardHeader>
          <CardTitle>Design Decisions Based on Research</CardTitle>
          <CardDescription>
            How industry findings shaped our architecture
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="border-l-4 border-blue-600 pl-4 space-y-1">
            <p className="text-sm font-medium">1. Hybrid RAG + Rules as Code</p>
            <p className="text-xs text-muted-foreground">
              <strong>Finding:</strong> LLMs alone achieve 41% strict accuracy on tax calculations
              <br />
              <strong>Response:</strong> Extract deterministic rules from policy documents, validate with PolicyEngine
            </p>
          </div>

          <div className="border-l-4 border-green-600 pl-4 space-y-1">
            <p className="text-sm font-medium">2. 2% Variance Tolerance for PolicyEngine</p>
            <p className="text-xs text-muted-foreground">
              <strong>Finding:</strong> Column Tax's 61% accuracy with ±10% tolerance shows rounding matters
              <br />
              <strong>Response:</strong> Strict 2% variance for MD calculations (SNAP, Medicaid, TANF)
            </p>
          </div>

          <div className="border-l-4 border-purple-600 pl-4 space-y-1">
            <p className="text-sm font-medium">3. Maryland-First Test Cases</p>
            <p className="text-xs text-muted-foreground">
              <strong>Finding:</strong> Propel's 25-case SNAP eval shows edge cases are critical
              <br />
              <strong>Response:</strong> Build MD-specific evaluation with drug felony, BBCE, recertification cases
            </p>
          </div>

          <div className="border-l-4 border-yellow-600 pl-4 space-y-1">
            <p className="text-sm font-medium">4. Citation Transparency</p>
            <p className="text-xs text-muted-foreground">
              <strong>Finding:</strong> Black-box LLMs hide reasoning, making debugging impossible
              <br />
              <strong>Response:</strong> Show IRS Pub 4012 citations, extracted rules, and PolicyEngine verification
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Future Work */}
      <Card>
        <CardHeader>
          <CardTitle>Future Evaluation Roadmap</CardTitle>
          <CardDescription>
            Planned enhancements based on industry best practices
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5">Phase 1</Badge>
              <div>
                <p className="text-sm font-medium">Automated Test Suite</p>
                <p className="text-xs text-muted-foreground">
                  25-case Maryland SNAP evaluation (following Propel's structure)
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5">Phase 2</Badge>
              <div>
                <p className="text-sm font-medium">Multi-Program Accuracy Tracking</p>
                <p className="text-xs text-muted-foreground">
                  Expand to MD Medicaid, TANF, OHEP, WIC with program-specific benchmarks
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5">Phase 3</Badge>
              <div>
                <p className="text-sm font-medium">Real-World Validation</p>
                <p className="text-xs text-muted-foreground">
                  Partner with MD DHS to validate against actual case outcomes
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
