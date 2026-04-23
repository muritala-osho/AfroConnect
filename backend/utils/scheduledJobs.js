const User = require('../models/User');
const { sendRenewalReminderEmail, sendInactivityEmail } = require('./emailService');
const { runChurnPrediction } = require('./churnEngine');

const THIRTY_DAYS_MS   = 30 * 24 * 60 * 60 * 1000;
const THREE_DAYS_MS    =  3 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS    =  7 * 24 * 60 * 60 * 1000;
const CHECK_INTERVAL   = 60 * 60 * 1000; // run every hour

const formatDate = (date) =>
  new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

const runRenewalReminders = async () => {
  try {
    const now = new Date();

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
        console.error(`Renewal reminder failed for user ID ${user._id}:`, err.message);
      }
    }

    if (users.length > 0) {
      console.log(`[ScheduledJobs] Renewal reminders processed for ${users.length} user(s).`);
    }
  } catch (err) {
    console.error('[ScheduledJobs] Renewal reminder job error:', err.message);
  }
};

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
        console.error(`Inactivity email failed for user ID ${user._id}:`, err.message);
      }
    }

    if (users.length > 0) {
      console.log(`[ScheduledJobs] Inactivity emails sent to ${users.length} user(s).`);
    }
  } catch (err) {
    console.error('[ScheduledJobs] Inactivity email job error:', err.message);
  }
};

const runPremiumExpiry = async () => {
  try {
    const result = await User.updateMany(
      {
        'premium.isActive': true,
        'premium.expiresAt': { $lt: new Date() },
      },
      { $set: { 'premium.isActive': false } }
    );
    if (result.modifiedCount > 0) {
      console.log(`[ScheduledJobs] Expired premium for ${result.modifiedCount} user(s).`);
    }
  } catch (err) {
    console.error('[ScheduledJobs] Premium expiry sweep error:', err.message);
  }
};

const startScheduledJobs = () => {
  console.log('[ScheduledJobs] Starting scheduled email jobs (interval: 1 hour)...');

  runRenewalReminders();
  runInactivityEmails();
  runPremiumExpiry();

  setInterval(runRenewalReminders, CHECK_INTERVAL);
  setInterval(runInactivityEmails, CHECK_INTERVAL);
  setInterval(runPremiumExpiry, CHECK_INTERVAL);

  const SIX_HOURS = 6 * 60 * 60 * 1000;
  setTimeout(() => {
    runChurnPrediction();
    setInterval(runChurnPrediction, SIX_HOURS);
  }, 2 * 60 * 1000);

  console.log('[ScheduledJobs] Churn prediction engine scheduled (every 6 hours).');
};

module.exports = { startScheduledJobs };
