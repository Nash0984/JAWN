/**
 * Flesch-Kincaid Readability Scorer
 * 
 * Calculates readability metrics to ensure content is accessible at target grade levels.
 * Target: Grade 8 or below for user-facing text (WCAG AAA plain language requirement)
 */

export interface ReadabilityScore {
  fleschReadingEase: number;
  fleschKincaidGrade: number;
  totalWords: number;
  totalSentences: number;
  totalSyllables: number;
  averageWordsPerSentence: number;
  averageSyllablesPerWord: number;
  isAccessible: boolean;
  suggestions: string[];
}

/**
 * Count syllables in a word using basic heuristics
 */
function countSyllables(word: string): number {
  word = word.toLowerCase().trim();
  
  // Remove trailing e's
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  word = word.replace(/^y/, '');
  
  // Count vowel groups
  const syllables = word.match(/[aeiouy]{1,2}/g);
  const count = syllables ? syllables.length : 0;
  
  // Every word has at least one syllable
  return count === 0 ? 1 : count;
}

/**
 * Split text into sentences
 */
function getSentences(text: string): string[] {
  // Split on period, exclamation, question mark followed by space or end of string
  const sentences = text
    .split(/[.!?]+(?:\s+|$)/)
    .filter(s => s.trim().length > 0);
  
  return sentences.length > 0 ? sentences : [text];
}

/**
 * Split text into words
 */
function getWords(text: string): string[] {
  // Remove HTML tags and special characters, then split on whitespace
  const cleanText = text.replace(/<[^>]*>/g, '').replace(/[^\w\s'-]/g, ' ');
  const words = cleanText.split(/\s+/).filter(w => w.length > 0);
  
  return words;
}

/**
 * Calculate Flesch Reading Ease Score
 * Score ranges:
 * 90-100: Very Easy (5th grade)
 * 80-89: Easy (6th grade)
 * 70-79: Fairly Easy (7th grade)
 * 60-69: Standard (8th-9th grade)
 * 50-59: Fairly Difficult (10th-12th grade)
 * 30-49: Difficult (College)
 * 0-29: Very Difficult (College graduate)
 */
function calculateFleschReadingEase(
  totalWords: number,
  totalSentences: number,
  totalSyllables: number
): number {
  if (totalWords === 0 || totalSentences === 0) return 0;
  
  const avgWordsPerSentence = totalWords / totalSentences;
  const avgSyllablesPerWord = totalSyllables / totalWords;
  
  return 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord);
}

/**
 * Calculate Flesch-Kincaid Grade Level
 * Returns the US grade level needed to understand the text
 */
function calculateFleschKincaidGrade(
  totalWords: number,
  totalSentences: number,
  totalSyllables: number
): number {
  if (totalWords === 0 || totalSentences === 0) return 0;
  
  const avgWordsPerSentence = totalWords / totalSentences;
  const avgSyllablesPerWord = totalSyllables / totalWords;
  
  return (0.39 * avgWordsPerSentence) + (11.8 * avgSyllablesPerWord) - 15.59;
}

/**
 * Generate suggestions based on readability scores
 */
function generateSuggestions(
  gradeLevel: number,
  avgWordsPerSentence: number,
  avgSyllablesPerWord: number
): string[] {
  const suggestions: string[] = [];
  
  if (gradeLevel > 8) {
    suggestions.push('Content exceeds 8th grade reading level. Consider simplifying language.');
  }
  
  if (avgWordsPerSentence > 20) {
    suggestions.push('Sentences are too long (avg: ' + Math.round(avgWordsPerSentence) + ' words). Break into shorter sentences (15-20 words max).');
  }
  
  if (avgSyllablesPerWord > 1.7) {
    suggestions.push('Words are too complex (avg: ' + avgSyllablesPerWord.toFixed(1) + ' syllables). Use simpler words when possible.');
  }
  
  if (gradeLevel > 10) {
    suggestions.push('⚠️ CRITICAL: Grade level exceeds maximum threshold (10). This will fail deployment checks.');
  }
  
  return suggestions;
}

/**
 * Calculate comprehensive readability metrics for given text
 */
export function calculateReadability(text: string): ReadabilityScore {
  if (!text || text.trim().length === 0) {
    return {
      fleschReadingEase: 0,
      fleschKincaidGrade: 0,
      totalWords: 0,
      totalSentences: 0,
      totalSyllables: 0,
      averageWordsPerSentence: 0,
      averageSyllablesPerWord: 0,
      isAccessible: false,
      suggestions: ['No text provided for analysis'],
    };
  }
  
  const sentences = getSentences(text);
  const words = getWords(text);
  const totalSyllables = words.reduce((sum, word) => sum + countSyllables(word), 0);
  
  const totalWords = words.length;
  const totalSentences = sentences.length;
  const avgWordsPerSentence = totalWords / totalSentences;
  const avgSyllablesPerWord = totalSyllables / totalWords;
  
  const fleschReadingEase = calculateFleschReadingEase(totalWords, totalSentences, totalSyllables);
  const fleschKincaidGrade = calculateFleschKincaidGrade(totalWords, totalSentences, totalSyllables);
  
  const isAccessible = fleschKincaidGrade <= 8;
  const suggestions = generateSuggestions(fleschKincaidGrade, avgWordsPerSentence, avgSyllablesPerWord);
  
  return {
    fleschReadingEase,
    fleschKincaidGrade,
    totalWords,
    totalSentences,
    totalSyllables,
    averageWordsPerSentence: avgWordsPerSentence,
    averageSyllablesPerWord: avgSyllablesPerWord,
    isAccessible,
    suggestions,
  };
}

/**
 * Validate text meets accessibility standards (Grade 8 or below)
 */
export function validateTextAccessibility(text: string): {
  isValid: boolean;
  gradeLevel: number;
  message: string;
} {
  const score = calculateReadability(text);
  
  return {
    isValid: score.isAccessible,
    gradeLevel: score.fleschKincaidGrade,
    message: score.isAccessible
      ? `Text is accessible (Grade ${score.fleschKincaidGrade.toFixed(1)})`
      : `Text is too complex (Grade ${score.fleschKincaidGrade.toFixed(1)}). Target: Grade 8 or below.`,
  };
}

/**
 * Get readability level description
 */
export function getReadabilityLevel(score: number): {
  level: string;
  description: string;
  color: 'success' | 'warning' | 'destructive';
} {
  if (score >= 90) {
    return { level: 'Very Easy', description: '5th grade', color: 'success' };
  } else if (score >= 80) {
    return { level: 'Easy', description: '6th grade', color: 'success' };
  } else if (score >= 70) {
    return { level: 'Fairly Easy', description: '7th grade', color: 'success' };
  } else if (score >= 60) {
    return { level: 'Standard', description: '8th-9th grade', color: 'success' };
  } else if (score >= 50) {
    return { level: 'Fairly Difficult', description: '10th-12th grade', color: 'warning' };
  } else if (score >= 30) {
    return { level: 'Difficult', description: 'College', color: 'destructive' };
  } else {
    return { level: 'Very Difficult', description: 'College graduate', color: 'destructive' };
  }
}

/**
 * Real-time readability validator for form inputs
 * Returns validation error if text is too complex
 */
export function validateFormFieldReadability(value: string): string | undefined {
  if (!value || value.trim().length < 10) {
    return undefined; // Too short to analyze meaningfully
  }
  
  const score = calculateReadability(value);
  
  if (score.fleschKincaidGrade > 10) {
    return `Text is too complex (Grade ${score.fleschKincaidGrade.toFixed(1)}). Please use simpler language (Grade 8 or below).`;
  }
  
  return undefined;
}
