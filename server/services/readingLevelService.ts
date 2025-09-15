// Reading Level Assessment Service
// Implements Flesch-Kincaid and other readability metrics for plain language compliance

interface ReadabilityMetrics {
  fleschKincaidGrade: number;
  fleschReadingEase: number;
  averageWordsPerSentence: number;
  averageSyllablesPerWord: number;
  isPlainLanguage: boolean;
  suggestions: string[];
}

export class ReadingLevelService {
  private static instance: ReadingLevelService;

  public static getInstance(): ReadingLevelService {
    if (!ReadingLevelService.instance) {
      ReadingLevelService.instance = new ReadingLevelService();
    }
    return ReadingLevelService.instance;
  }

  // Count syllables in a word using vowel counting approach
  private countSyllables(word: string): number {
    word = word.toLowerCase();
    if (word.length <= 3) return 1;
    
    // Remove common endings that don't add syllables
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
    word = word.replace(/^y/, '');
    
    // Count vowel groups
    const syllableMatches = word.match(/[aeiouy]{1,2}/g);
    const syllables = syllableMatches ? syllableMatches.length : 1;
    
    return syllables;
  }

  // Count sentences using multiple sentence-ending punctuation
  private countSentences(text: string): number {
    const sentences = text.match(/[.!?]+/g);
    return sentences ? sentences.length : 1;
  }

  // Calculate readability metrics
  public assessReadability(text: string): ReadabilityMetrics {
    // Basic text cleaning
    const cleanText = text.replace(/[^\w\s.!?]/g, ' ').trim();
    if (!cleanText) {
      return this.getDefaultMetrics();
    }

    // Count words, sentences, and syllables
    const words = cleanText.split(/\s+/).filter(word => word.length > 0);
    const wordCount = words.length;
    const sentenceCount = this.countSentences(cleanText);
    const syllableCount = words.reduce((total, word) => total + this.countSyllables(word), 0);

    if (wordCount === 0 || sentenceCount === 0) {
      return this.getDefaultMetrics();
    }

    // Calculate averages
    const averageWordsPerSentence = wordCount / sentenceCount;
    const averageSyllablesPerWord = syllableCount / wordCount;

    // Flesch-Kincaid Grade Level
    const fleschKincaidGrade = 0.39 * averageWordsPerSentence + 11.8 * averageSyllablesPerWord - 15.59;

    // Flesch Reading Ease Score
    const fleschReadingEase = 206.835 - 1.015 * averageWordsPerSentence - 84.6 * averageSyllablesPerWord;

    // Determine if it meets plain language criteria (Grade 6-8 = 6.0-8.99)
    const isPlainLanguage = fleschKincaidGrade >= 6.0 && fleschKincaidGrade <= 8.99;

    // Generate improvement suggestions
    const suggestions = this.generateSuggestions(
      fleschKincaidGrade,
      averageWordsPerSentence,
      averageSyllablesPerWord,
      words
    );

    return {
      fleschKincaidGrade: Math.round(fleschKincaidGrade * 10) / 10,
      fleschReadingEase: Math.round(fleschReadingEase),
      averageWordsPerSentence: Math.round(averageWordsPerSentence * 10) / 10,
      averageSyllablesPerWord: Math.round(averageSyllablesPerWord * 100) / 100,
      isPlainLanguage,
      suggestions
    };
  }

  private getDefaultMetrics(): ReadabilityMetrics {
    return {
      fleschKincaidGrade: 8.0,
      fleschReadingEase: 65,
      averageWordsPerSentence: 15,
      averageSyllablesPerWord: 1.5,
      isPlainLanguage: true,
      suggestions: []
    };
  }

  private generateSuggestions(
    gradeLevel: number,
    wordsPerSentence: number,
    syllablesPerWord: number,
    words: string[]
  ): string[] {
    const suggestions: string[] = [];

    // Grade level too high
    if (gradeLevel > 9) {
      suggestions.push("Use shorter sentences and simpler words");
    }
    if (gradeLevel > 12) {
      suggestions.push("This text is at college level - simplify significantly for SNAP users");
    }

    // Grade level too low
    if (gradeLevel < 6) {
      suggestions.push("Content may be too simple - ensure it provides complete information");
    }

    // Sentence length issues
    if (wordsPerSentence > 20) {
      suggestions.push("Break up long sentences (currently averaging " + Math.round(wordsPerSentence) + " words per sentence)");
    }
    if (wordsPerSentence < 8) {
      suggestions.push("Consider combining some very short sentences for better flow");
    }

    // Complex words
    if (syllablesPerWord > 1.8) {
      suggestions.push("Replace complex words with simpler alternatives where possible");
    }

    // Specific complex words to flag
    const complexWords = words.filter(word => this.countSyllables(word) > 3);
    if (complexWords.length > words.length * 0.1) {
      const uniqueComplexWords = Array.from(new Set(complexWords));
      suggestions.push("Consider simpler alternatives for words like: " + 
        uniqueComplexWords.slice(0, 3).join(", "));
    }

    return suggestions;
  }

  // Improve text to meet plain language standards
  public async improveForPlainLanguage(text: string, targetGrade: number = 7): Promise<string> {
    const metrics = this.assessReadability(text);
    
    if (metrics.isPlainLanguage && Math.abs(metrics.fleschKincaidGrade - targetGrade) < 1) {
      return text; // Already meets standards
    }

    // Apply basic improvements
    let improvedText = text;

    // Break up long sentences (simple approach)
    if (metrics.averageWordsPerSentence > 20) {
      improvedText = improvedText.replace(/,\s+and\s+/g, '. ');
      improvedText = improvedText.replace(/;\s+/g, '. ');
    }

    // Replace common complex words with simpler alternatives
    const replacements = {
      'utilize': 'use',
      'demonstrate': 'show',
      'assistance': 'help',
      'requirement': 'need',
      'eligibility': 'qualify',
      'documentation': 'documents',
      'verification': 'proof',
      'additional': 'more',
      'participate': 'take part',
      'approximately': 'about',
      'individuals': 'people',
      'household': 'family',
      'obtain': 'get',
      'provide': 'give',
      'receive': 'get'
    };

    Object.entries(replacements).forEach(([complex, simple]) => {
      const regex = new RegExp(`\\b${complex}\\b`, 'gi');
      improvedText = improvedText.replace(regex, simple);
    });

    return improvedText;
  }

  // Validate that AI responses meet reading level requirements
  public validateResponse(response: string): { isValid: boolean; metrics: ReadabilityMetrics } {
    const metrics = this.assessReadability(response);
    const isValid = metrics.isPlainLanguage;
    
    return { isValid, metrics };
  }
}