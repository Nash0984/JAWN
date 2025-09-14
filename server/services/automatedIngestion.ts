import { documentIngestionService } from "./documentIngestion";
import { storage } from "../storage";

export interface IngestionSchedule {
  id: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  lastRun: Date | null;
  nextRun: Date;
  isActive: boolean;
  autoRetry: boolean;
  notifyOnFailure: boolean;
}

export class AutomatedIngestionService {
  private schedules: Map<string, IngestionSchedule> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    // Initialize with default weekly schedule for Maryland SNAP documents
    this.createSchedule('maryland-snap-weekly', 'weekly', true);
  }

  createSchedule(
    id: string, 
    frequency: 'daily' | 'weekly' | 'monthly', 
    isActive: boolean = true
  ): IngestionSchedule {
    const schedule: IngestionSchedule = {
      id,
      frequency,
      lastRun: null,
      nextRun: this.calculateNextRun(frequency),
      isActive,
      autoRetry: true,
      notifyOnFailure: true
    };

    this.schedules.set(id, schedule);
    
    if (isActive) {
      this.scheduleNext(schedule);
    }

    console.log(`✓ Created ingestion schedule: ${id} (${frequency})`);
    console.log(`Next run scheduled for: ${schedule.nextRun.toISOString()}`);

    return schedule;
  }

  private calculateNextRun(frequency: 'daily' | 'weekly' | 'monthly'): Date {
    const now = new Date();
    const nextRun = new Date(now);

    switch (frequency) {
      case 'daily':
        nextRun.setDate(now.getDate() + 1);
        nextRun.setHours(2, 0, 0, 0); // 2 AM daily
        break;
      case 'weekly':
        nextRun.setDate(now.getDate() + (7 - now.getDay())); // Next Sunday
        nextRun.setHours(3, 0, 0, 0); // 3 AM Sunday
        break;
      case 'monthly':
        nextRun.setMonth(now.getMonth() + 1, 1); // First of next month
        nextRun.setHours(4, 0, 0, 0); // 4 AM first of month
        break;
    }

    return nextRun;
  }

  private scheduleNext(schedule: IngestionSchedule): void {
    // Clear existing timer if any
    const existingTimer = this.timers.get(schedule.id);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timeUntilNext = schedule.nextRun.getTime() - Date.now();
    
    if (timeUntilNext <= 0) {
      // Schedule is overdue, run immediately
      this.runScheduledIngestion(schedule);
      return;
    }

    const timer = setTimeout(() => {
      this.runScheduledIngestion(schedule);
    }, timeUntilNext);

    this.timers.set(schedule.id, timer);
    
    console.log(`Scheduled next ingestion for ${schedule.id} in ${Math.round(timeUntilNext / (1000 * 60 * 60))} hours`);
  }

  private async runScheduledIngestion(schedule: IngestionSchedule): Promise<void> {
    console.log(`🔄 Starting scheduled ingestion: ${schedule.id}`);
    
    try {
      // Update schedule state
      schedule.lastRun = new Date();
      
      // Check for document changes before ingesting
      const hasChanges = await this.checkForDocumentChanges();
      
      if (hasChanges || schedule.frequency === 'weekly') {
        console.log('📥 Changes detected or weekly sync - starting ingestion...');
        
        const documentIds = await documentIngestionService.ingestAllDocuments();
        
        console.log(`✅ Scheduled ingestion completed successfully`);
        console.log(`📊 Processed ${documentIds.length} documents`);
        
        // Log successful ingestion
        await this.logIngestionResult(schedule.id, 'success', {
          documentsProcessed: documentIds.length,
          documentIds: documentIds
        });
        
      } else {
        console.log('📋 No changes detected - skipping ingestion');
        await this.logIngestionResult(schedule.id, 'skipped', {
          reason: 'No changes detected'
        });
      }
      
    } catch (error) {
      console.error(`❌ Scheduled ingestion failed for ${schedule.id}:`, error);
      
      await this.logIngestionResult(schedule.id, 'failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      if (schedule.autoRetry) {
        console.log('🔄 Auto-retry enabled - scheduling retry in 1 hour');
        setTimeout(() => {
          this.runScheduledIngestion(schedule);
        }, 60 * 60 * 1000); // Retry in 1 hour
      }
      
      if (schedule.notifyOnFailure) {
        // In a real system, this would send notifications
        console.log('🚨 Failure notification would be sent');
      }
    }
    
    // Schedule next run
    schedule.nextRun = this.calculateNextRun(schedule.frequency);
    this.scheduleNext(schedule);
  }

  private async checkForDocumentChanges(): Promise<boolean> {
    try {
      console.log('🔍 Checking for document changes using HTTP headers...');
      
      // Get current document catalog
      const catalog = await documentIngestionService.getDocumentCatalog();
      console.log(`📋 Checking ${catalog.length} documents for changes`);
      
      let changesDetected = false;
      let documentsChecked = 0;
      
      // Check a sample of documents to detect changes
      const sampleSize = Math.min(catalog.length, 10); // Check up to 10 documents
      const sampleDocs = catalog.slice(0, sampleSize);
      
      for (const doc of sampleDocs) {
        try {
          const response = await fetch(doc.downloadUrl, { method: 'HEAD' });
          documentsChecked++;
          
          if (response.ok) {
            const currentLastModified = response.headers.get('Last-Modified');
            const currentContentLength = response.headers.get('Content-Length');
            const currentETag = response.headers.get('ETag');
            
            // Compare with stored metadata
            if (currentLastModified && currentLastModified !== doc.lastModified) {
              console.log(`📅 Last-Modified changed for ${doc.sectionNumber}: ${doc.lastModified} → ${currentLastModified}`);
              changesDetected = true;
            }
            
            if (currentContentLength && parseInt(currentContentLength) !== doc.fileSize) {
              console.log(`📏 File size changed for ${doc.sectionNumber}: ${doc.fileSize} → ${currentContentLength}`);
              changesDetected = true;
            }
            
            // If we find any changes, we can stop checking
            if (changesDetected) {
              break;
            }
          } else {
            console.log(`⚠️ Document ${doc.sectionNumber} returned ${response.status}`);
          }
          
        } catch (error) {
          console.error(`❌ Failed to check ${doc.sectionNumber}:`, error);
          // Continue checking other documents
        }
      }
      
      console.log(`🔍 Change detection completed:`);
      console.log(`   📊 Documents checked: ${documentsChecked}/${sampleSize}`);
      console.log(`   📈 Changes detected: ${changesDetected ? 'YES' : 'NO'}`);
      
      return changesDetected;
      
    } catch (error) {
      console.error('❌ Error during change detection:', error);
      // If we can't check for changes, assume there are changes to be safe
      console.log('🔄 Assuming changes exist due to error');
      return true;
    }
  }

  private async logIngestionResult(
    scheduleId: string, 
    status: 'success' | 'failed' | 'skipped',
    details: Record<string, any>
  ): Promise<void> {
    try {
      // In a real system, this would log to the database
      const logEntry = {
        scheduleId,
        status,
        timestamp: new Date().toISOString(),
        details
      };
      
      console.log('📋 Ingestion log:', JSON.stringify(logEntry, null, 2));
      
    } catch (error) {
      console.error('Failed to log ingestion result:', error);
    }
  }

  getSchedules(): IngestionSchedule[] {
    return Array.from(this.schedules.values());
  }

  getSchedule(id: string): IngestionSchedule | undefined {
    return this.schedules.get(id);
  }

  updateSchedule(id: string, updates: Partial<IngestionSchedule>): boolean {
    const schedule = this.schedules.get(id);
    if (!schedule) {
      return false;
    }

    Object.assign(schedule, updates);
    
    if (updates.isActive !== undefined) {
      if (updates.isActive) {
        this.scheduleNext(schedule);
      } else {
        const timer = this.timers.get(id);
        if (timer) {
          clearTimeout(timer);
          this.timers.delete(id);
        }
      }
    }

    return true;
  }

  // Manual trigger for immediate ingestion
  async triggerManualIngestion(reason: string = 'Manual trigger'): Promise<void> {
    console.log(`🚀 Manual ingestion triggered: ${reason}`);
    
    try {
      const documentIds = await documentIngestionService.ingestAllDocuments();
      
      await this.logIngestionResult('manual', 'success', {
        documentsProcessed: documentIds.length,
        documentIds: documentIds,
        reason
      });
      
      console.log(`✅ Manual ingestion completed successfully`);
      
    } catch (error) {
      console.error('❌ Manual ingestion failed:', error);
      
      await this.logIngestionResult('manual', 'failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reason
      });
      
      throw error;
    }
  }

  // Stop all scheduled ingestions
  stopAllSchedules(): void {
    this.timers.forEach((timer, id) => {
      clearTimeout(timer);
      console.log(`🛑 Stopped schedule: ${id}`);
    });
    this.timers.clear();
    
    this.schedules.forEach((schedule) => {
      schedule.isActive = false;
    });
  }

  // Start all inactive schedules
  startAllSchedules(): void {
    this.schedules.forEach((schedule) => {
      if (!schedule.isActive) {
        schedule.isActive = true;
        this.scheduleNext(schedule);
        console.log(`▶️ Started schedule: ${schedule.id}`);
      }
    });
  }
}

export const automatedIngestionService = new AutomatedIngestionService();