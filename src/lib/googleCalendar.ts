import { google } from 'googleapis';
import { prisma } from './prisma';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export async function syncToGoogleCalendar(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { user: true, service: true }
  });

  if (!booking || !booking.user.googleRefreshToken) return;

  oauth2Client.setCredentials({
    refresh_token: booking.user.googleRefreshToken
  });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  try {
    const event = {
      summary: `Booking: ${booking.service.name}`,
      description: booking.service.description || '',
      start: {
        dateTime: booking.startTime.toISOString(),
        timeZone: 'UTC',
      },
      end: {
        dateTime: booking.endTime.toISOString(),
        timeZone: 'UTC',
      },
      attendees: [{ email: booking.user.email }],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 60 },
        ],
      },
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
    });

    await prisma.booking.update({
      where: { id: bookingId },
      data: { googleEventId: response.data.id }
    });
  } catch (error) {
    console.error('Error syncing to Google Calendar:', error);
  }
}
