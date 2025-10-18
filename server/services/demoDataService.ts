import fs from 'fs';
import path from 'path';

// Type definitions for all demo data - based on actual demo data structure
interface DemoHousehold {
  id: string;
  name: string;
  type: string;
  county: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  members: Array<{
    id: string;
    firstName: string;
    lastName: string;
    ssn: string;
    dob: string;
    relationship: string;
    age: number;
    disabled: boolean;
    student: boolean;
    employed: boolean;
  }>;
  income: {
    earned: Array<{
      source: string;
      amount: number;
      frequency: string;
      verified: boolean;
    }>;
    unearned: any[];
    totalMonthly: number;
    totalAnnual: number;
  };
  expenses: {
    rent?: number;
    utilities?: number;
    medical?: number;
    childcare?: number;
    totalMonthly: number;
  };
  demographics: {
    race: string;
    language: string;
    citizenship: string;
  };
}

interface DemoBenefitCalculation {
  id: string;
  householdId: string;
  program: 'SNAP' | 'Medicaid' | 'TANF' | 'OHEP';
  calculationDate: string;
  status: string;
  grossIncome: number;
  netIncome: number;
  householdSize: number;
  incomeLimits: {
    gross: number;
    net: number;
    elderlyDisabledExemption?: string;
  };
  deductions: {
    standardDeduction: number;
    earnedIncomeDeduction: number;
    dependentCareDeduction: number;
    medicalDeduction: number;
    excessShelterDeduction: number;
  };
  benefitAmount: number;
  maximumAllotment: number;
  certificationPeriod: string;
  reviewDate: string;
  notes: string;
}

interface DemoTaxReturn {
  id: string;
  householdId: string;
  taxYear: number;
  filingStatus: string;
  formType: string;
  state: string;
  preparationDate: string;
  filedDate: string;
  preparedBy: string;
  qualityReviewed: boolean;
  reviewedBy: string;
  income: {
    wages: number;
    interest: number;
    dividends: number;
    capitalGains: number;
    totalIncome: number;
    agi: number;
  };
  deductions: {
    standardDeduction: number;
    itemizedDeduction: number;
    qbiDeduction: number;
  };
  taxableIncome: number;
  federalTax: {
    taxBeforeCredits: number;
    eitc: number;
    ctc: number;
    actc: number;
    otherCredits: number;
    totalCredits: number;
    taxOwed: number;
    refund: number;
  };
  stateTax: {
    marylandTaxBeforeCredits: number;
    marylandEitc: number;
    marylandCtc: number;
    totalCredits: number;
    taxOwed: number;
    refund: number;
  };
  totalRefund: number;
  w2Forms: string[];
  dependents: Array<{
    name: string;
    ssn: string;
    relationship: string;
    age: number;
  }>;
  notes: string;
}

interface DemoDocument {
  id: string;
  householdId: string;
  type: string;
  classification: string;
  fileName: string;
  uploadDate: string;
  status: 'pending' | 'verified' | 'rejected';
  verifiedBy?: string;
  verifiedDate?: string;
  ocrExtraction: any;
  notes: string;
}

interface DemoAIMessage {
  timestamp: string;
  role: 'user' | 'assistant';
  content: string;
  context?: any;
  policyCitation?: any;
}

interface DemoAIConversation {
  id: string;
  type: string;
  householdId?: string;
  userId: string;
  startTime: string;
  endTime?: string;
  language: string;
  program?: string;
  status: string;
  messages: DemoAIMessage[];
  summary?: string;
  dataExtracted?: any;
}

interface DemoAppointment {
  id: string;
  householdId: string;
  taxpayerId?: string | null;
  navigatorId: string;
  type: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show';
  siteName: string;
  siteAddress: string;
  appointmentDate: string;
  duration: number;
  taxYear?: number;
  services: string[];
  documentsRequired: string[];
  documentsReceived: string[];
  qualityReviewed: boolean;
  reviewedBy: string;
  returnEfiled?: boolean;
  efileDate?: string;
  estimatedRefund?: number;
  notes: string;
}

interface DemoPolicySource {
  id: string;
  category: string;
  title: string;
  citation: string;
  agency: string;
  effectiveDate: string;
  excerpt: string;
  url: string;
  keyProvisions: string[];
  lastUpdated: string;
  status: string;
}

interface DemoUser {
  id: string;
  username: string;
  role: string;
  name: string;
  email?: string | null;
  phone?: string;
  department?: string | null;
  county?: string | null;
  organization?: string;
  householdId?: string;
  vitaCertification?: {
    certified: boolean;
    level: string;
    certificationDate: string;
    expirationDate: string;
    specialties: string[];
  };
  permissions: string[];
  created: string;
  lastLogin?: string | null;
  status: string;
  preferredLanguage?: string;
  communicationPreference?: string;
  notes: string;
}

interface DemoMetrics {
  platformPerformance: {
    captureDate: string;
    period: string;
    apiResponseTimes: {
      overall: {
        p50: number;
        p95: number;
        p99: number;
        unit: string;
      };
      byEndpoint: Record<string, {
        p50: number;
        p95: number;
        p99: number;
        avgCalls: number;
        unit: string;
      }>;
    };
    cacheHitRates: {
      overall: number;
      byCache: Record<string, {
        hitRate: number;
        hits: number;
        misses: number;
        totalRequests: number;
        avgHitTime: number;
        avgMissTime: number;
        unit: string;
      }>;
    };
    databasePerformance: {
      avgQueryTime: number;
      slowestQueries: Array<{
        query: string;
        avgTime: number;
        count: number;
      }>;
      connectionPoolUtilization: number;
      unit: string;
    };
    aiPerformance: {
      geminiApi: {
        avgResponseTime: number;
        p95ResponseTime: number;
        successRate: number;
        totalCalls: number;
        errorRate: number;
        unit: string;
      };
      ragService: {
        avgSearchTime: number;
        avgRelevanceScore: number;
        cacheHitRate: number;
        totalSearches: number;
        unit: string;
      };
    };
  };
  userActivity: {
    captureDate: string;
    period: string;
    activeUsers: {
      total: number;
      byRole: Record<string, number>;
    };
    sessionMetrics: {
      totalSessions: number;
      avgSessionDuration: number;
      unit: string;
    };
    featureUsage: Record<string, number>;
    topFeatures: Array<{
      feature: string;
      usage: number;
      percentOfTotal: number;
    }>;
  };
  benefitsImpact: {
    captureDate: string;
    period: string;
    applicationsProcessed: {
      total: number;
      byProgram: Record<string, number>;
    };
    eligibilityDeterminations: {
      total: number;
      approved: number;
      denied: number;
      pending: number;
    };
    estimatedBenefitsDelivered: {
      total: number;
      byProgram: Record<string, number>;
      unit: string;
    };
    taxReturnsProcessed: {
      total: number;
      totalRefunds: number;
      avgRefund: number;
      eitcClaimed: number;
      ctcClaimed: number;
      unit: string;
    };
  };
  systemHealth: {
    captureDate: string;
    uptime: number;
    errorRate: number;
    activeAlerts: number;
    deploymentVersion: string;
    lastDeployment: string;
  };
}

class DemoDataService {
  private households: DemoHousehold[] = [];
  private benefitCalculations: DemoBenefitCalculation[] = [];
  private taxReturns: DemoTaxReturn[] = [];
  private documents: DemoDocument[] = [];
  private aiConversations: DemoAIConversation[] = [];
  private appointments: DemoAppointment[] = [];
  private policySources: DemoPolicySource[] = [];
  private users: DemoUser[] = [];
  private metrics: DemoMetrics | null = null;
  private loaded = false;

  async loadDemoData(): Promise<void> {
    if (this.loaded) return;

    const demoDataPath = path.join(process.cwd(), 'demo-data');

    try {
      this.households = JSON.parse(
        fs.readFileSync(path.join(demoDataPath, 'households.json'), 'utf-8')
      );
      this.benefitCalculations = JSON.parse(
        fs.readFileSync(path.join(demoDataPath, 'benefit-calculations.json'), 'utf-8')
      );
      this.taxReturns = JSON.parse(
        fs.readFileSync(path.join(demoDataPath, 'tax-returns.json'), 'utf-8')
      );
      this.documents = JSON.parse(
        fs.readFileSync(path.join(demoDataPath, 'documents.json'), 'utf-8')
      );
      this.aiConversations = JSON.parse(
        fs.readFileSync(path.join(demoDataPath, 'ai-conversations.json'), 'utf-8')
      );
      this.appointments = JSON.parse(
        fs.readFileSync(path.join(demoDataPath, 'appointments.json'), 'utf-8')
      );
      this.policySources = JSON.parse(
        fs.readFileSync(path.join(demoDataPath, 'policy-sources.json'), 'utf-8')
      );
      this.users = JSON.parse(
        fs.readFileSync(path.join(demoDataPath, 'users.json'), 'utf-8')
      );
      this.metrics = JSON.parse(
        fs.readFileSync(path.join(demoDataPath, 'metrics.json'), 'utf-8')
      );

      this.loaded = true;
      console.log('[DemoDataService] Successfully loaded all demo data');
      console.log(`[DemoDataService] Loaded ${this.households.length} households`);
      console.log(`[DemoDataService] Loaded ${this.benefitCalculations.length} benefit calculations`);
      console.log(`[DemoDataService] Loaded ${this.taxReturns.length} tax returns`);
      console.log(`[DemoDataService] Loaded ${this.documents.length} documents`);
      console.log(`[DemoDataService] Loaded ${this.aiConversations.length} AI conversations`);
      console.log(`[DemoDataService] Loaded ${this.appointments.length} appointments`);
      console.log(`[DemoDataService] Loaded ${this.policySources.length} policy sources`);
      console.log(`[DemoDataService] Loaded ${this.users.length} users`);
    } catch (error) {
      console.error('[DemoDataService] Error loading demo data:', error);
      throw new Error('Failed to load demo data');
    }
  }

  // Household methods
  getAllHouseholds(): DemoHousehold[] {
    return this.households;
  }

  getHouseholdById(id: string): DemoHousehold | undefined {
    return this.households.find(h => h.id === id);
  }

  // Benefit calculation methods
  getBenefitCalculations(householdId?: string, program?: string): DemoBenefitCalculation[] {
    let results = this.benefitCalculations;
    if (householdId) {
      results = results.filter(b => b.householdId === householdId);
    }
    if (program) {
      results = results.filter(b => b.program === program);
    }
    return results;
  }

  // Tax return methods
  getTaxReturns(householdId?: string, taxYear?: number): DemoTaxReturn[] {
    let results = this.taxReturns;
    if (householdId) {
      results = results.filter(t => t.householdId === householdId);
    }
    if (taxYear) {
      results = results.filter(t => t.taxYear === taxYear);
    }
    return results;
  }

  // Document methods
  getDocuments(householdId?: string): DemoDocument[] {
    if (householdId) {
      return this.documents.filter(d => d.householdId === householdId);
    }
    return this.documents;
  }

  // AI conversation methods
  getAIConversations(feature?: string, language?: string): DemoAIConversation[] {
    let results = this.aiConversations;
    if (feature) {
      results = results.filter(c => c.type === feature);
    }
    if (language) {
      results = results.filter(c => c.language.toLowerCase() === language.toLowerCase());
    }
    return results;
  }

  getAIConversationById(id: string): DemoAIConversation | undefined {
    return this.aiConversations.find(c => c.id === id);
  }

  // Appointment methods
  getAppointments(householdId?: string): DemoAppointment[] {
    if (householdId) {
      return this.appointments.filter(a => a.householdId === householdId);
    }
    return this.appointments;
  }

  // Policy source methods
  getPolicySources(program?: string, type?: string): DemoPolicySource[] {
    let results = this.policySources;
    if (program) {
      results = results.filter(p => p.category.toLowerCase().includes(program.toLowerCase()));
    }
    if (type) {
      const searchType = type.toLowerCase();
      results = results.filter(p => {
        if (searchType === 'federal') {
          return p.category.toLowerCase().includes('federal');
        } else if (searchType === 'state') {
          return p.category.toLowerCase().includes('maryland') || p.category.toLowerCase().includes('state');
        }
        return true;
      });
    }
    return results;
  }

  // User methods
  getUsers(role?: string): DemoUser[] {
    if (role) {
      return this.users.filter(u => u.role === role);
    }
    return this.users;
  }

  // Metrics methods
  getMetrics(): DemoMetrics | null {
    return this.metrics;
  }
}

export const demoDataService = new DemoDataService();
export type {
  DemoHousehold,
  DemoBenefitCalculation,
  DemoTaxReturn,
  DemoDocument,
  DemoAIConversation,
  DemoAIMessage,
  DemoAppointment,
  DemoPolicySource,
  DemoUser,
  DemoMetrics
};
