import { addMinutes, format, parse, startOfDay, endOfDay, isBefore, isAfter, eachMinuteOfInterval, addDays } from 'date-fns';

export interface TimeSlot {
  start: Date;
  end: Date;
  available: boolean;
}

export function generateSlots(
  date: Date,
  duration: number,
  workingHours: { start: string; end: string }[],
  existingBookings: { startTime: Date; endTime: Date }[]
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const dayStart = startOfDay(date);
  
  workingHours.forEach((hours) => {
    const [startH, startM] = hours.start.split(':').map(Number);
    const [endH, endM] = hours.end.split(':').map(Number);
    
    let currentSlotStart = addMinutes(addMinutes(dayStart, startH * 60), startM);
    const workEnd = addMinutes(addMinutes(dayStart, endH * 60), endM);
    
    while (isBefore(addMinutes(currentSlotStart, duration), workEnd) || 
           format(addMinutes(currentSlotStart, duration), 'HH:mm') === hours.end) {
      
      const currentSlotEnd = addMinutes(currentSlotStart, duration);
      
      // Check if this slot overlaps with any existing booking
      const isOverlapping = existingBookings.some((booking) => {
        return (
          (isAfter(currentSlotEnd, booking.startTime) && isBefore(currentSlotStart, booking.endTime))
        );
      });
      
      // Also check if slot is in the past
      const isPast = isBefore(currentSlotStart, new Date());

      slots.push({
        start: currentSlotStart,
        end: currentSlotEnd,
        available: !isOverlapping && !isPast,
      });
      
      // Move to next possible slot (could be back-to-back or with a buffer)
      currentSlotStart = currentSlotEnd;
    }
  });
  
  return slots;
}
