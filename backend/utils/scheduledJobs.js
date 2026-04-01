const User = require('../models/User');
const { sendRenewalReminderEmail, sendInactivityEmail } = require('./emailService');

const THIRTY_DAYS_MS   = 30 * 24 * 60 * 60 * 1000;
const THREE_DAYS_MS    =  3 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS    =  7 * 24 * 60 * 60 * 1000;
const CHECK_INTERVAL   = 60 * 60 * 1000; // run every hour

const formatDate = (date) =>
  new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

// ─── Renewal Reminder Job ────────────────────────────────────────────────────
// Sends a reminder email 3 and 7 days before a premium subscription expires.
// Tracks sent reminders using a field on the user doc to avoid duplicate sends.
const runRenewalReminders = async () => {
  try {
    const now = new Date();

    // Find premium users whose subscription expires within the next 7 days
    const users = await User.find({
      'premium.isActive': true,
      'premium.plan': { $ne: 'free' },
      'premium.expiresAt': {
        $gte: now,
        $lte: new Date(now.getTime() + SEVEN_DAYS_MS),
      },
    }).select('email name premium renewalReminderSentAt');

    for (const user of users) {
      try {
        const msUntilExpiry = new Date(user.premium.expiresAt).getTime() - now.getTime();
        const daysLeft = Math.ceil(msUntilExpiry / (24 * 60 * 60 * 1000));

        // Only send once per renewal window (guard against duplicate sends per hour)
        const lastSent = user.renewalReminderSentAt
          ? new Date(user.renewalReminderSentAt).getTime()
          : 0;
        if (now.getTime() - lastSent < 24 * 60 * 60 * 1000) continue;

        const planLabel = user.premium.plan.charAt(0).toUpperCase() + user.premium.plan.slice(1);
        await sendRenewalReminderEmail(
          user.email,
          user.name,
          planLabel,
          formatDate(user.premium.expiresAt),
          daysLeft
        );

        user.renewalReminderSentAt = now;
        await user.save();
      } catch (err) {
        console.error(`Renewal reminder failed for ${user.email}:`, err.message);
      }
    }

    if (users.length > 0) {
      console.log(`[ScheduledJobs] Renewal reminders processed for ${users.length} user(s).`);
    }
  } catch (err) {
    console.error('[ScheduledJobs] Renewal reminder job error:', err.message);
  }
};

// ─── Inactivity Re-engagement Job ────────────────────────────────────────────
// Sends a "We miss you" email once to users who haven't been active in 30 days.
const runInactivityEmails = async () => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS);

    const users = await User.find({
      emailVerified: true,
      banned: false,
      suspended: false,
      lastActive: { $lt: thirtyDaysAgo },
      inactivityEmailSentAt: { $exists: false },
    }).select('email name lastActive inactivityEmailSentAt').limit(100);

    for (const user of users) {
      try {
        await sendInactivityEmail(user.email, user.name);
        user.inactivityEmailSentAt = new Date();
        await user.save();
      } catch (err) {
        console.error(`Inactivity email failed for ${user.email}:`, err.message);
      }
    }

    if (users.length > 0) {
      console.log(`[ScheduledJobs] Inactivity emails sent to ${users.length} user(s).`);
    }
  } catch (err) {
    console.error('[ScheduledJobs] Inactivity email job error:', err.message);
  }
};

// ─── Start All Jobs ───────────────────────────────────────────────────────────
const startScheduledJobs = () => {
  console.log('[ScheduledJobs] Starting scheduled email jobs (interval: 1 hour)...');

  // Run immediately on startup, then on interval
  runRenewalReminders();
  runInactivityEmails();

  setInterval(runRenewalReminders, CHECK_INTERVAL);
  setInterval(runInactivityEmails, CHECK_INTERVAL);
};

module.exports = { startScheduledJobs };
