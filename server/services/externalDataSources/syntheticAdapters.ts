import { db } from '../../db';
import { sql } from 'drizzle-orm';
import type {
  DataSourceType,
  DataSourceQueryParams,
  DataSourceResult,
  WageRecord,
  LifeEvent,
  VitalStatisticsRecord,
  MVARecord,
  CommercialVerificationRecord,
  SSARecord,
  BEACONRecord,
  IWageDataSource,
  ILifeEventSource,
  IVitalStatisticsSource,
  IMVASource,
  ICommercialVerificationSource,
  ISSASource,
  IBEACONSource,
} from './types';

abstract class BaseSyntheticAdapter<T> {
  abstract readonly type: DataSourceType;
  abstract readonly name: string;
  readonly usingSyntheticData = true;

  protected createResult(data: T[], totalCount?: number): DataSourceResult<T> {
    return {
      success: true,
      data,
      totalCount: totalCount ?? data.length,
      source: 'synthetic',
      queriedAt: new Date(),
    };
  }

  protected createErrorResult(error: string): DataSourceResult<T> {
    return {
      success: false,
      data: [],
      totalCount: 0,
      source: 'synthetic',
      queriedAt: new Date(),
      error,
    };
  }

  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      await db.execute(sql`SELECT 1`);
      return { healthy: true, latencyMs: Date.now() - start };
    } catch (error) {
      return { 
        healthy: false, 
        latencyMs: Date.now() - start, 
        error: error instanceof Error ? error.message : 'Database connection failed' 
      };
    }
  }
}

export class SyntheticWageDataSource extends BaseSyntheticAdapter<WageRecord> implements IWageDataSource {
  readonly type: DataSourceType = 'w2_wage_records';
  readonly name = 'Synthetic Wage Records (Digital Twin)';

  async query(params: DataSourceQueryParams): Promise<DataSourceResult<WageRecord>> {
    try {
      const result = await db.execute(sql`
        SELECT 
          i.id as individual_id,
          inc.id,
          inc.employer_fein as employer_fein,
          inc.employer_name as employer_name,
          inc.pay_frequency,
          inc.amount,
          inc.hours_per_week,
          inc.created_at
        FROM ee_synthetic_income inc
        JOIN ee_synthetic_individuals i ON inc.individual_id = i.id
        WHERE inc.income_type IN ('employment', 'self_employment')
        ${params.individualId ? sql`AND i.id = ${params.individualId}` : sql``}
        LIMIT ${params.limit || 100}
        OFFSET ${params.offset || 0}
      `);

      const wageRecords: WageRecord[] = (result.rows as any[]).map(row => ({
        id: row.id,
        individualId: row.individual_id,
        employerFein: row.employer_fein || 'XX-XXXXXXX',
        employerName: row.employer_name || 'Employer',
        quarterStartDate: new Date(),
        quarterEndDate: new Date(),
        grossWages: parseFloat(row.amount) || 0,
        hoursWorked: row.hours_per_week ? row.hours_per_week * 13 : undefined,
        payFrequency: this.mapPayFrequency(row.pay_frequency),
        verificationSource: 'synthetic',
        reportedAt: new Date(row.created_at),
      }));

      return this.createResult(wageRecords);
    } catch (error) {
      return this.createErrorResult(error instanceof Error ? error.message : 'Query failed');
    }
  }

  private mapPayFrequency(freq: string): 'weekly' | 'biweekly' | 'semi_monthly' | 'monthly' {
    switch (freq) {
      case 'W': return 'weekly';
      case 'B': return 'biweekly';
      case 'S': return 'semi_monthly';
      case 'M': return 'monthly';
      default: return 'biweekly';
    }
  }

  async getById(id: string): Promise<WageRecord | null> {
    const result = await this.query({ limit: 1 });
    return result.data.find(r => r.id === id) || null;
  }

  async getQuarterlyWages(individualId: string, quarters: number): Promise<WageRecord[]> {
    const result = await this.query({ individualId, limit: quarters * 3 });
    return result.data;
  }

  async getEmploymentHistory(individualId: string): Promise<WageRecord[]> {
    const result = await this.query({ individualId, limit: 20 });
    return result.data;
  }
}

export class SyntheticLifeEventSource extends BaseSyntheticAdapter<LifeEvent> implements ILifeEventSource {
  readonly type: DataSourceType = 'vital_statistics';
  readonly name = 'Synthetic Life Events (Digital Twin)';

  async query(params: DataSourceQueryParams): Promise<DataSourceResult<LifeEvent>> {
    try {
      const result = await db.execute(sql`
        SELECT 
          le.id,
          le.individual_id,
          le.event_type,
          le.event_date,
          le.detected_at,
          le.source,
          le.details,
          le.processed_at,
          le.case_impact_assessed
        FROM ee_synthetic_life_events le
        WHERE 1=1
        ${params.individualId ? sql`AND le.individual_id = ${params.individualId}` : sql``}
        ${params.startDate ? sql`AND le.event_date >= ${params.startDate}` : sql``}
        ${params.endDate ? sql`AND le.event_date <= ${params.endDate}` : sql``}
        ORDER BY le.event_date DESC
        LIMIT ${params.limit || 100}
        OFFSET ${params.offset || 0}
      `);

      const events: LifeEvent[] = (result.rows as any[]).map(row => ({
        id: row.id,
        individualId: row.individual_id,
        eventType: row.event_type,
        eventDate: new Date(row.event_date),
        detectedAt: new Date(row.detected_at),
        source: row.source,
        details: row.details || {},
        processedAt: row.processed_at ? new Date(row.processed_at) : undefined,
        caseImpactAssessed: row.case_impact_assessed,
      }));

      return this.createResult(events);
    } catch (error) {
      return this.createErrorResult(error instanceof Error ? error.message : 'Query failed');
    }
  }

  async getById(id: string): Promise<LifeEvent | null> {
    const result = await this.query({ limit: 1000 });
    return result.data.find(e => e.id === id) || null;
  }

  async getRecentEvents(individualId: string, days: number): Promise<LifeEvent[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const result = await this.query({ individualId, startDate });
    return result.data;
  }

  async getUnprocessedEvents(): Promise<LifeEvent[]> {
    try {
      const result = await db.execute(sql`
        SELECT * FROM ee_synthetic_life_events 
        WHERE processed_at IS NULL
        ORDER BY detected_at ASC
        LIMIT 100
      `);
      return (result.rows as any[]).map(row => ({
        id: row.id,
        individualId: row.individual_id,
        eventType: row.event_type,
        eventDate: new Date(row.event_date),
        detectedAt: new Date(row.detected_at),
        source: row.source,
        details: row.details || {},
      }));
    } catch {
      return [];
    }
  }

  async markProcessed(eventId: string): Promise<void> {
    await db.execute(sql`
      UPDATE ee_synthetic_life_events 
      SET processed_at = NOW(), case_impact_assessed = true
      WHERE id = ${eventId}
    `);
  }
}

export class SyntheticVitalStatisticsSource extends BaseSyntheticAdapter<VitalStatisticsRecord> implements IVitalStatisticsSource {
  readonly type: DataSourceType = 'vital_statistics';
  readonly name = 'Synthetic Vital Statistics (Digital Twin)';

  async query(_params: DataSourceQueryParams): Promise<DataSourceResult<VitalStatisticsRecord>> {
    return this.createResult([]);
  }

  async getById(_id: string): Promise<VitalStatisticsRecord | null> {
    return null;
  }

  async getBirthRecord(_certificateNumber: string): Promise<VitalStatisticsRecord | null> {
    return null;
  }

  async getDeathRecord(_certificateNumber: string): Promise<VitalStatisticsRecord | null> {
    return null;
  }

  async searchByName(_name: string, _dateOfBirth?: Date): Promise<VitalStatisticsRecord[]> {
    return [];
  }
}

export class SyntheticMVASource extends BaseSyntheticAdapter<MVARecord> implements IMVASource {
  readonly type: DataSourceType = 'mva';
  readonly name = 'Synthetic MVA Records (Digital Twin)';

  async query(params: DataSourceQueryParams): Promise<DataSourceResult<MVARecord>> {
    try {
      const result = await db.execute(sql`
        SELECT 
          a.id,
          a.individual_id,
          a.address_line1,
          a.address_line2,
          a.city,
          a.state,
          a.zip_code,
          a.county_code,
          a.effective_date,
          a.is_primary,
          i.first_name,
          i.last_name
        FROM ee_synthetic_addresses a
        JOIN ee_synthetic_individuals i ON a.individual_id = i.id
        WHERE a.is_primary = true
        ${params.individualId ? sql`AND a.individual_id = ${params.individualId}` : sql``}
        LIMIT ${params.limit || 100}
      `);

      const records: MVARecord[] = (result.rows as any[]).map(row => ({
        id: row.id,
        individualId: row.individual_id,
        licenseNumber: `MD${row.individual_id.substring(0, 8)}`,
        licenseStatus: 'valid' as const,
        currentAddress: {
          street1: row.address_line1,
          street2: row.address_line2,
          city: row.city,
          state: row.state,
          zip: row.zip_code,
          countyCode: row.county_code || '',
        },
        addressEffectiveDate: new Date(row.effective_date || Date.now()),
        vehicleCount: 0,
        vehicles: [],
        verifiedAt: new Date(),
      }));

      return this.createResult(records);
    } catch (error) {
      return this.createErrorResult(error instanceof Error ? error.message : 'Query failed');
    }
  }

  async getById(id: string): Promise<MVARecord | null> {
    const result = await this.query({ limit: 1000 });
    return result.data.find(r => r.id === id) || null;
  }

  async getByLicenseNumber(_licenseNumber: string): Promise<MVARecord | null> {
    return null;
  }

  async getAddressHistory(individualId: string): Promise<MVARecord[]> {
    const result = await this.query({ individualId });
    return result.data;
  }

  async getVehicleAssets(individualId: string): Promise<MVARecord | null> {
    try {
      const result = await db.execute(sql`
        SELECT 
          r.id,
          r.individual_id,
          r.vin,
          r.make,
          r.model,
          r.year,
          r.fair_market_value,
          r.use_code
        FROM ee_synthetic_resources r
        WHERE r.individual_id = ${individualId}
        AND r.resource_type = 'vehicle'
      `);

      if (result.rows.length === 0) return null;

      const vehicles = (result.rows as any[]).map(row => ({
        vin: row.vin || '',
        make: row.make || 'Unknown',
        model: row.model || 'Unknown',
        year: row.year || 2020,
        registrationStatus: 'active',
        fairMarketValue: parseFloat(row.fair_market_value) || 0,
      }));

      return {
        id: `mva-${individualId}`,
        individualId,
        licenseNumber: `MD${individualId.substring(0, 8)}`,
        licenseStatus: 'valid',
        currentAddress: { street1: '', city: '', state: 'MD', zip: '', countyCode: '' },
        addressEffectiveDate: new Date(),
        vehicleCount: vehicles.length,
        vehicles,
        verifiedAt: new Date(),
      };
    } catch {
      return null;
    }
  }
}

export class SyntheticCommercialVerificationSource extends BaseSyntheticAdapter<CommercialVerificationRecord> implements ICommercialVerificationSource {
  readonly type: DataSourceType = 'commercial_verification';
  readonly name = 'Synthetic Commercial Verification (Digital Twin)';

  async query(_params: DataSourceQueryParams): Promise<DataSourceResult<CommercialVerificationRecord>> {
    return this.createResult([]);
  }

  async getById(_id: string): Promise<CommercialVerificationRecord | null> {
    return null;
  }

  async requestVerification(individualId: string, type: string): Promise<string> {
    const requestId = `synth-${Date.now()}-${individualId}`;
    return requestId;
  }

  async getVerificationStatus(requestId: string): Promise<CommercialVerificationRecord | null> {
    return {
      id: requestId,
      individualId: 'synthetic',
      verificationType: 'income',
      vendorName: 'Synthetic Verification Service',
      requestedAt: new Date(),
      completedAt: new Date(),
      status: 'completed',
      result: {
        verified: true,
        confidence: 0.95,
        details: { note: 'Synthetic verification result' },
      },
    };
  }
}

export class SyntheticSSASource extends BaseSyntheticAdapter<SSARecord> implements ISSASource {
  readonly type: DataSourceType = 'ssa_ssi';
  readonly name = 'Synthetic SSA Records (Digital Twin)';

  async query(_params: DataSourceQueryParams): Promise<DataSourceResult<SSARecord>> {
    return this.createResult([]);
  }

  async getById(_id: string): Promise<SSARecord | null> {
    return null;
  }

  async verifySsiEligibility(_ssn: string): Promise<SSARecord | null> {
    return null;
  }

  async getBenefitAmount(_ssn: string): Promise<{ ssi: number; ssdi: number } | null> {
    return { ssi: 914, ssdi: 0 };
  }
}

export class SyntheticBEACONSource extends BaseSyntheticAdapter<BEACONRecord> implements IBEACONSource {
  readonly type: DataSourceType = 'beacon';
  readonly name = 'Synthetic BEACON Records (Digital Twin)';

  async query(params: DataSourceQueryParams): Promise<DataSourceResult<BEACONRecord>> {
    try {
      const result = await db.execute(sql`
        SELECT 
          c.id,
          c.case_number,
          pe.program_type,
          pe.status,
          pe.application_date,
          pe.certification_begin_date,
          pe.certification_end_date,
          c.household_size,
          pe.monthly_benefit,
          c.ldss_office_code
        FROM ee_synthetic_cases c
        JOIN ee_synthetic_program_enrollments pe ON c.id = pe.case_id
        WHERE 1=1
        ${params.caseNumber ? sql`AND c.case_number = ${params.caseNumber}` : sql``}
        LIMIT ${params.limit || 100}
        OFFSET ${params.offset || 0}
      `);

      const records: BEACONRecord[] = (result.rows as any[]).map(row => ({
        id: row.id,
        caseNumber: row.case_number,
        programType: row.program_type,
        status: row.status,
        applicationDate: new Date(row.application_date),
        certificationPeriod: row.certification_begin_date ? {
          startDate: new Date(row.certification_begin_date),
          endDate: new Date(row.certification_end_date),
        } : undefined,
        householdSize: row.household_size,
        monthlyBenefit: parseFloat(row.monthly_benefit) || 0,
        lastActionDate: new Date(),
        ldssOfficeCode: row.ldss_office_code,
      }));

      return this.createResult(records);
    } catch (error) {
      return this.createErrorResult(error instanceof Error ? error.message : 'Query failed');
    }
  }

  async getById(id: string): Promise<BEACONRecord | null> {
    const result = await this.query({ limit: 1000 });
    return result.data.find(r => r.id === id) || null;
  }

  async getCaseHistory(caseNumber: string): Promise<BEACONRecord[]> {
    const result = await this.query({ caseNumber });
    return result.data;
  }

  async getActivePrograms(individualId: string): Promise<BEACONRecord[]> {
    try {
      const result = await db.execute(sql`
        SELECT DISTINCT
          c.id,
          c.case_number,
          pe.program_type,
          pe.status,
          pe.application_date,
          pe.certification_begin_date,
          pe.certification_end_date,
          c.household_size,
          pe.monthly_benefit,
          c.ldss_office_code
        FROM ee_synthetic_cases c
        JOIN ee_synthetic_case_members cm ON c.id = cm.case_id
        JOIN ee_synthetic_program_enrollments pe ON c.id = pe.case_id
        WHERE cm.individual_id = ${individualId}
        AND pe.status = 'active'
      `);

      return (result.rows as any[]).map(row => ({
        id: row.id,
        caseNumber: row.case_number,
        programType: row.program_type,
        status: row.status,
        applicationDate: new Date(row.application_date),
        certificationPeriod: row.certification_begin_date ? {
          startDate: new Date(row.certification_begin_date),
          endDate: new Date(row.certification_end_date),
        } : undefined,
        householdSize: row.household_size,
        monthlyBenefit: parseFloat(row.monthly_benefit) || 0,
        lastActionDate: new Date(),
        ldssOfficeCode: row.ldss_office_code,
      }));
    } catch {
      return [];
    }
  }

  async getPendingApplications(ldssOfficeCode: string): Promise<BEACONRecord[]> {
    try {
      const result = await db.execute(sql`
        SELECT 
          c.id,
          c.case_number,
          pe.program_type,
          pe.status,
          pe.application_date,
          c.household_size,
          c.ldss_office_code
        FROM ee_synthetic_cases c
        JOIN ee_synthetic_program_enrollments pe ON c.id = pe.case_id
        WHERE c.ldss_office_code = ${ldssOfficeCode}
        AND pe.status = 'pending'
      `);

      return (result.rows as any[]).map(row => ({
        id: row.id,
        caseNumber: row.case_number,
        programType: row.program_type,
        status: 'pending' as const,
        applicationDate: new Date(row.application_date),
        householdSize: row.household_size,
        lastActionDate: new Date(),
        ldssOfficeCode: row.ldss_office_code,
      }));
    } catch {
      return [];
    }
  }
}
