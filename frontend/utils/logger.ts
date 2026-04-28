import * as Sentry from '@sentry/react-native';

const isDev = __DEV__;

/**
 * Application-wide logger.
 *
 * In development  — mirrors every call to the JS console.
 * In production   — silences debug/info/warn calls and forwards .error()
 *                   calls to Sentry so they appear in the Issues dashboard.
 */
const logger = {
  log: (...args: any[]) => {
    if (isDev) console.log(...args);
  },

  info: (...args: any[]) => {
    if (isDev) console.info(...args);
  },

  warn: (...args: any[]) => {
    if (isDev) console.warn(...args);
    // Optionally capture warnings as Sentry breadcrumbs in production
    if (!isDev) {
      Sentry.addBreadcrumb({
        category: 'app',
        level: 'warning',
        message: args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '),
      });
    }
  },

  error: (...args: any[]) => {
    if (isDev) {
      console.error(...args);
    } else {
      // In production, extract an Error instance or create one from the message
      // so Sentry shows a proper stack trace.
      const err = args.find(a => a instanceof Error);
      if (err) {
        Sentry.captureException(err, {
          extra: { extra: args.filter(a => a !== err) },
        });
      } else {
        const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
        Sentry.captureMessage(msg, 'error');
      }
    }
  },
};

export default logger;
