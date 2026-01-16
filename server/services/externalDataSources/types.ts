export type DataSourceType = 
  | 'beacon'
  | 'vital_statistics'
  | 'mva'
  | 'w2_wage_records'
  | 'commercial_verification'
  | 'ssa_ssi'
  | 'irs_tax_data'
  | 'ndnh'
  | 'swica';

export interface DataSourceConfig {
  type: DataSourceType;
  name: string;
  description: string;
  stateSpecificId?: string;
  productionEndpoint?: string;
  useSyntheticData: boolean;
}

export interface WageRecord {
  id: string;
  individualId: string;
  employerFein: string;
  employerName: string;
  quarterStartDate: Date;
  quarterEndDate: Date;
  grossWages: number;
  hoursWorked?: number;
  payFrequency: 'weekly' | 'biweekly' | 'semi_monthly' | 'monthly';
  verificationSource: 'ndnh' | 'swica' | 'employer_direct' | 'synthetic';
  reportedAt: Date;
}

export interface LifeEvent {
  id: string;
  individualId: string;
  eventType: 'birth' | 'death' | 'marriage' | 'divorce' | 'address_change' | 'income_change' | 'employment_change' | 'household_composition_change';
  eventDate: Date;
  detectedAt: Date;
  source: DataSourceType;
  details: Record<string, unknown>;
  processedAt?: Date;
  caseImpactAssessed?: boolean;
}

export interface VitalStatisticsRecord {
  id: string;
  recordType: 'birth' | 'death';
  eventDate: Date;
  individualName: string;
  individualDob?: Date;
  countyCode: string;
  stateCode: string;
  certificateNumber: string;
  parentInfo?: {
    motherName?: string;
    fatherName?: string;
    motherSsn?: string;
    fatherSsn?: string;
  };
  verifiedAt: Date;
}

export interface MVARecord {
  id: string;
  individualId: string;
  licenseNumber: string;
  licenseStatus: 'valid' | 'suspended' | 'revoked' | 'expired';
  currentAddress: {
    street1: string;
    street2?: string;
    city: string;
    state: string;
    zip: string;
    countyCode: string;
  };
  addressEffectiveDate: Date;
  vehicleCount: number;
  vehicles: Array<{
    vin: string;
    make: string;
    model: string;
    year: number;
    registrationStatus: string;
    fairMarketValue?: number;
  }>;
  verifiedAt: Date;
}

export interface CommercialVerificationRecord {
  id: string;
  individualId: string;
  verificationType: 'employment' | 'income' | 'identity' | 'address' | 'asset';
  vendorName: string;
  requestedAt: Date;
  completedAt?: Date;
  status: 'pending' | 'completed' | 'failed' | 'not_found';
  result?: {
    verified: boolean;
    confidence: number;
    details: Record<string, unknown>;
  };
}

export interface SSARecord {
  id: string;
  individualId: string;
  ssn: string;
  ssiEligible: boolean;
  ssiAmount?: number;
  ssdiEligible: boolean;
  ssdiAmount?: number;
  medicareEligible: boolean;
  benefitStartDate?: Date;
  lastVerifiedAt: Date;
}

export interface BEACONRecord {
  id: string;
  caseNumber: string;
  programType: 'snap' | 'medicaid' | 'tanf' | 'ohep';
  status: 'active' | 'pending' | 'closed' | 'denied';
  applicationDate: Date;
  certificationPeriod?: {
    startDate: Date;
    endDate: Date;
  };
  householdSize: number;
  monthlyBenefit?: number;
  lastActionDate: Date;
  assignedWorker?: string;
  ldssOfficeCode: string;
}

export interface DataSourceQueryParams {
  individualId?: string;
  ssn?: string;
  caseNumber?: string;
  startDate?: Date;
  endDate?: Date;
  eventTypes?: string[];
  limit?: number;
  offset?: number;
}

export interface DataSourceResult<T> {
  success: boolean;
  data: T[];
  totalCount: number;
  source: 'production' | 'synthetic';
  queriedAt: Date;
  error?: string;
}

export interface IExternalDataSource<T> {
  readonly type: DataSourceType;
  readonly name: string;
  readonly usingSyntheticData: boolean;
  
  query(params: DataSourceQueryParams): Promise<DataSourceResult<T>>;
  getById(id: string): Promise<T | null>;
  healthCheck(): Promise<{ healthy: boolean; latencyMs: number; error?: string }>;
}

export interface IWageDataSource extends IExternalDataSource<WageRecord> {
  getQuarterlyWages(individualId: string, quarters: number): Promise<WageRecord[]>;
  getEmploymentHistory(individualId: string): Promise<WageRecord[]>;
}

export interface ILifeEventSource extends IExternalDataSource<LifeEvent> {
  getRecentEvents(individualId: string, days: number): Promise<LifeEvent[]>;
  getUnprocessedEvents(): Promise<LifeEvent[]>;
  markProcessed(eventId: string): Promise<void>;
}

export interface IVitalStatisticsSource extends IExternalDataSource<VitalStatisticsRecord> {
  getBirthRecord(certificateNumber: string): Promise<VitalStatisticsRecord | null>;
  getDeathRecord(certificateNumber: string): Promise<VitalStatisticsRecord | null>;
  searchByName(name: string, dateOfBirth?: Date): Promise<VitalStatisticsRecord[]>;
}

export interface IMVASource extends IExternalDataSource<MVARecord> {
  getByLicenseNumber(licenseNumber: string): Promise<MVARecord | null>;
  getAddressHistory(individualId: string): Promise<MVARecord[]>;
  getVehicleAssets(individualId: string): Promise<MVARecord | null>;
}

export interface ICommercialVerificationSource extends IExternalDataSource<CommercialVerificationRecord> {
  requestVerification(individualId: string, type: string): Promise<string>;
  getVerificationStatus(requestId: string): Promise<CommercialVerificationRecord | null>;
}

export interface ISSASource extends IExternalDataSource<SSARecord> {
  verifySsiEligibility(ssn: string): Promise<SSARecord | null>;
  getBenefitAmount(ssn: string): Promise<{ ssi: number; ssdi: number } | null>;
}

export interface IBEACONSource extends IExternalDataSource<BEACONRecord> {
  getCaseHistory(caseNumber: string): Promise<BEACONRecord[]>;
  getActivePrograms(individualId: string): Promise<BEACONRecord[]>;
  getPendingApplications(ldssOfficeCode: string): Promise<BEACONRecord[]>;
}
