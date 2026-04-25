const webpush = require('web-push');
const logger = require('../utils/logger');

const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY  || 'BP2XFFBffkiRq-CsqTg-fauFMsWsz_zMhRVCYuiOHTQlFO15uvXQPF_MCKE4T7odx4cs2PkhJ_4sT0OocTHMWB4';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'IPVyqBtqlQYKUatwtquROTiluYgdmxfU6EaktwDtuaI';
const VAPID_EMAIL       = process.env.VAPID_EMAIL       || 'mailto:admin@afroconnect.app';

webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const NOTIFICATION_TYPES = {
  NEW_REPORT:       { title: '🚨 New Safety Report',          badge: '/logo.png', urgency: 'high' },
  SAFETY_BYPASS:    { title: '⚠️ Safety Warning Bypassed',    badge: '/logo.png', urgency: 'high' },
  NEW_APPEAL:       { title: '⚖️ New Appeal Submitted',        badge: '/logo.png', urgency: 'normal' },
  NEW_VERIFICATION: { title: '✅ Verification Request',        badge: '/logo.png', urgency: 'normal' },
  HIGH_SEVERITY:    { title: '🔴 High-Severity Event',         badge: '/logo.png', urgency: 'high' },
  NEW_SUPPORT:      { title: '💬 New Support Ticket',          badge: '/logo.png', urgency: 'normal' },
};

async function sendAdminPushNotification({ type, body, data = {}, targetAdminId = null }) {
  try {
    const AdminPushSubscription = require('../models/AdminPushSubscription');
    const filter = targetAdminId ? { adminId: targetAdminId } : {};
    const subscriptions = await AdminPushSubscription.find(filter).lean();
    if (!subscriptions.length) return;

    const meta = NOTIFICATION_TYPES[type] || NOTIFICATION_TYPES.HIGH_SEVERITY;
    const payload = JSON.stringify({
      title: meta.title,
      body,
      icon: '/afroconnect-logo.png',
      badge: meta.badge,
      tag: type,
      data: { url: '/', type, ...data },
      timestamp: Date.now(),
    });

    const results = await Promise.allSettled(
      subscriptions.map(sub =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          payload,
          { urgency: meta.urgency, TTL: 60 * 60 }
        ).then(() => {
          AdminPushSubscription.updateOne({ _id: sub._id }, { lastUsed: new Date() }).catch(() => {});
        })
      )
    );

    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length) {
      const staleEndpoints = [];
      for (let i = 0; i < results.length; i++) {
        if (results[i].status === 'rejected') {
          const err = results[i].reason;
          if (err?.statusCode === 410 || err?.statusCode === 404) {
            staleEndpoints.push(subscriptions[i].endpoint);
          }
        }
      }
      if (staleEndpoints.length) {
        await AdminPushSubscription.deleteMany({ endpoint: { $in: staleEndpoints } }).catch(() => {});
      }
    }
  } catch (err) {
    logger.error('[AdminPush] Failed to send push notification:', err.message);
  }
}

module.exports = { sendAdminPushNotification, VAPID_PUBLIC_KEY };
