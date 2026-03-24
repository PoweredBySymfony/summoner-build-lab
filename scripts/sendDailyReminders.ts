import { differenceInCalendarDays, startOfDay } from "date-fns";
import { prisma } from "../server/src/lib/prisma.js";
import { emailService } from "../server/src/services/emailService.js";

async function main() {
  const users = await prisma.user.findMany({
    where: {
      email: { not: null },
      emailPreference: {
        is: {
          dailyReminderEnabled: true,
        },
      },
    },
    include: {
      globalProgress: true,
      emailPreference: true,
    },
  });

  const today = startOfDay(new Date());
  let sent = 0;

  for (const user of users) {
    const lastCompletion = user.globalProgress?.lastDailyCompletedAt ? startOfDay(user.globalProgress.lastDailyCompletedAt) : null;
    const shouldSend = !lastCompletion || differenceInCalendarDays(today, lastCompletion) >= 1;

    if (!shouldSend || !user.email) {
      continue;
    }

    await emailService.sendDailyReminder(user.email, user.username, user.globalProgress?.dailyStreak ?? 0);
    sent += 1;
  }

  console.log(`Daily reminders processed: ${sent}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
