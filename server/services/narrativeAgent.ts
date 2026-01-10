import { ReadingLevelService } from "./readingLevelService";

const readingLevelService = new ReadingLevelService();
import { logger } from "./logger.service";

export interface Z3ProofNarrative {
  technicalProof: string;
  plainLanguageExplanation: string;
  readingLevel: number;
  keyFacts: string[];
  nextSteps: string[];
  appealGuidance?: string;
}

export interface EligibilityFactors {
  grossIncome?: number;
  netIncome?: number;
  incomeLimit?: number;
  householdSize?: number;
  deductions?: DeductionDetail[];
  assets?: number;
  assetLimit?: number;
  fplPercent?: number;
  programName?: string;
  isEligible: boolean;
  violatedRules?: string[];
}

interface DeductionDetail {
  name: string;
  amount: number;
  explanation?: string;
}

const PLAIN_LANGUAGE_TEMPLATES = {
  eligible: {
    income: "Good news! Your household income qualifies you for {program}.",
    incomeWithDeductions: "Your income, after subtracting allowed expenses, is low enough to qualify for {program}.",
    belowLimit: "Your {type} of ${amount} is below the ${limit} limit for a family of {size}."
  },
  ineligible: {
    incomeOver: "Your household income is too high to qualify for {program} right now.",
    assetsOver: "Your savings and resources are above the limit for this program.",
    requirement: "You didn't meet one of the program requirements."
  },
  deductions: {
    shelter: "We subtracted ${amount} for your housing costs (rent, mortgage, utilities).",
    medical: "We subtracted ${amount} for medical expenses since you're elderly or disabled.",
    childcare: "We subtracted ${amount} for childcare costs while you work or look for work.",
    childSupport: "We subtracted ${amount} for legally required child support payments.",
    standard: "We applied the standard ${amount} deduction that everyone gets."
  },
  nextSteps: {
    eligible: [
      "Keep copies of all documents you submitted.",
      "Watch for a decision letter in the mail within 30 days.",
      "Report any changes in income or household size."
    ],
    ineligible: [
      "You can ask for a review of this decision.",
      "If your situation changes, you can apply again.",
      "Call the number on your notice letter for help understanding this decision."
    ],
    marginal: [
      "You're close to qualifying - small changes in income could make you eligible.",
      "Make sure all your deductions were counted correctly.",
      "Ask about other programs you might qualify for."
    ]
  }
};

export class NarrativeAgent {
  translateZ3Proof(
    z3Logic: string,
    factors: EligibilityFactors,
    targetReadingLevel: number = 6
  ): Z3ProofNarrative {
    const explanation = this.buildPlainLanguageExplanation(z3Logic, factors, targetReadingLevel);
    const keyFacts = this.extractKeyFacts(factors);
    const nextSteps = this.determineNextSteps(factors);

    const metrics = readingLevelService.assessReadability(explanation);

    return {
      technicalProof: z3Logic,
      plainLanguageExplanation: explanation,
      readingLevel: metrics.fleschKincaidGrade,
      keyFacts,
      nextSteps,
      appealGuidance: factors.isEligible ? undefined : this.generateAppealGuidance(factors)
    };
  }

  private buildPlainLanguageExplanation(
    z3Logic: string,
    factors: EligibilityFactors,
    targetLevel: number
  ): string {
    const programName = factors.programName || "benefits";
    const parts: string[] = [];

    if (factors.isEligible) {
      parts.push(this.formatTemplate(PLAIN_LANGUAGE_TEMPLATES.eligible.income, {
        program: programName
      }));

      if (factors.deductions && factors.deductions.length > 0) {
        parts.push(this.explainDeductions(factors.deductions));
      }

      if (factors.netIncome !== undefined && factors.incomeLimit !== undefined) {
        parts.push(this.formatTemplate(PLAIN_LANGUAGE_TEMPLATES.eligible.belowLimit, {
          type: "monthly income",
          amount: this.formatMoney(factors.netIncome),
          limit: this.formatMoney(factors.incomeLimit),
          size: String(factors.householdSize || 1)
        }));
      }
    } else {
      if (factors.grossIncome && factors.incomeLimit && factors.grossIncome > factors.incomeLimit) {
        parts.push(this.formatTemplate(PLAIN_LANGUAGE_TEMPLATES.ineligible.incomeOver, {
          program: programName
        }));

        const overBy = factors.grossIncome - factors.incomeLimit;
        parts.push(`Your income is $${this.formatMoney(overBy)} more than the limit allows.`);
      } else if (factors.assets && factors.assetLimit && factors.assets > factors.assetLimit) {
        parts.push(PLAIN_LANGUAGE_TEMPLATES.ineligible.assetsOver);
      } else if (factors.violatedRules && factors.violatedRules.length > 0) {
        parts.push(PLAIN_LANGUAGE_TEMPLATES.ineligible.requirement);
        parts.push(this.explainViolatedRules(factors.violatedRules));
      }
    }

    let explanation = parts.join(" ");

    if (targetLevel <= 6) {
      explanation = this.simplifyText(explanation);
    }

    return explanation;
  }

  private explainDeductions(deductions: DeductionDetail[]): string {
    if (deductions.length === 0) return "";

    const parts: string[] = ["Here's how we calculated your income:"];

    for (const ded of deductions) {
      const template = PLAIN_LANGUAGE_TEMPLATES.deductions[ded.name.toLowerCase() as keyof typeof PLAIN_LANGUAGE_TEMPLATES.deductions];
      if (template) {
        parts.push(this.formatTemplate(template, { amount: this.formatMoney(ded.amount) }));
      } else {
        parts.push(`We subtracted $${this.formatMoney(ded.amount)} for ${ded.name.toLowerCase()}.`);
      }
    }

    return parts.join(" ");
  }

  private explainViolatedRules(rules: string[]): string {
    const explanations: Record<string, string> = {
      "Gross Income Limit": "Your total income before deductions is above the limit.",
      "Net Income Limit": "Your income after deductions is above the limit.",
      "Resource Limit": "Your savings and assets are above the limit.",
      "Maryland Residency": "You need to live in Maryland to get Maryland benefits.",
      "US Citizenship": "You need to be a U.S. citizen or have qualifying immigration status.",
      "Work Requirement": "You need to be working or looking for work to keep benefits.",
      "Student Status": "College students have extra rules to qualify."
    };

    const explained = rules.map(rule => {
      const exp = explanations[rule];
      return exp || `You didn't meet the "${rule}" requirement.`;
    });

    return explained.join(" ");
  }

  private extractKeyFacts(factors: EligibilityFactors): string[] {
    const facts: string[] = [];

    if (factors.householdSize) {
      facts.push(`Household size: ${factors.householdSize} ${factors.householdSize === 1 ? 'person' : 'people'}`);
    }

    if (factors.grossIncome !== undefined) {
      facts.push(`Monthly income: $${this.formatMoney(factors.grossIncome)}`);
    }

    if (factors.incomeLimit !== undefined) {
      facts.push(`Income limit for your family: $${this.formatMoney(factors.incomeLimit)}`);
    }

    if (factors.deductions && factors.deductions.length > 0) {
      const totalDed = factors.deductions.reduce((sum, d) => sum + d.amount, 0);
      facts.push(`Total deductions: $${this.formatMoney(totalDed)}`);
    }

    if (factors.netIncome !== undefined) {
      facts.push(`Income after deductions: $${this.formatMoney(factors.netIncome)}`);
    }

    if (factors.fplPercent !== undefined) {
      facts.push(`Your income is ${factors.fplPercent}% of the poverty level`);
    }

    return facts;
  }

  private determineNextSteps(factors: EligibilityFactors): string[] {
    if (factors.isEligible) {
      return [...PLAIN_LANGUAGE_TEMPLATES.nextSteps.eligible];
    }

    if (factors.grossIncome && factors.incomeLimit) {
      const difference = factors.grossIncome - factors.incomeLimit;
      const percentOver = (difference / factors.incomeLimit) * 100;

      if (percentOver < 10) {
        return [...PLAIN_LANGUAGE_TEMPLATES.nextSteps.marginal];
      }
    }

    return [...PLAIN_LANGUAGE_TEMPLATES.nextSteps.ineligible];
  }

  private generateAppealGuidance(factors: EligibilityFactors): string {
    const parts: string[] = [
      "You have the right to appeal this decision.",
      "You can request a fair hearing to have your case reviewed.",
      "During the hearing, you can explain your situation and show any documents that support your case.",
      "If you request a hearing quickly (usually within 10 days), you may keep getting benefits while you wait for the decision.",
      "Call the phone number on your notice letter to learn how to request a hearing."
    ];

    return parts.join(" ");
  }

  private simplifyText(text: string): string {
    const replacements: Record<string, string> = {
      "eligibility": "to qualify",
      "determination": "decision",
      "income threshold": "income limit",
      "countable resources": "savings and assets",
      "pursuant to": "because of",
      "in accordance with": "following",
      "subsequently": "then",
      "therefore": "so",
      "however": "but",
      "furthermore": "also",
      "nevertheless": "still",
      "notwithstanding": "even though",
      "aforementioned": "this",
      "heretofore": "before now",
      "utilize": "use",
      "commence": "start",
      "terminate": "end",
      "modification": "change",
      "verification": "proof",
      "documentation": "papers",
      "enumerate": "list",
      "substantiate": "prove",
      "ascertain": "find out"
    };

    let simplified = text;
    for (const [complex, simple] of Object.entries(replacements)) {
      const regex = new RegExp(`\\b${complex}\\b`, 'gi');
      simplified = simplified.replace(regex, simple);
    }

    simplified = simplified.replace(/\s+/g, ' ').trim();

    return simplified;
  }

  private formatTemplate(template: string, values: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(values)) {
      result = result.replace(new RegExp(`{${key}}`, 'g'), value);
    }
    return result;
  }

  private formatMoney(cents: number): string {
    const dollars = cents / 100;
    return dollars.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
}

export const narrativeAgent = new NarrativeAgent();
