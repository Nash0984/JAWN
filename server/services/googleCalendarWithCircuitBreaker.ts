/**
 * Google Calendar Service with Circuit Breaker
 * 
 * Wraps Google Calendar API calls with circuit breaker pattern for resilience.
 * This prevents cascading failures when Google Calendar API is down or slow.
 */

import { googleCalendarCircuitBreaker } from './circuitBreaker.service';
import * as calendar from './googleCalendar';
import { createLogger } from './logger.service';

const logger = createLogger('GoogleCalendarWithCircuitBreaker');

class GoogleCalendarWithCircuitBreaker {
  /**
   * Create calendar event with circuit breaker protection
   */
  async createCalendarEvent(
    appointment: calendar.CalendarAppointment
  ): Promise<string> {
    return await googleCalendarCircuitBreaker.execute(async () => {
      return await calendar.createCalendarEvent(appointment);
    });
  }
  
  /**
   * Update calendar event with circuit breaker protection
   */
  async updateCalendarEvent(
    eventId: string,
    appointment: Partial<calendar.CalendarAppointment>
  ): Promise<void> {
    return await googleCalendarCircuitBreaker.execute(async () => {
      return await calendar.updateCalendarEvent(eventId, appointment);
    });
  }
  
  /**
   * Delete calendar event with circuit breaker protection
   */
  async deleteCalendarEvent(eventId: string): Promise<void> {
    return await googleCalendarCircuitBreaker.execute(async () => {
      return await calendar.deleteCalendarEvent(eventId);
    });
  }
  
  /**
   * Get calendar event with circuit breaker protection
   */
  async getCalendarEvent(eventId: string): Promise<any> {
    return await googleCalendarCircuitBreaker.execute(async () => {
      return await calendar.getCalendarEvent(eventId);
    });
  }
  
  /**
   * List upcoming events with circuit breaker protection
   */
  async listUpcomingEvents(maxResults: number = 10): Promise<any[]> {
    return await googleCalendarCircuitBreaker.execute(async () => {
      return await calendar.listUpcomingEvents(maxResults);
    });
  }
  
  /**
   * Check availability with circuit breaker protection
   */
  async checkAvailability(startTime: Date, endTime: Date): Promise<boolean> {
    return await googleCalendarCircuitBreaker.execute(async () => {
      return await calendar.checkAvailability(startTime, endTime);
    });
  }
  
  /**
   * Get circuit breaker metrics
   */
  getCircuitBreakerMetrics() {
    return googleCalendarCircuitBreaker.getMetrics();
  }
  
  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState() {
    return googleCalendarCircuitBreaker.getState();
  }
  
  /**
   * Manually reset circuit breaker
   */
  resetCircuitBreaker() {
    googleCalendarCircuitBreaker.reset();
    logger.info('Google Calendar circuit breaker manually reset', {
      service: 'GoogleCalendarWithCircuitBreaker'
    });
  }
}

// Export singleton instance
export const googleCalendarWithCircuitBreaker = new GoogleCalendarWithCircuitBreaker();
