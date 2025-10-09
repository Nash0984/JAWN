import { GoogleGenAI } from "@google/genai";

// Using Gemini for all AI operations
let gemini: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (!gemini) {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY or GEMINI_API_KEY environment variable is required');
    }
    gemini = new GoogleGenAI({ apiKey });
  }
  return gemini;
}

export interface ModelPerformanceMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  confusionMatrix?: number[][];
}

export interface TrainingMetrics {
  epoch: number;
  loss: number;
  accuracy: number;
  valLoss: number;
  valAccuracy: number;
  learningRate: number;
}

class AIService {
  async analyzeDocumentForFieldExtraction(text: string, documentType: string) {
    try {
      const prompt = `You are an AI assistant specialized in extracting structured information from government publications, with an emphasis on public benefit programs and federal and state EITC and CTC
      
      For the document type "${documentType}", extract relevant fields such as:
      - Eligibility requirements
      - Income limits
      - Asset limits
      - Application deadlines
      - Contact information
      - Effective dates
      - Program codes
      - Geographic restrictions
      
      Respond with JSON containing the extracted fields and their values.
      Use null for fields that cannot be determined.
      
      Format: {
        "eligibilityRequirements": ["req1", "req2"],
        "incomeLimits": {"1person": "amount", "2person": "amount"},
        "assetLimits": "amount",
        "applicationDeadline": "date or null",
        "effectiveDate": "date or null",
        "contactInfo": {"phone": "number", "website": "url"},
        "programCodes": ["code1", "code2"],
        "geographicScope": "federal|state|local|specific location",
        "confidence": number
      }
      
      Document text: ${text}`;
      
      const ai = getGemini();
      const response = await ai.models.generateContent({
        model: "gemini-1.5-pro",
        contents: prompt
      });
      
      return JSON.parse(response.text || "{}");
    } catch (error) {
      console.error("Field extraction error:", error);
      return { error: "Failed to extract fields", confidence: 0 };
    }
  }

  async generateDocumentSummary(text: string, maxLength: number = 200) {
    try {
      const prompt = `Summarize the following government benefits document in ${maxLength} words or less.
      Focus on:
      - Main purpose of the document
      - Key eligibility requirements
      - Important dates or deadlines
      - Primary benefit amounts or limits
      - Application process overview
      
      Make the summary clear and actionable for benefits administrators.
      
      Document text: ${text}`;
      
      const ai = getGemini();
      const response = await ai.models.generateContent({
        model: "gemini-1.5-pro",
        contents: prompt
      });
      
      return response.text || "Summary generation failed";
    } catch (error) {
      console.error("Summary generation error:", error);
      return "Summary generation failed";
    }
  }

  async detectDocumentChanges(oldText: string, newText: string) {
    try {
      const prompt = `You are comparing two versions of a government benefits document to identify changes.
      
      Analyze the differences and categorize them as:
      - POLICY_CHANGE: Changes to eligibility, benefits amounts, or requirements
      - PROCEDURAL_CHANGE: Changes to application or administrative processes
      - DATE_CHANGE: Updates to effective dates or deadlines  
      - CONTACT_CHANGE: Updates to contact information
      - FORMATTING_CHANGE: Minor formatting or structural changes
      - OTHER: Any other type of change
      
      Respond with JSON:
      {
        "hasChanges": boolean,
        "changesSummary": "brief description of main changes",
        "changes": [
          {
            "type": "POLICY_CHANGE|PROCEDURAL_CHANGE|etc",
            "description": "specific change description",
            "oldValue": "previous value or null",
            "newValue": "new value or null",
            "impact": "HIGH|MEDIUM|LOW"
          }
        ],
        "recommendedActions": ["action1", "action2"]
      }
      
      OLD VERSION:
      ${oldText}
      
      NEW VERSION:
      ${newText}`;
      
      const ai = getGemini();
      const response = await ai.models.generateContent({
        model: "gemini-1.5-pro",
        contents: prompt
      });
      
      return JSON.parse(response.text || "{}");
    } catch (error) {
      console.error("Change detection error:", error);
      return { 
        hasChanges: false, 
        changesSummary: "Change detection failed",
        changes: [],
        recommendedActions: []
      };
    }
  }

  async validateDocumentCompliance(text: string, benefitProgram: string) {
    try {
      const prompt = `You are a compliance expert for government benefit programs.
      
      Review the document for compliance with federal regulations for ${benefitProgram}.
      Check for:
      - Required legal language and disclaimers
      - Proper citation of relevant regulations
      - Accessibility requirements (plain language, reading level)
      - Non-discrimination clauses
      - Appeal rights information
      - Privacy notices
      - Reasonable accommodation information
      
      Respond with JSON:
      {
        "complianceScore": number (0-1),
        "passedChecks": ["check1", "check2"],
        "failedChecks": ["check1", "check2"], 
        "warnings": ["warning1", "warning2"],
        "requiredAdditions": ["addition1", "addition2"],
        "overallAssessment": "COMPLIANT|NON_COMPLIANT|NEEDS_REVIEW"
      }
      
      Document text: ${text}`;
      
      const ai = getGemini();
      const response = await ai.models.generateContent({
        model: "gemini-1.5-pro",
        contents: prompt
      });
      
      return JSON.parse(response.text || "{}");
    } catch (error) {
      console.error("Compliance validation error:", error);
      return {
        complianceScore: 0.5,
        passedChecks: [],
        failedChecks: ["Validation failed"],
        warnings: ["Unable to complete compliance check"],
        requiredAdditions: [],
        overallAssessment: "NEEDS_REVIEW"
      };
    }
  }

  async generateTrainingData(documents: string[], labels: string[]) {
    // This would implement automated training data generation
    // for fine-tuning models on specific benefit programs
    
    try {
      const trainingExamples = [];
      
      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        const label = labels[i];
        
        // Generate variations and synthetic examples
        const prompt = `Generate 3 variations of the following document that maintain the same classification label "${label}".
        Vary the language while preserving the key information and intent.
        
        Respond with JSON:
        {
          "variations": [
            {"text": "variation1", "label": "${label}"},
            {"text": "variation2", "label": "${label}"},
            {"text": "variation3", "label": "${label}"}
          ]
        }
        
        Original document: ${doc}`;
        
        const ai = getGemini();
        const response = await ai.models.generateContent({
          model: "gemini-1.5-pro",
          contents: prompt
        });
        
        const result = JSON.parse(response.text || "{}");
        if (result.variations) {
          trainingExamples.push(...result.variations);
        }
      }
      
      return trainingExamples;
    } catch (error) {
      console.error("Training data generation error:", error);
      return [];
    }
  }

  async evaluateModelPerformance(predictions: any[], groundTruth: any[]): Promise<ModelPerformanceMetrics> {
    if (predictions.length !== groundTruth.length) {
      throw new Error("Predictions and ground truth arrays must have the same length");
    }

    let correct = 0;
    const classCount = new Map<string, { tp: number, fp: number, fn: number }>();

    // Initialize class counters
    for (const truth of groundTruth) {
      if (!classCount.has(truth)) {
        classCount.set(truth, { tp: 0, fp: 0, fn: 0 });
      }
    }

    // Calculate confusion matrix elements
    for (let i = 0; i < predictions.length; i++) {
      const pred = predictions[i];
      const truth = groundTruth[i];
      
      if (pred === truth) {
        correct++;
        classCount.get(truth)!.tp++;
      } else {
        classCount.get(truth)!.fn++;
        if (!classCount.has(pred)) {
          classCount.set(pred, { tp: 0, fp: 0, fn: 0 });
        }
        classCount.get(pred)!.fp++;
      }
    }

    const accuracy = correct / predictions.length;
    
    // Calculate macro averages
    let totalPrecision = 0;
    let totalRecall = 0;
    let validClasses = 0;

    for (const [className, counts] of Array.from(classCount.entries())) {
      const precision = counts.tp / (counts.tp + counts.fp) || 0;
      const recall = counts.tp / (counts.tp + counts.fn) || 0;
      
      if (counts.tp + counts.fp > 0 || counts.tp + counts.fn > 0) {
        totalPrecision += precision;
        totalRecall += recall;
        validClasses++;
      }
    }

    const avgPrecision = validClasses > 0 ? totalPrecision / validClasses : 0;
    const avgRecall = validClasses > 0 ? totalRecall / validClasses : 0;
    const f1Score = (avgPrecision + avgRecall) > 0 ? 2 * (avgPrecision * avgRecall) / (avgPrecision + avgRecall) : 0;

    return {
      accuracy,
      precision: avgPrecision,
      recall: avgRecall,
      f1Score,
    };
  }

  async generateModelReport(modelType: string, metrics: ModelPerformanceMetrics, trainingHistory: TrainingMetrics[]) {
    try {
      const prompt = `Generate a comprehensive model performance report for a ${modelType} model.
      
      Include:
      - Performance summary and key metrics analysis
      - Training progress assessment
      - Recommendations for improvement
      - Production readiness assessment
      - Potential issues or concerns
      
      Use clear, technical language appropriate for ML engineers and data scientists.
      
      Model Performance Metrics:
      Accuracy: ${metrics.accuracy.toFixed(3)}
      Precision: ${metrics.precision.toFixed(3)}
      Recall: ${metrics.recall.toFixed(3)}
      F1 Score: ${metrics.f1Score.toFixed(3)}
      
      Training History (last 5 epochs):
      ${trainingHistory.slice(-5).map(h => 
        `Epoch ${h.epoch}: Loss=${h.loss.toFixed(3)}, Acc=${h.accuracy.toFixed(3)}, Val_Loss=${h.valLoss.toFixed(3)}, Val_Acc=${h.valAccuracy.toFixed(3)}`
      ).join('\n')}`;
      
      const ai = getGemini();
      const response = await ai.models.generateContent({
        model: "gemini-1.5-pro",
        contents: prompt
      });
      
      return response.text || "Report generation failed";
    } catch (error) {
      console.error("Model report generation error:", error);
      return "Failed to generate model report";
    }
  }
}

export const aiService = new AIService();
