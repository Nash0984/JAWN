/**
 * Plain Language Validator
 * 
 * Detects complex terms and suggests simpler alternatives to meet
 * WCAG AAA plain language requirements.
 */

export interface PlainLanguageSuggestion {
  original: string;
  suggestion: string;
  context: string;
  position: number;
}

export interface PlainLanguageResult {
  hasIssues: boolean;
  suggestions: PlainLanguageSuggestion[];
  jargonTerms: string[];
  complexityScore: number;
}

/**
 * Dictionary of complex terms with plain language alternatives
 */
const PLAIN_LANGUAGE_DICTIONARY: Record<string, string> = {
  // Common complex words
  'utilize': 'use',
  'utilization': 'use',
  'commence': 'start',
  'terminate': 'end',
  'substantiate': 'prove',
  'endeavor': 'try',
  'facilitate': 'help',
  'implement': 'do',
  'ascertain': 'find out',
  'obtain': 'get',
  'purchase': 'buy',
  'assist': 'help',
  'provide': 'give',
  'require': 'need',
  'indicate': 'show',
  'demonstrate': 'show',
  'establish': 'set up',
  'maintain': 'keep',
  'sufficient': 'enough',
  'prior to': 'before',
  'subsequent to': 'after',
  'in order to': 'to',
  'due to the fact that': 'because',
  'in the event that': 'if',
  'at this point in time': 'now',
  'in the near future': 'soon',
  'on a monthly basis': 'monthly',
  'with regard to': 'about',
  'in accordance with': 'under',
  'in lieu of': 'instead of',
  'pursuant to': 'under',
  'per': 'each',
  'aforementioned': 'mentioned',
  'heretofore': 'until now',
  'whereby': 'where',
  'wherein': 'where',
  'subsequent': 'later',
  'prior': 'earlier',
  'transmit': 'send',
  'forward': 'send',
  'remit': 'send',
  'compensation': 'pay',
  'remuneration': 'pay',
  'residence': 'home',
  'domicile': 'home',
  'dwelling': 'home',
  'vehicle': 'car',
  'automobile': 'car',
  'employment': 'job',
  'occupation': 'job',
  
  // Government/benefits jargon
  'categorical eligibility': 'automatic eligibility',
  'means-tested': 'based on income',
  'income threshold': 'income limit',
  'verification period': 'proof deadline',
  'recertification': 're-apply',
  'redetermination': 'review',
  'adjudication': 'decision',
  'determination': 'decision',
  'disposition': 'result',
  'pending': 'waiting',
  'expedited': 'fast',
  'deferred': 'delayed',
  'authorized': 'approved',
  'disqualified': 'not eligible',
  'ineligible': 'not eligible',
  'countable income': 'income we count',
  'excluded income': 'income we don\'t count',
  'gross income': 'total income before taxes',
  'net income': 'income after deductions',
  'deduction': 'amount taken off',
  'allotment': 'benefit amount',
  'issuance': 'payment',
  'overpayment': 'paid too much',
  'underpayment': 'paid too little',
  'repayment': 'pay back',
  'sanction': 'penalty',
  'waiver': 'excuse',
  'deferral': 'delay',
  
  // Tax jargon
  'filing status': 'how you file',
  'adjusted gross income': 'total income after adjustments',
  'itemized deductions': 'list of expenses',
  'standard deduction': 'fixed deduction amount',
  'withholding': 'taxes taken from paycheck',
  'refund': 'money back',
  'tax liability': 'taxes owed',
  'dependent': 'child or family member you support',
  'exemption': 'amount that reduces taxes',
  'credit': 'reduces tax bill',
  'tax deduction': 'reduces taxable income',
};

/**
 * Benefits/government jargon that needs definitions
 */
const JARGON_TERMS: Record<string, string> = {
  'SNAP': 'Supplemental Nutrition Assistance Program (food assistance)',
  'TANF': 'Temporary Assistance for Needy Families (cash assistance)',
  'EITC': 'Earned Income Tax Credit (tax credit for workers)',
  'CTC': 'Child Tax Credit',
  'ACTC': 'Additional Child Tax Credit',
  'CDCTC': 'Child and Dependent Care Tax Credit',
  'MAGI': 'Modified Adjusted Gross Income',
  'AGI': 'Adjusted Gross Income',
  'FPL': 'Federal Poverty Level',
  'ABAWD': 'Able-Bodied Adult Without Dependents',
  'SSI': 'Supplemental Security Income',
  'SSDI': 'Social Security Disability Insurance',
  'TCA': 'Temporary Cash Assistance',
  'LIEAP': 'Low Income Energy Assistance Program',
  'WIC': 'Women, Infants, and Children nutrition program',
  'OHEP': 'Office of Home Energy Programs',
  'DHR': 'Department of Human Resources',
  'DHS': 'Department of Human Services',
  'IRS': 'Internal Revenue Service',
  'W-2': 'Wage and Tax Statement',
  '1099': 'Form for reporting various types of income',
  'EIN': 'Employer Identification Number',
  'SSN': 'Social Security Number',
  'ITIN': 'Individual Taxpayer Identification Number',
  'VITA': 'Volunteer Income Tax Assistance',
  'TCE': 'Tax Counseling for the Elderly',
};

/**
 * Find complex terms in text and suggest simpler alternatives
 */
export function analyzePlainLanguage(text: string): PlainLanguageResult {
  const suggestions: PlainLanguageSuggestion[] = [];
  const jargonTerms: string[] = [];
  
  if (!text || text.trim().length === 0) {
    return {
      hasIssues: false,
      suggestions: [],
      jargonTerms: [],
      complexityScore: 0,
    };
  }
  
  const lowerText = text.toLowerCase();
  
  // Check for complex terms
  for (const [complex, simple] of Object.entries(PLAIN_LANGUAGE_DICTIONARY)) {
    const regex = new RegExp(`\\b${complex}\\b`, 'gi');
    const matches = Array.from(text.matchAll(regex));
    
    for (const match of matches) {
      if (match.index !== undefined) {
        suggestions.push({
          original: match[0],
          suggestion: simple,
          context: getContext(text, match.index, match[0].length),
          position: match.index,
        });
      }
    }
  }
  
  // Check for jargon terms
  for (const [jargon, definition] of Object.entries(JARGON_TERMS)) {
    const regex = new RegExp(`\\b${jargon}\\b`, 'gi');
    if (regex.test(lowerText)) {
      jargonTerms.push(`${jargon}: ${definition}`);
    }
  }
  
  // Calculate complexity score (0-100, higher is more complex)
  const complexityScore = Math.min(100, (suggestions.length * 10) + (jargonTerms.length * 5));
  
  return {
    hasIssues: suggestions.length > 0 || jargonTerms.length > 0,
    suggestions,
    jargonTerms,
    complexityScore,
  };
}

/**
 * Get surrounding context for a term (30 chars before and after)
 */
function getContext(text: string, position: number, length: number): string {
  const start = Math.max(0, position - 30);
  const end = Math.min(text.length, position + length + 30);
  const context = text.substring(start, end);
  
  return (start > 0 ? '...' : '') + context + (end < text.length ? '...' : '');
}

/**
 * Simplify text by replacing complex terms with plain language
 */
export function simplifyText(text: string): string {
  let simplified = text;
  
  for (const [complex, simple] of Object.entries(PLAIN_LANGUAGE_DICTIONARY)) {
    const regex = new RegExp(`\\b${complex}\\b`, 'gi');
    simplified = simplified.replace(regex, (match) => {
      // Preserve capitalization
      if (match[0] === match[0].toUpperCase()) {
        return simple.charAt(0).toUpperCase() + simple.slice(1);
      }
      return simple;
    });
  }
  
  return simplified;
}

/**
 * Validate form field text for plain language
 */
export function validatePlainLanguage(value: string): string | undefined {
  if (!value || value.trim().length < 10) {
    return undefined;
  }
  
  const analysis = analyzePlainLanguage(value);
  
  if (analysis.suggestions.length > 3) {
    return `Text uses complex language. Consider using simpler words (found ${analysis.suggestions.length} complex terms).`;
  }
  
  return undefined;
}

/**
 * Get suggestions for a specific text field
 */
export function getSuggestionsForField(value: string): string[] {
  const analysis = analyzePlainLanguage(value);
  const messages: string[] = [];
  
  if (analysis.suggestions.length > 0) {
    const firstThree = analysis.suggestions.slice(0, 3);
    firstThree.forEach(s => {
      messages.push(`Replace "${s.original}" with "${s.suggestion}"`);
    });
    
    if (analysis.suggestions.length > 3) {
      messages.push(`...and ${analysis.suggestions.length - 3} more suggestions`);
    }
  }
  
  if (analysis.jargonTerms.length > 0) {
    messages.push(`Define acronyms: ${analysis.jargonTerms.slice(0, 2).join(', ')}`);
  }
  
  return messages;
}

/**
 * Check if text meets plain language standards (complexity score < 30)
 */
export function meetsPlainLanguageStandard(text: string): boolean {
  const analysis = analyzePlainLanguage(text);
  return analysis.complexityScore < 30;
}

/**
 * Get plain language report for content
 */
export function getPlainLanguageReport(text: string): {
  score: number;
  grade: 'excellent' | 'good' | 'fair' | 'poor';
  message: string;
  topSuggestions: string[];
} {
  const analysis = analyzePlainLanguage(text);
  const score = Math.max(0, 100 - analysis.complexityScore);
  
  let grade: 'excellent' | 'good' | 'fair' | 'poor';
  let message: string;
  
  if (score >= 90) {
    grade = 'excellent';
    message = 'Text uses clear, simple language';
  } else if (score >= 70) {
    grade = 'good';
    message = 'Text is mostly clear with minor improvements needed';
  } else if (score >= 50) {
    grade = 'fair';
    message = 'Text could be simplified for better accessibility';
  } else {
    grade = 'poor';
    message = 'Text is too complex and needs significant simplification';
  }
  
  const topSuggestions = analysis.suggestions
    .slice(0, 5)
    .map(s => `Replace "${s.original}" with "${s.suggestion}"`);
  
  return {
    score,
    grade,
    message,
    topSuggestions,
  };
}
