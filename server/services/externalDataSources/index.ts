export * from './types';
export * from './dataSourceRegistry';
export * from './syntheticAdapters';

import { dataSourceRegistry } from './dataSourceRegistry';
import {
  SyntheticWageDataSource,
  SyntheticLifeEventSource,
  SyntheticVitalStatisticsSource,
  SyntheticMVASource,
  SyntheticCommercialVerificationSource,
  SyntheticSSASource,
  SyntheticBEACONSource,
} from './syntheticAdapters';

export function initializeExternalDataSources(): void {
  if (dataSourceRegistry.isInitialized()) {
    return;
  }

  dataSourceRegistry.register('w2_wage_records', new SyntheticWageDataSource());
  dataSourceRegistry.register('vital_statistics', new SyntheticVitalStatisticsSource());
  dataSourceRegistry.register('mva', new SyntheticMVASource());
  dataSourceRegistry.register('commercial_verification', new SyntheticCommercialVerificationSource());
  dataSourceRegistry.register('ssa_ssi', new SyntheticSSASource());
  dataSourceRegistry.register('beacon', new SyntheticBEACONSource());
  
  dataSourceRegistry.registerLifeEventSource(new SyntheticLifeEventSource());
  
  dataSourceRegistry.setInitialized(true);
  
  console.log(`[ExternalDataSources] Initialized ${dataSourceRegistry.getRegisteredSources().length} data sources + life events (using synthetic/digital twin data)`);
}

export { dataSourceRegistry };
