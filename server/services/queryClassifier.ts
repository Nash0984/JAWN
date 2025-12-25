/**
 * Query Classification Service
 * 
 * Determines whether a user query should be routed to:
 * - Rules Engine: Deterministic eligibility calculations
 * - RAG System: Policy interpretation and explanations
 * - Hybrid: Both systems working together
 */

export type QueryType = 'eligibility' | 'policy' | 'hybrid';

export interface ClassificationResult {
  type: QueryType;
  confidence: number;
  reasoning: string;
  extractedParams?: {
    householdSize?: number;
    income?: number;
    hasSSI?: boolean;
    hasTANF?: boolean;
    hasElderly?: boolean;
    hasDisabled?: boolean;
  };
}

class QueryClassifier {
  // Eligibility question patterns
  private eligibilityPatterns = [
    /\b(do i|am i|will i|can i).{0,20}(qualify|eligible|get|receive)\b/i,
    /\b(qualify|eligible).{0,20}(for|to get)\s+(snap|food stamps|benefits)/i,
    /\bhow much.{0,20}(snap|benefits|food stamps).{0,20}(get|receive|qualify)/i,
    /\bwhat.{0,20}(benefit amount|snap amount|monthly benefit)/i,
    /\bcalculate.{0,20}(benefit|snap|eligibility)/i,
    /\bcheck.{0,20}(eligibility|if i qualify)/i,
    /\bam i eligible/i,
    /\bdo i qualify/i,
    /\bhousehold.{0,30}income.{0,30}(limit|eligible|qualify)/i,
    /\bincome.{0,20}(limit|threshold|maximum|requirement)/i,
  ];

  // Policy/interpretation question patterns
  private policyPatterns = [
    /\bwhy (is|does|do|are)\b/i,
    /\bwhat (is|are|does|do).{0,20}(mean|count|include|exclude)/i,
    /\bhow.{0,20}(is|are|does|do).{0,20}(calculated|determined|defined)/i,
    /\bexplain.{0,20}(the|this|that|how)/i,
    /\bwhat.{0,20}(counts as|considered|defined as)/i,
    /\btell me about/i,
    /\bwhat.{0,20}(rule|policy|regulation|requirement)/i,
    /\bhow.{0,20}(work|apply|calculate)/i,
    /\bdefinition of/i,
    /\bwhat.{0,20}document/i,
  ];

  // Hybrid question patterns (need both calculation AND explanation)
  private hybridPatterns = [
    /\bwhy.{0,20}(benefit amount|calculation|eligible|not eligible)/i,
    /\bexplain.{0,20}(benefit|calculation|eligibility)/i,
    /\bhow.{0,20}(calculated|computed).{0,20}(benefit|snap)/i,
    /\bshow.{0,20}(breakdown|calculation|how)/i,
  ];

  // Eligibility keywords
  private eligibilityKeywords = [
    'qualify', 'eligible', 'get', 'receive', 'amount', 'benefit',
    'calculate', 'household', 'income', 'limit', 'maximum', 'minimum'
  ];

  // Policy keywords
  private policyKeywords = [
    'why', 'what', 'how', 'explain', 'define', 'mean', 'rule',
    'policy', 'requirement', 'document', 'count', 'include', 'exclude'
  ];

  /**
   * Classify a user query to determine routing strategy
   */
  classify(query: string): ClassificationResult {
    const lowerQuery = query.toLowerCase();

    // Check for hybrid patterns first (most specific)
    for (const pattern of this.hybridPatterns) {
      if (pattern.test(query)) {
        return {
          type: 'hybrid',
          confidence: 0.9,
          reasoning: 'Query requires both calculation and explanation',
          extractedParams: this.extractEligibilityParams(query),
        };
      }
    }

    // Check for eligibility patterns
    let eligibilityScore = 0;
    for (const pattern of this.eligibilityPatterns) {
      if (pattern.test(query)) {
        eligibilityScore += 2;
      }
    }

    // Check for policy patterns
    let policyScore = 0;
    for (const pattern of this.policyPatterns) {
      if (pattern.test(query)) {
        policyScore += 2;
      }
    }

    // Keyword-based scoring
    for (const keyword of this.eligibilityKeywords) {
      if (lowerQuery.includes(keyword)) {
        eligibilityScore += 0.5;
      }
    }

    for (const keyword of this.policyKeywords) {
      if (lowerQuery.includes(keyword)) {
        policyScore += 0.5;
      }
    }

    // Determine type based on scores
    if (eligibilityScore > policyScore && eligibilityScore >= 2) {
      return {
        type: 'eligibility',
        confidence: Math.min(eligibilityScore / 5, 1),
        reasoning: 'Query is asking about eligibility determination or benefit calculation',
        extractedParams: this.extractEligibilityParams(query),
      };
    }

    if (policyScore > eligibilityScore && policyScore >= 2) {
      return {
        type: 'policy',
        confidence: Math.min(policyScore / 5, 1),
        reasoning: 'Query is asking for policy interpretation or explanation',
      };
    }

    // If both scores are high, it's hybrid
    if (eligibilityScore >= 2 && policyScore >= 2) {
      return {
        type: 'hybrid',
        confidence: 0.8,
        reasoning: 'Query requires both calculation and explanation',
        extractedParams: this.extractEligibilityParams(query),
      };
    }

    // Default to policy for general questions
    return {
      type: 'policy',
      confidence: 0.5,
      reasoning: 'General question - defaulting to policy search',
    };
  }

  /**
   * Extract eligibility parameters from natural language query
   */
  private extractEligibilityParams(query: string): ClassificationResult['extractedParams'] {
    const params: ClassificationResult['extractedParams'] = {};

    // Extract household size
    const householdMatch = query.match(/household\s+of\s+(\d+)|(\d+)\s+people|(\d+)\s+person/i);
    if (householdMatch) {
      const size = parseInt(householdMatch[1] || householdMatch[2] || householdMatch[3]);
      if (!isNaN(size) && size > 0 && size <= 20) {
        params.householdSize = size;
      }
    }

    // Extract income
    const incomeMatch = query.match(/\$?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:per month|monthly|\/month|a month)/i);
    if (incomeMatch) {
      const income = parseFloat(incomeMatch[1].replace(/,/g, ''));
      if (!isNaN(income) && income >= 0) {
        params.income = Math.round(income * 100); // Convert to cents
      }
    }

    // Detect SSI/TANF
    if (/\b(receive|get|on|have)\s+(SSI|supplemental security income)/i.test(query)) {
      params.hasSSI = true;
    }

    if (/\b(receive|get|on|have)\s+(TANF|cash assistance|temporary assistance)/i.test(query)) {
      params.hasTANF = true;
    }

    // Detect elderly/disabled
    if (/\b(elderly|senior|over 60|age 60|disabled|disability)/i.test(query)) {
      params.hasElderly = /\b(elderly|senior|over 60|age 60)/i.test(query);
      params.hasDisabled = /\b(disabled|disability)/i.test(query);
    }

    return Object.keys(params).length > 0 ? params : undefined;
  }

  /**
   * Determine if query has enough information for direct eligibility check
   */
  canCalculateDirectly(classification: ClassificationResult): boolean {
    if (classification.type !== 'eligibility' && classification.type !== 'hybrid') {
      return false;
    }

    const params = classification.extractedParams;
    if (!params) {
      return false;
    }

    // Need at least household size and income OR categorical eligibility
    const hasBasicInfo = params.householdSize && params.income;
    const hasCategoricalEligibility = params.hasSSI || params.hasTANF;

    return !!(hasBasicInfo || (params.householdSize && hasCategoricalEligibility));
  }
}

export const queryClassifier = new QueryClassifier();
