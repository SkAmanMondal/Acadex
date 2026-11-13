import { ensureDailyClassesForDate, formatDateToYMD } from '../modules/timetable/dailyClass.controller.js';
import { broadcastEvent } from '../config/socket.js';

/**
 * Institutional Daily Class Scheduler (7:00 AM Daily Schedule Publication)
 */
export const initDailyScheduler = async () => {
  try {
    // 1. Immediately ensure today's schedule is instantiated on startup
    const todayStr = formatDateToYMD(new Date());
    await ensureDailyClassesForDate(todayStr);
    console.log(`[Daily Scheduler]: Verified and synchronized class schedule for today (${todayStr}).`);

    // 2. Schedule recurrent 7:00 AM publication
    scheduleNext7AMRun();
  } catch (err) {
    console.error('[Daily Scheduler Error]:', err.message);
  }
};

const scheduleNext7AMRun = () => {
  const now = new Date();
  const next7AM = new Date();
  next7AM.setHours(7, 0, 0, 0);

  // If 7:00 AM has already passed today, target tomorrow 7:00 AM
  if (now >= next7AM) {
    next7AM.setDate(next7AM.getDate() + 1);
  }

  const msUntil7AM = next7AM.getTime() - now.getTime();
  console.log(`[Daily Scheduler]: Next automatic 7:00 AM schedule dispatch armed in ${(msUntil7AM / (1000 * 60)).toFixed(1)} minutes.`);

  setTimeout(async () => {
    try {
      const targetDate = formatDateToYMD(new Date());
      console.log(`====================================================`);
      console.log(` [7:00 AM Daily Schedule Dispatch Running for ${targetDate}] `);
      console.log(`====================================================`);

      await ensureDailyClassesForDate(targetDate);

      // Broadcast institutional real-time alert to all connected users
      const publishPayload = {
        date: targetDate,
        message: `Today's class schedule for ${targetDate} has been locked and published at 7:00 AM.`,
        publishedAt: new Date(),
      };
      broadcastEvent('daily_schedule_published', publishPayload);
      broadcastEvent('timetable_updated', publishPayload);
      broadcastEvent('dashboard_refresh', {});
    } catch (err) {
      console.error('[7:00 AM Scheduler Dispatch Failed]:', err.message);
    } finally {
      // Re-arm for following day's 7:00 AM
      scheduleNext7AMRun();
    }
  }, msUntil7AM);
};
