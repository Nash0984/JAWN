import { Router, Request, Response } from 'express';
import { 
  dataSourceRegistry, 
  initializeExternalDataSources,
  DATA_SOURCE_CONFIGS,
} from '../services/externalDataSources';
import { lifeEventMonitor } from '../services/externalDataSources/lifeEventMonitor';
import { requireAuth, requireStaff } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

initializeExternalDataSources();

router.get('/health', async (_req: Request, res: Response) => {
  try {
    const healthResults = await dataSourceRegistry.healthCheckAll();
    const allHealthy = Object.values(healthResults).every(r => r.healthy);
    
    res.json({
      success: true,
      status: allHealthy ? 'healthy' : 'degraded',
      dataSources: healthResults,
      registeredSources: dataSourceRegistry.getRegisteredSources(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Health check failed',
    });
  }
});

router.get('/configs', (_req: Request, res: Response) => {
  res.json({
    success: true,
    configs: Object.values(DATA_SOURCE_CONFIGS),
    registeredSources: dataSourceRegistry.getRegisteredSources(),
  });
});

router.get('/life-events/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await lifeEventMonitor.getMonitoringStats();
    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get monitoring stats',
    });
  }
});

router.get('/life-events/unprocessed', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const events = await lifeEventMonitor.getUnprocessedEvents(limit);
    res.json({
      success: true,
      events,
      count: events.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get unprocessed events',
    });
  }
});

router.get('/life-events/high-priority', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const events = await lifeEventMonitor.getHighPriorityEvents(limit);
    res.json({
      success: true,
      events,
      count: events.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get high priority events',
    });
  }
});

router.get('/life-events/individual/:individualId', async (req: Request, res: Response) => {
  try {
    const { individualId } = req.params;
    const days = parseInt(req.query.days as string) || 90;
    const events = await lifeEventMonitor.getEventsByIndividual(individualId, days);
    res.json({
      success: true,
      events,
      count: events.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get events for individual',
    });
  }
});

router.post('/life-events/process', requireAuth, requireStaff, async (req: Request, res: Response) => {
  try {
    const batchSize = parseInt(req.query.batchSize as string) || 50;
    const result = await lifeEventMonitor.processUnprocessedEvents(batchSize);
    res.json({
      success: true,
      processed: result.processed,
      assessments: result.assessments,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process events',
    });
  }
});

const generateEventSchema = z.object({
  individualId: z.string().min(1),
  eventType: z.enum(['birth', 'death', 'marriage', 'divorce', 'address_change', 'income_change', 'employment_change', 'household_composition_change']),
  source: z.string().optional(),
  details: z.record(z.unknown()).optional(),
});

router.post('/life-events/generate', requireAuth, requireStaff, async (req: Request, res: Response) => {
  try {
    const parsed = generateEventSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: parsed.error.errors,
      });
    }

    const eventId = await lifeEventMonitor.generateSyntheticLifeEvent(parsed.data);
    res.json({
      success: true,
      eventId,
      message: 'Synthetic life event generated successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate event',
    });
  }
});

router.post('/life-events/:eventId/assess', requireAuth, requireStaff, async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const events = await lifeEventMonitor.getUnprocessedEvents(1000);
    const event = events.find(e => e.id === eventId);
    
    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Event not found or already processed',
      });
    }

    const assessment = await lifeEventMonitor.assessEventImpact(event);
    res.json({
      success: true,
      assessment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to assess event',
    });
  }
});

router.get('/wage-records/:individualId', async (req: Request, res: Response) => {
  try {
    const { individualId } = req.params;
    const wageSource = dataSourceRegistry.getWageSource();
    
    if (!wageSource) {
      return res.status(503).json({
        success: false,
        error: 'Wage data source not available',
      });
    }

    const result = await wageSource.query({ individualId, limit: 20 });
    res.json({
      success: result.success,
      data: result.data,
      source: result.source,
      queriedAt: result.queriedAt,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get wage records',
    });
  }
});

router.get('/beacon/case/:caseNumber', async (req: Request, res: Response) => {
  try {
    const { caseNumber } = req.params;
    const beaconSource = dataSourceRegistry.getBEACONSource();
    
    if (!beaconSource) {
      return res.status(503).json({
        success: false,
        error: 'BEACON data source not available',
      });
    }

    const history = await beaconSource.getCaseHistory(caseNumber);
    res.json({
      success: true,
      data: history,
      source: 'synthetic',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get case history',
    });
  }
});

router.get('/mva/vehicles/:individualId', async (req: Request, res: Response) => {
  try {
    const { individualId } = req.params;
    const mvaSource = dataSourceRegistry.getMVASource();
    
    if (!mvaSource) {
      return res.status(503).json({
        success: false,
        error: 'MVA data source not available',
      });
    }

    const vehicles = await mvaSource.getVehicleAssets(individualId);
    res.json({
      success: true,
      data: vehicles,
      source: 'synthetic',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get vehicle assets',
    });
  }
});

export default router;
