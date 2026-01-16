import type {
  DataSourceType,
  DataSourceConfig,
  IExternalDataSource,
  IWageDataSource,
  ILifeEventSource,
  IVitalStatisticsSource,
  IMVASource,
  ICommercialVerificationSource,
  ISSASource,
  IBEACONSource,
} from './types';

const DATA_SOURCE_CONFIGS: Record<DataSourceType, DataSourceConfig> = {
  beacon: {
    type: 'beacon',
    name: 'BEACON E&E System',
    description: 'Maryland Eligibility & Enrollment system for benefits programs',
    stateSpecificId: 'MD_BEACON',
    useSyntheticData: true,
  },
  vital_statistics: {
    type: 'vital_statistics',
    name: 'Vital Statistics Registry',
    description: 'State vital records for births, deaths, marriages, divorces',
    useSyntheticData: true,
  },
  mva: {
    type: 'mva',
    name: 'Motor Vehicle Administration',
    description: 'DMV records for address verification and vehicle assets',
    stateSpecificId: 'MD_MVA',
    useSyntheticData: true,
  },
  w2_wage_records: {
    type: 'w2_wage_records',
    name: 'Quarterly Wage Records',
    description: 'State quarterly wage reporting system',
    useSyntheticData: true,
  },
  commercial_verification: {
    type: 'commercial_verification',
    name: 'Commercial Verification Services',
    description: 'Third-party verification services (The Work Number, Equifax, etc.)',
    useSyntheticData: true,
  },
  ssa_ssi: {
    type: 'ssa_ssi',
    name: 'SSA/SSI Verification',
    description: 'Social Security Administration benefit verification',
    useSyntheticData: true,
  },
  irs_tax_data: {
    type: 'irs_tax_data',
    name: 'IRS Tax Data',
    description: 'IRS income and tax return verification',
    useSyntheticData: true,
  },
  ndnh: {
    type: 'ndnh',
    name: 'National Directory of New Hires',
    description: 'Federal new hire reporting database',
    useSyntheticData: true,
  },
  swica: {
    type: 'swica',
    name: 'State Wage Interchange System',
    description: 'Interstate wage verification system',
    useSyntheticData: true,
  },
};

class DataSourceRegistry {
  private static instance: DataSourceRegistry;
  private sources: Map<DataSourceType, IExternalDataSource<unknown>> = new Map();
  private initialized = false;

  private constructor() {}

  static getInstance(): DataSourceRegistry {
    if (!DataSourceRegistry.instance) {
      DataSourceRegistry.instance = new DataSourceRegistry();
    }
    return DataSourceRegistry.instance;
  }

  getConfig(type: DataSourceType): DataSourceConfig {
    return DATA_SOURCE_CONFIGS[type];
  }

  getAllConfigs(): DataSourceConfig[] {
    return Object.values(DATA_SOURCE_CONFIGS);
  }

  register<T>(type: DataSourceType, source: IExternalDataSource<T>): void {
    this.sources.set(type, source as IExternalDataSource<unknown>);
  }

  get<T>(type: DataSourceType): IExternalDataSource<T> | undefined {
    return this.sources.get(type) as IExternalDataSource<T> | undefined;
  }

  getWageSource(): IWageDataSource | undefined {
    return this.get<never>('w2_wage_records') as IWageDataSource | undefined;
  }

  getLifeEventSource(): ILifeEventSource | undefined {
    return this.lifeEventSource as ILifeEventSource | undefined;
  }

  private lifeEventSource: ILifeEventSource | undefined;

  registerLifeEventSource(source: ILifeEventSource): void {
    this.lifeEventSource = source;
  }

  getVitalStatisticsSource(): IVitalStatisticsSource | undefined {
    return this.get<never>('vital_statistics') as IVitalStatisticsSource | undefined;
  }

  getMVASource(): IMVASource | undefined {
    return this.get<never>('mva') as IMVASource | undefined;
  }

  getCommercialVerificationSource(): ICommercialVerificationSource | undefined {
    return this.get<never>('commercial_verification') as ICommercialVerificationSource | undefined;
  }

  getSSASource(): ISSASource | undefined {
    return this.get<never>('ssa_ssi') as ISSASource | undefined;
  }

  getBEACONSource(): IBEACONSource | undefined {
    return this.get<never>('beacon') as IBEACONSource | undefined;
  }

  async healthCheckAll(): Promise<Record<DataSourceType, { healthy: boolean; latencyMs: number; usingSynthetic: boolean; error?: string }>> {
    const results: Record<string, { healthy: boolean; latencyMs: number; usingSynthetic: boolean; error?: string }> = {};
    
    for (const [type, source] of this.sources.entries()) {
      try {
        const healthResult = await source.healthCheck();
        results[type] = {
          ...healthResult,
          usingSynthetic: source.usingSyntheticData,
        };
      } catch (error) {
        results[type] = {
          healthy: false,
          latencyMs: -1,
          usingSynthetic: source.usingSyntheticData,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
    
    return results as Record<DataSourceType, { healthy: boolean; latencyMs: number; usingSynthetic: boolean; error?: string }>;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  setInitialized(value: boolean): void {
    this.initialized = value;
  }

  getRegisteredSources(): DataSourceType[] {
    return Array.from(this.sources.keys());
  }
}

export const dataSourceRegistry = DataSourceRegistry.getInstance();
export { DATA_SOURCE_CONFIGS };
