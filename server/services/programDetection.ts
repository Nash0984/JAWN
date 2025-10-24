/**
 * Program Detection Utility
 * 
 * Detects which Maryland benefit program(s) a query is about using keyword matching
 * and returns ranked candidates for intelligent routing.
 */

export interface ProgramMatch {
  programCode: string;
  displayName: string;
  confidence: number;
  matchedKeywords: string[];
}

class ProgramDetection {
  private readonly programKeywords: Record<string, { keywords: string[]; displayName: string }> = {
    'MD_SNAP': {
      keywords: ['snap', 'food stamps', 'food assistance', 'ebt', 'food benefits', 'nutrition assistance', 'supplemental nutrition'],
      displayName: 'SNAP (Food Assistance)'
    },
    'LIHEAP_MD': {
      keywords: ['liheap', 'ohep', 'energy', 'utility', 'electric', 'gas', 'heating', 'cooling', 'utility bills', 'energy assistance', 'energy bill', 'power bill', 'fuel assistance', 'meap', 'eusp'],
      displayName: 'Maryland Energy Assistance (OHEP)'
    },
    'MD_OHEP': { // Backward compatibility - deprecated
      keywords: ['ohep', 'energy', 'utility', 'electric', 'gas', 'heating', 'cooling', 'utility bills', 'energy assistance', 'energy bill', 'power bill', 'fuel assistance'],
      displayName: 'OHEP (Energy Assistance)'
    },
    'MD_TANF': {
      keywords: ['tanf', 'tca', 'cash assistance', 'temporary cash', 'welfare', 'family assistance', 'temporary assistance'],
      displayName: 'TANF (Cash Assistance)'
    },
    'MEDICAID': {
      keywords: ['medicaid', 'medical assistance', 'health coverage', 'health insurance', 'medical benefits', 'healthcare', 'health care', 'medical card'],
      displayName: 'Medicaid (Health Coverage)'
    },
    'MD_VITA_TAX': {
      keywords: ['vita', 'tax return', 'tax preparation', 'file taxes', 'tax refund', 'irs', 'federal tax', 'state tax', 'tax filing', 'income tax'],
      displayName: 'VITA Tax Assistance'
    },
    'TAX_CREDITS': {
      keywords: ['tax credits', 'tax credit', 'eitc', 'earned income', 'child tax credit', 'ctc', 'additional child tax', 'actc', 'refundable credit'],
      displayName: 'Tax Credits'
    }
  };

  /**
   * Detect programs from query text and return ranked matches
   */
  detectProgram(query: string, benefitProgramId?: string): ProgramMatch[] {
    const queryLower = query.toLowerCase();
    const matches: ProgramMatch[] = [];

    // If benefitProgramId is explicitly provided, prioritize it
    if (benefitProgramId) {
      /**
       * Program ID mapping implementation:
       * When integrated with storage, this will map database benefit program IDs to program codes.
       * 
       * Production implementation:
       *   const program = await storage.getBenefitProgram(benefitProgramId);
       *   const programCode = program?.programCode || benefitProgramId;
       * 
       * Current behavior: Assumes benefitProgramId directly maps to program code.
       * This works for standard Maryland programs (MD_SNAP, MD_OHEP, MD_TANF, MEDICAID, etc.)
       */
      const programConfig = this.programKeywords[benefitProgramId];
      if (programConfig) {
        matches.push({
          programCode: benefitProgramId,
          displayName: programConfig.displayName,
          confidence: 1.0,
          matchedKeywords: ['explicit_program_id']
        });
        return matches;
      }
    }

    // Scan for keyword matches in each program
    for (const [programCode, config] of Object.entries(this.programKeywords)) {
      const matchedKeywords: string[] = [];
      
      for (const keyword of config.keywords) {
        // Use word boundary matching to avoid partial matches
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        if (regex.test(queryLower)) {
          matchedKeywords.push(keyword);
        }
      }

      if (matchedKeywords.length > 0) {
        // Calculate confidence based on number and specificity of matches
        const confidence = Math.min(
          (matchedKeywords.length / config.keywords.length) + 
          (matchedKeywords.length * 0.2), // Bonus for multiple matches
          1.0
        );

        matches.push({
          programCode,
          displayName: config.displayName,
          confidence,
          matchedKeywords
        });
      }
    }

    // Sort by confidence (descending)
    matches.sort((a, b) => b.confidence - a.confidence);

    // If no matches found, default to SNAP (most common query)
    if (matches.length === 0) {
      matches.push({
        programCode: 'MD_SNAP',
        displayName: this.programKeywords['MD_SNAP'].displayName,
        confidence: 0.3,
        matchedKeywords: ['default_fallback']
      });
    }

    return matches;
  }

  /**
   * Get single best match
   */
  detectBestMatch(query: string, benefitProgramId?: string): ProgramMatch | null {
    const matches = this.detectProgram(query, benefitProgramId);
    return matches.length > 0 ? matches[0] : null;
  }

  /**
   * Check if query is about multiple programs
   */
  isMultiProgram(query: string): boolean {
    const matches = this.detectProgram(query);
    return matches.filter(m => m.confidence > 0.5).length > 1;
  }
}

export const programDetection = new ProgramDetection();
