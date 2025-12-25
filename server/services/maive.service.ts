/**
 * MAIVE - AI Validation Engine
 * 
 * An LLM-as-Judge framework for validating AI responses against ground truth.
 * Uses Gemini to evaluate accuracy of benefit calculations, policy interpretations,
 * and document extractions with 95%+ accuracy gates.
 * 
 * Generic name for white-labeling to other states.
 */

import { GoogleGenAI } from '@google/genai';
import { nanoid } from 'nanoid';
import type { IStorage } from '../storage';
import { db } from '../db';
import { maiveTestCases, maiveEvaluations, maiveTestRuns } from '@shared/schema';
import { eq, desc, and, gte } from 'drizzle-orm';
import { logger } from './logger.service';

interface TestCase {
  id: string;
  name: string;
  category: 'benefit_calculation' | 'policy_interpretation' | 'document_extraction' | 'eligibility_determination' | 'work_requirements';
  scenario: string;
  inputs: Record<string, any>;
  expectedOutput: Record<string, any>;
  accuracyThreshold: number;
  stateSpecific?: string; // e.g., "MD", "CA", "TX"
  tags: string[];
}

interface EvaluationResult {
  testCaseId: string;
  testRunId: string;
  actualOutput: Record<string, any>;
  accuracy: number;
  passed: boolean;
  reasoning: string;
  deviations: string[];
  executionTime: number;
  llmJudgment: string;
}

interface TestRun {
  id: string;
  name: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  overallAccuracy: number;
  state?: string;
  startedAt: Date;
  completedAt?: Date;
}

export class MAIVEService {
  private gemini: GoogleGenAI | null = null;
  private storage: IStorage;
  private useMockJudge: boolean = false;

  constructor(storage: IStorage) {
    this.storage = storage;
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      logger.warn('⚠️ MAIVE: No Gemini API key found. Using mock judge for development.', {
        service: 'MAIVE'
      });
      this.useMockJudge = true;
    } else {
      this.gemini = new GoogleGenAI({ 
        apiKey: apiKey 
      });
    }
  }

  /**
   * Create a new test case
   */
  async createTestCase(testCase: Omit<TestCase, 'id'>): Promise<TestCase> {
    const id = nanoid();
    
    await db.insert(maiveTestCases).values({
      id,
      name: testCase.name,
      category: testCase.category,
      scenario: testCase.scenario,
      inputs: testCase.inputs,
      expectedOutput: testCase.expectedOutput,
      accuracyThreshold: testCase.accuracyThreshold,
      stateSpecific: testCase.stateSpecific,
      tags: testCase.tags,
      isActive: true,
      createdAt: new Date(),
    });

    return { id, ...testCase };
  }

  /**
   * Run evaluation on a single test case
   */
  async evaluateTestCase(
    testCaseId: string,
    testRunId: string,
    systemUnderTest: (inputs: Record<string, any>) => Promise<Record<string, any>>
  ): Promise<EvaluationResult> {
    const startTime = Date.now();
    
    // Get test case
    const testCase = await db.query.maiveTestCases.findFirst({
      where: eq(maiveTestCases.id, testCaseId)
    });

    if (!testCase) {
      throw new Error(`Test case ${testCaseId} not found`);
    }

    // Execute system under test
    const actualOutput = await systemUnderTest(testCase.inputs);
    const executionTime = Date.now() - startTime;

    // Use Gemini as judge to evaluate the output
    const evaluation = await this.judgeWithLLM(
      testCase.scenario,
      testCase.inputs,
      testCase.expectedOutput,
      actualOutput,
      testCase.stateSpecific
    );

    // Calculate accuracy score
    const accuracy = this.calculateAccuracy(
      testCase.expectedOutput,
      actualOutput,
      evaluation.fieldScores
    );

    const passed = accuracy >= testCase.accuracyThreshold;
    
    // Store evaluation result
    const evaluationId = nanoid();
    await db.insert(maiveEvaluations).values({
      id: evaluationId,
      testCaseId,
      testRunId,
      actualOutput,
      expectedOutput: testCase.expectedOutput,
      accuracy,
      passed,
      reasoning: evaluation.reasoning,
      deviations: evaluation.deviations,
      executionTime,
      llmJudgment: evaluation.judgment,
      evaluatedAt: new Date(),
    });

    return {
      testCaseId,
      testRunId,
      actualOutput,
      accuracy,
      passed,
      reasoning: evaluation.reasoning,
      deviations: evaluation.deviations,
      executionTime,
      llmJudgment: evaluation.judgment,
    };
  }

  /**
   * Mock judge for development without Gemini API key
   */
  private async mockJudge(
    scenario: string,
    inputs: Record<string, any>,
    expectedOutput: Record<string, any>,
    actualOutput: Record<string, any>,
    stateSpecific?: string
  ): Promise<{
    judgment: string;
    reasoning: string;
    deviations: string[];
    fieldScores: Record<string, number>;
  }> {
    const fieldScores: Record<string, number> = {};
    const deviations: string[] = [];
    
    // Compare each field
    for (const key of Object.keys(expectedOutput)) {
      const expected = expectedOutput[key];
      const actual = actualOutput[key];
      
      if (actual === undefined) {
        fieldScores[key] = 0;
        deviations.push(`Missing field: ${key}`);
      } else if (typeof expected === 'number' && typeof actual === 'number') {
        const tolerance = Math.abs(expected * 0.02);
        if (Math.abs(expected - actual) <= tolerance) {
          fieldScores[key] = 1.0;
        } else {
          fieldScores[key] = Math.max(0, 1 - Math.abs(expected - actual) / expected);
          deviations.push(`${key}: expected ${expected}, got ${actual}`);
        }
      } else if (JSON.stringify(expected) === JSON.stringify(actual)) {
        fieldScores[key] = 1.0;
      } else {
        fieldScores[key] = 0.5;
        deviations.push(`${key}: values don't match`);
      }
    }
    
    const avgScore = Object.values(fieldScores).reduce((a, b) => a + b, 0) / Object.values(fieldScores).length;
    
    return {
      fieldScores,
      deviations,
      reasoning: `Mock evaluation: Compared ${Object.keys(fieldScores).length} fields with average accuracy ${(avgScore * 100).toFixed(1)}%`,
      judgment: avgScore >= 0.95 ? "PASS" : avgScore >= 0.8 ? "NEEDS_REVIEW" : "FAIL"
    };
  }

  /**
   * Use Gemini to judge the output quality
   */
  private async judgeWithLLM(
    scenario: string,
    inputs: Record<string, any>,
    expectedOutput: Record<string, any>,
    actualOutput: Record<string, any>,
    stateSpecific?: string
  ): Promise<{
    judgment: string;
    reasoning: string;
    deviations: string[];
    fieldScores: Record<string, number>;
  }> {
    // Use mock judge if no API key
    if (this.useMockJudge) {
      return this.mockJudge(scenario, inputs, expectedOutput, actualOutput, stateSpecific);
    }
    
    const stateContext = stateSpecific ? 
      `This test is specific to ${stateSpecific} state policies and regulations.` : 
      'This test applies to general federal policies.';

    const prompt = `You are an expert judge evaluating AI system outputs for accuracy in benefits determination.

${stateContext}

## Scenario
${scenario}

## Input Data
${JSON.stringify(inputs, null, 2)}

## Expected Output (Ground Truth)
${JSON.stringify(expectedOutput, null, 2)}

## Actual Output (System Under Test)
${JSON.stringify(actualOutput, null, 2)}

## Evaluation Task
Compare the actual output against the expected output and provide:

1. **Field-by-field accuracy scores** (0.0 to 1.0):
   - Exact matches get 1.0
   - Close approximations (within 2% for numbers) get 0.95
   - Correct logic but different format gets 0.9
   - Partially correct gets 0.5-0.8
   - Incorrect gets 0.0

2. **Critical deviations** that would impact real users

3. **Overall judgment** on whether this output is acceptable for production use

Format your response as JSON:
{
  "fieldScores": {
    "fieldName1": 0.95,
    "fieldName2": 1.0,
    ...
  },
  "deviations": [
    "Description of critical deviation 1",
    "Description of critical deviation 2"
  ],
  "reasoning": "Detailed explanation of the evaluation",
  "judgment": "PASS" or "FAIL" or "NEEDS_REVIEW"
}`;

    const result = await this.gemini.models.generateContent({
      model: 'gemini-1.5-pro',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        temperature: 0.1,
        maxOutputTokens: 8192,
      }
    });
    const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse LLM judgment response');
    }

    return JSON.parse(jsonMatch[0]);
  }

  /**
   * Calculate overall accuracy score (returns 0-1 scale)
   */
  private calculateAccuracy(
    expected: Record<string, any>,
    actual: Record<string, any>,
    fieldScores: Record<string, number>
  ): number {
    const scores = Object.values(fieldScores);
    if (scores.length === 0) {
      // Fallback to simple comparison (already returns 0-1)
      return this.simpleAccuracy(expected, actual);
    }
    
    // Weighted average based on field importance (keep 0-1 scale)
    const sum = scores.reduce((acc, score) => acc + score, 0);
    return sum / scores.length;
  }

  /**
   * Simple accuracy calculation fallback (returns 0-1 scale)
   */
  private simpleAccuracy(expected: Record<string, any>, actual: Record<string, any>): number {
    const expectedKeys = Object.keys(expected);
    const matches = expectedKeys.filter(key => {
      const expectedVal = expected[key];
      const actualVal = actual[key];
      
      // Number comparison with tolerance
      if (typeof expectedVal === 'number' && typeof actualVal === 'number') {
        const tolerance = Math.abs(expectedVal * 0.02); // 2% tolerance
        return Math.abs(expectedVal - actualVal) <= tolerance;
      }
      
      // String comparison
      if (typeof expectedVal === 'string' && typeof actualVal === 'string') {
        return expectedVal.toLowerCase() === actualVal.toLowerCase();
      }
      
      // Boolean comparison
      if (typeof expectedVal === 'boolean') {
        return expectedVal === actualVal;
      }
      
      // Object/Array comparison (deep)
      return JSON.stringify(expectedVal) === JSON.stringify(actualVal);
    });

    return matches.length / expectedKeys.length; // Return 0-1 scale
  }

  /**
   * Run a complete test suite
   */
  async runTestSuite(
    suiteName: string,
    testCaseIds: string[],
    systemUnderTest: (inputs: Record<string, any>) => Promise<Record<string, any>>,
    state?: string
  ): Promise<TestRun> {
    const testRunId = nanoid();
    const startedAt = new Date();

    // Create test run record
    await db.insert(maiveTestRuns).values({
      id: testRunId,
      name: suiteName,
      totalTests: testCaseIds.length,
      passedTests: 0,
      failedTests: 0,
      overallAccuracy: 0,
      status: 'running',
      state,
      startedAt,
    });

    let passedTests = 0;
    let totalAccuracy = 0;
    const results: EvaluationResult[] = [];

    // Run each test case
    for (const testCaseId of testCaseIds) {
      try {
        const result = await this.evaluateTestCase(
          testCaseId,
          testRunId,
          systemUnderTest
        );
        
        results.push(result);
        if (result.passed) {
          passedTests++;
        }
        totalAccuracy += result.accuracy;
      } catch (error) {
        logger.error('Error evaluating test case', {
          error: error instanceof Error ? error.message : String(error),
          testCaseId,
          service: 'MAIVE'
        });
        // Count as failed
        results.push({
          testCaseId,
          testRunId,
          actualOutput: {},
          accuracy: 0,
          passed: false,
          reasoning: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          deviations: ['Test execution failed'],
          executionTime: 0,
          llmJudgment: 'FAIL',
        });
      }
    }

    const failedTests = testCaseIds.length - passedTests;
    const overallAccuracy = totalAccuracy / testCaseIds.length;
    const completedAt = new Date();

    // Update test run record
    await db.update(maiveTestRuns)
      .set({
        passedTests,
        failedTests,
        overallAccuracy,
        status: overallAccuracy >= 95 ? 'passed' : 'failed',
        completedAt,
      })
      .where(eq(maiveTestRuns.id, testRunId));

    return {
      id: testRunId,
      name: suiteName,
      totalTests: testCaseIds.length,
      passedTests,
      failedTests,
      overallAccuracy,
      state,
      startedAt,
      completedAt,
    };
  }

  /**
   * Get test results for a specific run
   */
  async getTestRunResults(testRunId: string): Promise<{
    run: TestRun;
    evaluations: EvaluationResult[];
  }> {
    const run = await db.query.maiveTestRuns.findFirst({
      where: eq(maiveTestRuns.id, testRunId)
    });

    if (!run) {
      throw new Error(`Test run ${testRunId} not found`);
    }

    const evaluations = await db.query.maiveEvaluations.findMany({
      where: eq(maiveEvaluations.testRunId, testRunId),
      orderBy: [desc(maiveEvaluations.evaluatedAt)]
    });

    return {
      run: {
        id: run.id,
        name: run.name,
        totalTests: run.totalTests,
        passedTests: run.passedTests,
        failedTests: run.failedTests,
        overallAccuracy: run.overallAccuracy,
        state: run.state || undefined,
        startedAt: run.startedAt,
        completedAt: run.completedAt || undefined,
      },
      evaluations: evaluations.map(e => ({
        testCaseId: e.testCaseId,
        testRunId: e.testRunId,
        actualOutput: e.actualOutput,
        accuracy: e.accuracy,
        passed: e.passed,
        reasoning: e.reasoning,
        deviations: e.deviations,
        executionTime: e.executionTime,
        llmJudgment: e.llmJudgment,
      })),
    };
  }

  /**
   * Get recent test runs
   */
  async getRecentTestRuns(limit = 10, state?: string): Promise<TestRun[]> {
    const conditions = state ? 
      and(eq(maiveTestRuns.state, state), gte(maiveTestRuns.overallAccuracy, 0)) :
      gte(maiveTestRuns.overallAccuracy, 0);

    const runs = await db.query.maiveTestRuns.findMany({
      where: conditions,
      orderBy: [desc(maiveTestRuns.startedAt)],
      limit
    });

    return runs.map(run => ({
      id: run.id,
      name: run.name,
      totalTests: run.totalTests,
      passedTests: run.passedTests,
      failedTests: run.failedTests,
      overallAccuracy: run.overallAccuracy,
      state: run.state || undefined,
      startedAt: run.startedAt,
      completedAt: run.completedAt || undefined,
    }));
  }

  /**
   * Get accuracy trends over time
   */
  async getAccuracyTrends(days = 30, state?: string): Promise<{
    date: string;
    avgAccuracy: number;
    testCount: number;
  }[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const conditions = state ?
      and(
        gte(maiveTestRuns.startedAt, startDate),
        eq(maiveTestRuns.state, state)
      ) :
      gte(maiveTestRuns.startedAt, startDate);

    const runs = await db.query.maiveTestRuns.findMany({
      where: conditions,
      orderBy: [desc(maiveTestRuns.startedAt)]
    });

    // Group by date
    const trendMap = new Map<string, { total: number; count: number }>();
    
    runs.forEach(run => {
      const date = run.startedAt.toISOString().split('T')[0];
      const existing = trendMap.get(date) || { total: 0, count: 0 };
      trendMap.set(date, {
        total: existing.total + run.overallAccuracy,
        count: existing.count + 1,
      });
    });

    // Convert to array and calculate averages
    return Array.from(trendMap.entries())
      .map(([date, data]) => ({
        date,
        avgAccuracy: data.total / data.count,
        testCount: data.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}