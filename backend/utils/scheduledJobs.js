const logger = require('./logger');
const User = require('../models/User');
const {
  sendRenewalReminderEmail,
  sendInactivityEmail,
  sendAdminGrantExpiryWarningEmail,
} = require('./emailService');
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
        logger.error(`Renewal reminder failed for user ID ${user._id}:`, err.message);
      }
    }

    if (users.length > 0) {
      logger.log(`[ScheduledJobs] Renewal reminders processed for ${users.length} user(s).`);
    }
  } catch (err) {
    logger.error('[ScheduledJobs] Renewal reminder job error:', err.message);
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
        logger.error(`Inactivity email failed for user ID ${user._id}:`, err.message);
      }
    }

    if (users.length > 0) {
      logger.log(`[ScheduledJobs] Inactivity emails sent to ${users.length} user(s).`);
    }
  } catch (err) {
    logger.error('[ScheduledJobs] Inactivity email job error:', err.message);
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
      logger.log(`[ScheduledJobs] Expired premium for ${result.modifiedCount} user(s).`);
    }
  } catch (err) {
    logger.error('[ScheduledJobs] Premium expiry sweep error:', err.message);
  }
};

/**
 * Warn admins about admin-granted premium subscriptions expiring within 7 days.
 * Each grant is only warned about once per expiry window — `premium.adminGrantExpiryWarningSentAt`
 * is reset to null whenever an admin re-grants/extends.
 */
const runAdminGrantExpiryWarnings = async () => {
  try {
    const now = new Date();
    const sevenDays = new Date(now.getTime() + SEVEN_DAYS_MS);

    const grantees = await User.find({
      'premium.isActive': true,
      'premium.source': 'admin',
      'premium.expiresAt': { $gte: now, $lte: sevenDays },
      $or: [
        { 'premium.adminGrantExpiryWarningSentAt': null },
        { 'premium.adminGrantExpiryWarningSentAt': { $exists: false } },
      ],
    }).select('email name premium').lean();

    if (grantees.length === 0) return;

    const admins = await User.find({ isAdmin: true })
      .select('email name')
      .lean();

    if (admins.length === 0) {
      logger.log('[ScheduledJobs] Admin-grant expiry warning skipped — no admins configured.');
      return;
    }

    let notified = 0;
    for (const grantee of grantees) {
      const msUntilExpiry = new Date(grantee.premium.expiresAt).getTime() - now.getTime();
      const daysLeft = Math.max(1, Math.ceil(msUntilExpiry / (24 * 60 * 60 * 1000)));

      let anySent = false;
      for (const admin of admins) {
        if (!admin.email) continue;
        const result = await sendAdminGrantExpiryWarningEmail({
          adminEmail: admin.email,
          adminName: admin.name,
          granteeName: grantee.name,
          granteeEmail: grantee.email,
          expiresAt: grantee.premium.expiresAt,
          daysLeft,
          reason: grantee.premium.adminGrantReason,
        });
        if (result?.success) anySent = true;
      }

      if (anySent) {
        await User.updateOne(
          { _id: grantee._id },
          { $set: { 'premium.adminGrantExpiryWarningSentAt': now } }
        );
        notified += 1;
      }
    }

    if (notified > 0) {
      logger.log(`[ScheduledJobs] Admin grant expiry warnings sent for ${notified}/${grantees.length} grant(s) to ${admins.length} admin(s).`);
    }
  } catch (err) {
    logger.error('[ScheduledJobs] Admin grant expiry warning job error:', err.message);
  }
};

const startScheduledJobs = () => {
  logger.log('[ScheduledJobs] Starting scheduled email jobs (interval: 1 hour)...');

  runRenewalReminders();
  runInactivityEmails();
  runPremiumExpiry();
  runAdminGrantExpiryWarnings();

  setInterval(runRenewalReminders, CHECK_INTERVAL);
  setInterval(runInactivityEmails, CHECK_INTERVAL);
  setInterval(runPremiumExpiry, CHECK_INTERVAL);
  setInterval(runAdminGrantExpiryWarnings, CHECK_INTERVAL);

  const SIX_HOURS = 6 * 60 * 60 * 1000;
  setTimeout(() => {
    runChurnPrediction();
    setInterval(runChurnPrediction, SIX_HOURS);
  }, 2 * 60 * 1000);

  logger.log('[ScheduledJobs] Churn prediction engine scheduled (every 6 hours).');
};

module.exports = { startScheduledJobs };
