import { logger } from './logger.service';
import { aiOrchestrator } from './aiOrchestrator';

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
    return aiOrchestrator.analyzeDocumentForFieldExtraction(text, documentType, {
      feature: 'document_field_extraction',
      priority: 'normal'
    });
  }

  async generateDocumentSummary(text: string, maxLength: number = 200) {
    return aiOrchestrator.generateDocumentSummary(text, maxLength, {
      feature: 'document_summarization',
      priority: 'normal'
    });
  }

  async detectDocumentChanges(oldText: string, newText: string) {
    return aiOrchestrator.detectDocumentChanges(oldText, newText, {
      feature: 'document_change_detection',
      priority: 'background'
    });
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
      
      const response = await aiOrchestrator.generateText(prompt, {
        feature: 'document_compliance',
        priority: 'normal'
      });
      
      return JSON.parse(response || "{}");
    } catch (error) {
      logger.error("Compliance validation error", {
        service: 'AIService',
        method: 'validateDocumentCompliance',
        error: error instanceof Error ? error.message : 'Unknown error',
        benefitProgram
      });
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
    try {
      const trainingExamples = [];
      
      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        const label = labels[i];
        
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
        
        const response = await aiOrchestrator.generateText(prompt, {
          feature: 'training_data_generation',
          priority: 'background'
        });
        
        const result = JSON.parse(response || "{}");
        if (result.variations) {
          trainingExamples.push(...result.variations);
        }
      }
      
      return trainingExamples;
    } catch (error) {
      logger.error("Training data generation error", {
        service: 'AIService',
        method: 'generateTrainingData',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
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
      
      return await aiOrchestrator.generateText(prompt, {
        feature: 'model_report_generation',
        priority: 'background'
      });
    } catch (error) {
      logger.error("Model report generation error", {
        service: 'AIService',
        method: 'generateModelReport',
        error: error instanceof Error ? error.message : 'Unknown error',
        modelType
      });
      return "Failed to generate model report";
    }
  }
}

export const aiService = new AIService();
