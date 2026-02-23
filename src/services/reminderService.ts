import { prisma } from '../lib/prisma';
import { addHours, subHours, isAfter, isBefore } from 'date-fns';

// This would typically run in a cron job every 15-30 minutes
export async function processReminders() {
  const now = new Date();
  const oneHourFromNow = addHours(now, 1);
  const twentyFourHoursFromNow = addHours(now, 24);

  // Find bookings starting in ~24 hours that haven't had a 24h reminder
  const bookings24h = await prisma.booking.findMany({
    where: {
      startTime: {
        gte: subHours(twentyFourHoursFromNow, 0.5),
        lte: twentyFourHoursFromNow
      },
      status: 'CONFIRMED'
    },
    include: { user: true, service: true }
  });

  for (const booking of bookings24h) {
    console.log(`Sending 24h reminder to ${booking.user.email} for ${booking.service.name}`);
    // Implement email sending logic here (e.g., Resend, SendGrid)
  }

  // Find bookings starting in ~1 hour
  const bookings1h = await prisma.booking.findMany({
    where: {
      startTime: {
        gte: subHours(oneHourFromNow, 0.5),
        lte: oneHourFromNow
      },
      status: 'CONFIRMED'
    },
    include: { user: true, service: true }
  });

  for (const booking of bookings1h) {
    console.log(`Sending 1h reminder to ${booking.user.email} for ${booking.service.name}`);
    // Implement email sending logic here
  }
}
