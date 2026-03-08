import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";

export function getGoogleOAuth2Client({ clientId, clientSecret, redirectUri }: { clientId: string; clientSecret: string; redirectUri: string; }) {
  return new OAuth2Client(clientId, clientSecret, redirectUri);
}

export async function getGoogleCalendarEvents({ accessToken, refreshToken, clientId, clientSecret, calendarId = 'primary', timeMin, timeMax }: {
  accessToken: string;
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  calendarId?: string;
  timeMin?: string;
  timeMax?: string;
}) {
  const oAuth2Client = new OAuth2Client(clientId, clientSecret);
  oAuth2Client.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
  const calendar = google.calendar({ version: "v3", auth: oAuth2Client });
  const events = await calendar.events.list({
    calendarId,
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: "startTime",
  });
  return events.data.items || [];
}

export async function createGoogleCalendarEvent({ accessToken, refreshToken, clientId, clientSecret, calendarId = 'primary', event }: {
  accessToken: string;
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  calendarId?: string;
  event: any;
}) {
  const oAuth2Client = new OAuth2Client(clientId, clientSecret);
  oAuth2Client.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
  const calendar = google.calendar({ version: "v3", auth: oAuth2Client });
  const response = await calendar.events.insert({
    calendarId,
    requestBody: event,
  });
  return response.data;
}
