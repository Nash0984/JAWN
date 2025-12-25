import { google } from 'googleapis';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-calendar',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Calendar not connected');
  }
  return accessToken;
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
// Always call this function again to get a fresh client.
export async function getUncachableGoogleCalendarClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

// Appointment types and interfaces
export interface CalendarAppointment {
  id?: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  timeZone?: string;
  attendeeEmails?: string[];
  location?: string;
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{
      method: 'email' | 'popup';
      minutes: number;
    }>;
  };
}

// Create a calendar event
export async function createCalendarEvent(appointment: CalendarAppointment): Promise<string> {
  const calendar = await getUncachableGoogleCalendarClient();

  const event = {
    summary: appointment.title,
    description: appointment.description,
    start: {
      dateTime: appointment.startTime.toISOString(),
      timeZone: appointment.timeZone || 'America/New_York',
    },
    end: {
      dateTime: appointment.endTime.toISOString(),
      timeZone: appointment.timeZone || 'America/New_York',
    },
    location: appointment.location,
    attendees: appointment.attendeeEmails?.map(email => ({ email })),
    reminders: appointment.reminders || {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 24 * 60 }, // 1 day before
        { method: 'popup', minutes: 60 }, // 1 hour before
      ],
    },
  };

  const response = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: event,
    sendUpdates: 'all', // Send email notifications to attendees
  });

  if (!response.data.id) {
    throw new Error('Failed to create calendar event');
  }

  return response.data.id;
}

// Update a calendar event
export async function updateCalendarEvent(eventId: string, appointment: Partial<CalendarAppointment>): Promise<void> {
  const calendar = await getUncachableGoogleCalendarClient();

  const updateData: any = {};

  if (appointment.title) updateData.summary = appointment.title;
  if (appointment.description !== undefined) updateData.description = appointment.description;
  if (appointment.startTime) {
    updateData.start = {
      dateTime: appointment.startTime.toISOString(),
      timeZone: appointment.timeZone || 'America/New_York',
    };
  }
  if (appointment.endTime) {
    updateData.end = {
      dateTime: appointment.endTime.toISOString(),
      timeZone: appointment.timeZone || 'America/New_York',
    };
  }
  if (appointment.location !== undefined) updateData.location = appointment.location;
  if (appointment.attendeeEmails) {
    updateData.attendees = appointment.attendeeEmails.map(email => ({ email }));
  }
  if (appointment.reminders) updateData.reminders = appointment.reminders;

  await calendar.events.patch({
    calendarId: 'primary',
    eventId: eventId,
    requestBody: updateData,
    sendUpdates: 'all', // Send email notifications to attendees
  });
}

// Delete a calendar event
export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const calendar = await getUncachableGoogleCalendarClient();

  await calendar.events.delete({
    calendarId: 'primary',
    eventId: eventId,
    sendUpdates: 'all', // Send cancellation notifications to attendees
  });
}

// Get a calendar event
export async function getCalendarEvent(eventId: string): Promise<any> {
  const calendar = await getUncachableGoogleCalendarClient();

  const response = await calendar.events.get({
    calendarId: 'primary',
    eventId: eventId,
  });

  return response.data;
}

// List upcoming calendar events
export async function listUpcomingEvents(maxResults: number = 10): Promise<any[]> {
  const calendar = await getUncachableGoogleCalendarClient();

  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date().toISOString(),
    maxResults: maxResults,
    singleEvents: true,
    orderBy: 'startTime',
  });

  return response.data.items || [];
}

// Check availability for a time slot
export async function checkAvailability(startTime: Date, endTime: Date): Promise<boolean> {
  const calendar = await getUncachableGoogleCalendarClient();

  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin: startTime.toISOString(),
      timeMax: endTime.toISOString(),
      items: [{ id: 'primary' }],
    },
  });

  const busySlots = response.data.calendars?.['primary']?.busy || [];
  return busySlots.length === 0; // Available if no busy slots
}
