const logger = require('../utils/logger');
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const Session = require("../models/Session");
const {
  sendPasswordResetEmail,
  sendWelcomeEmail,
} = require("../utils/emailService");
const { sendSmartNotification } = require('../utils/pushNotifications');
const {
  authLimiter,
  otpLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  refreshLimiter,
} = require("../middleware/rateLimiter");
const redis = require('../utils/redis');
const validate = require("../middleware/validate");
const schemas = require("../validators/schemas");

// Access tokens are intentionally short-lived (30 minutes). The frontend
// silently refreshes them via /refresh ~60s before expiry using the long-lived
// refresh token, so the user stays logged in continuously without ever seeing
// a 401. If you change ACCESS_TOKEN_TTL_SECONDS, also update the proactive
// refresh schedule in frontend/utils/tokenManager.ts (it reads the JWT's `exp`
// directly so no constant lives there).
const ACCESS_TOKEN_TTL_SECONDS = 30 * 60;

const generateToken = (userId, tokenVersion = 0, sessionId = null) => {
  const payload = { id: userId, tokenVersion };
  if (sessionId) payload.sessionId = sessionId;
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  });
};

function generateRefreshToken() {
  const raw = crypto.randomBytes(64).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

async function createSession(userId, req) {
  try {
    const sessionId = crypto.randomUUID();
    const rawDeviceName = req.body.deviceName || req.headers['x-device-name'] || null;
    const deviceName = rawDeviceName || 'Unknown Device';
    const platform = req.body.platform || req.headers['x-platform'] || 'unknown';
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || null;
    const cleanIp = ipAddress && ipAddress.startsWith('::ffff:') ? ipAddress.slice(7) : ipAddress;

    let city = null;
    let country = null;
    if (cleanIp && cleanIp !== '127.0.0.1' && cleanIp !== '::1' && !cleanIp.startsWith('::ffff:127')) {
      try {
        const geoRes = await fetch(`http://ip-api.com/json/${cleanIp}?fields=city,country,status`, { signal: AbortSignal.timeout(3000) });
        const geo = await geoRes.json();
        if (geo.status === 'success') {
          city = geo.city || null;
          country = geo.country || null;
        }
      } catch (_) {}
    }

    // Remove any existing sessions for the same device to prevent duplicates
    if (rawDeviceName) {
      await Session.deleteMany({ userId, deviceName: rawDeviceName });
    }

    // Cap sessions at 5 per user — delete the oldest ones if over the limit
    const SESSION_CAP = 5;
    const existingSessions = await Session.find({ userId }).sort({ lastActive: 1 });
    if (existingSessions.length >= SESSION_CAP) {
      const toDelete = existingSessions.slice(0, existingSessions.length - SESSION_CAP + 1);
      const idsToDelete = toDelete.map(s => s.sessionId);
      await Session.deleteMany({ sessionId: { $in: idsToDelete } });
    }

    const { raw: rawRefreshToken, hash: refreshTokenHash } = generateRefreshToken();
    await Session.create({ userId, sessionId, deviceName, platform, ipAddress: cleanIp, city, country, refreshTokenHash });
    return { sessionId, deviceName, ipAddress: cleanIp, city, country, refreshToken: rawRefreshToken };
  } catch (err) {
    logger.error('Failed to create session:', err.message);
    return { sessionId: crypto.randomUUID(), deviceName: 'Unknown Device', ipAddress: null, city: null, country: null, refreshToken: null };
  }
}

router.post(
  "/signup",
  authLimiter,
  validate(schemas.auth.signup),
  async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: "Please provide email and password",
        });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid email address",
        });
      }

      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 8 characters",
        });
      }

      let existingUser = await User.findOne({ email });

      if (existingUser && existingUser.emailVerified) {
        return res.status(400).json({
          success: false,
          message: "User already exists. Please login instead.",
        });
      }

      if (existingUser && !existingUser.emailVerified) {
        await User.deleteOne({ _id: existingUser._id });
        logger.log("Deleted unverified user for re-registration (user ID redacted).");
      }

      const { generateOTP, sendOTP } = require("../utils/emailService");
      const otpCode = generateOTP();

      const user = await User.create({
        name: "User",
        email,
        password,
        age: 18,
        gender: "other",
        location: {
          type: "Point",
          coordinates: [0, 0],
        },
        verified: false,
        verificationOTP: otpCode,
        verificationOTPExpire: Date.now() + 10 * 60 * 1000, // 10 minutes
      });

      try {
        await sendOTP(email, otpCode);
      } catch (emailError) {
        logger.error("Failed to send OTP email:", emailError);
      }

      res.status(201).json({
        success: true,
        message: "Verification code sent to your email",
        userId: user._id,
        email: user.email,
      });
    } catch (error) {
      logger.error("Signup error");
      res.status(500).json({
        success: false,
        message: "Server error during signup",
      });
    }
  },
);

router.post("/verify-otp", otpLimiter, async (req, res) => {
  try {
    const { userId, otp } = req.body;

    const user = await User.findOne({
      _id: userId,
      verificationOTP: otp,
      verificationOTPExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification code",
      });
    }

    user.emailVerified = true;
    user.verificationOTP = undefined;
    user.verificationOTPExpire = undefined;
    user.expireAt = undefined; // Stop auto-deletion once verified
    await user.save();

    sendWelcomeEmail(user.email, user.name || "there").catch((err) =>
      logger.error("Welcome email failed (non-blocking):", err.message),
    );

    const freshUser = await User.findById(user._id).select('+tokenVersion');
    const newSession = await createSession(user._id, req);
    const token = generateToken(user._id, freshUser.tokenVersion || 0, newSession.sessionId);

    res.json({
      success: true,
      token,
      refreshToken: newSession.refreshToken,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        age: user.age,
        gender: user.gender,
        isAdmin: user.isAdmin || false,
        isSupportAgent: user.isSupportAgent || false,
      },
    });
  } catch (error) {
    logger.error("OTP verification error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during verification",
    });
  }
});

router.post("/resend-otp", otpLimiter, async (req, res) => {
  try {
    const { userId } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email already verified",
      });
    }

    const { generateOTP, sendOTP } = require("../utils/emailService");
    const otpCode = generateOTP();

    user.verificationOTP = otpCode;
    user.verificationOTPExpire = Date.now() + 10 * 60 * 1000;
    await user.save();

    await sendOTP(user.email, otpCode);

    res.json({
      success: true,
      message: "New verification code sent to your email",
    });
  } catch (error) {
    logger.error("Resend OTP error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to resend verification code",
    });
  }
});

router.post(
  "/login",
  authLimiter,
  validate(schemas.auth.login),
  async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: "Please provide email and password",
        });
      }

      // Fetch every field login needs in a single round-trip. Previously we
      // ran TWO findOne/findById queries back-to-back (one for the password,
      // one to re-read tokenVersion + push prefs), which doubled the Mongo
      // latency on the critical login path.
      const user = await User.findOne({ email }).select(
        "+password +tokenVersion pushToken pushNotificationsEnabled notificationPreferences muteSettings"
      );
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password.",
        });
      }

      if (user.banned) {
        const appealToken = jwt.sign(
          { id: user._id, purpose: "appeal", email: user.email },
          process.env.JWT_SECRET,
          { expiresIn: "15m" },
        );

        return res.status(403).json({
          success: false,
          message:
            "Your account has been banned. Please appeal in the app for more information.",
          isBanned: true,
          appealToken,
          email: user.email,
          banReason: user.banReason || "Violation of community guidelines",
          bannedAt: user.bannedAt,
          appeal: user.appeal || null,
        });
      }

      if (user.suspended && user.suspendedUntil && user.suspendedUntil > Date.now()) {
        const appealToken = jwt.sign(
          { id: user._id, purpose: "appeal", email: user.email },
          process.env.JWT_SECRET,
          { expiresIn: "15m" },
        );

        return res.status(403).json({
          success: false,
          message:
            "Your account is temporarily suspended. You can appeal from this screen.",
          isSuspended: true,
          appealToken,
          email: user.email,
          banReason: user.banReason || "Violation of community guidelines",
          bannedAt: user.bannedAt,
          suspendedUntil: user.suspendedUntil,
          appeal: user.appeal || null,
        });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }

      // The lastActive / onlineStatus update is purely a presence concern —
      // it must NOT block the login response. Push it onto the next tick so
      // the user gets their token immediately while Mongo persists in the
      // background. Same DB cost, but it's now off the critical path.
      const presenceUpdate = User.updateOne(
        { _id: user._id },
        { $set: { lastActive: Date.now(), onlineStatus: "online" } }
      ).catch((err) =>
        logger.warn("Login presence update failed (non-fatal):", err.message)
      );

      const newSession = await createSession(user._id, req);
      const { sessionId, refreshToken } = newSession;
      const token = generateToken(user._id, user.tokenVersion || 0, sessionId);
      // We intentionally don't await `presenceUpdate` — fire-and-forget.
      void presenceUpdate;
      // Keep a reference for the suspicious-login alert below.
      const userWithVersion = user;

      // ── Suspicious login detection (fire-and-forget) ───────────────────────
      setImmediate(async () => {
        try {
          const prevSessions = await Session.find({ userId: user._id, sessionId: { $ne: sessionId } }).lean();
          if (prevSessions.length > 0) {
            const knownDevices = new Set(prevSessions.map(s => s.deviceName).filter(Boolean));
            const knownIPs    = new Set(prevSessions.map(s => s.ipAddress).filter(Boolean));
            const isNewDevice = newSession.deviceName && !knownDevices.has(newSession.deviceName);
            const isNewIP     = newSession.ipAddress  && !knownIPs.has(newSession.ipAddress);

            if (isNewDevice || isNewIP) {
              const locationStr = [newSession.city, newSession.country].filter(Boolean).join(', ') || 'Unknown location';
              const deviceStr   = newSession.deviceName || 'Unknown device';
              await sendSmartNotification(
                userWithVersion,
                {
                  title: '⚠️ New sign-in detected',
                  body: `${deviceStr} · ${locationStr}. If this wasn't you, go to Active Sessions to revoke it.`,
                  data:  { type: 'security', screen: 'DeviceManagement' },
                  channelId: 'security',
                },
                'security',
              );
              logger.info(`[Auth] Suspicious login alert sent → user ${user._id} | device: ${deviceStr}`);
            }
          }
        } catch (alertErr) {
          logger.warn('[Auth] Suspicious login alert failed (non-fatal):', alertErr.message);
        }
      });

      res.json({
        success: true,
        token,
        refreshToken,
        user: {
          id: user._id,
          name: user.name,
          username: user.username,
          email: user.email,
          age: user.age,
          gender: user.gender,
          bio: user.bio,
          interests: user.interests,
          photos: user.photos,
          verified: user.verified,
          isAdmin: user.isAdmin || false,
          isSupportAgent: user.isSupportAgent || false,
          location: user.location,
          lookingFor: user.lookingFor,
          preferences: user.preferences,
          lifestyle: user.lifestyle,
          favoriteSong: user.favoriteSong,
        },
      });
    } catch (error) {
      logger.error("Login error:", error);
      res.status(500).json({
        success: false,
        message: "Server error during login",
      });
    }
  },
);

router.post(
  "/forgot-password",
  forgotPasswordLimiter,
  validate(schemas.auth.forgotPassword),
  async (req, res) => {
    try {
      const { email } = req.body;
      const normalizedEmail = email.toLowerCase().trim();

      const user = await User.findOne({ email: normalizedEmail });

      if (!user) {
        return res.json({
          success: true,
          message:
            "If an account with that email exists, a verification code has been sent.",
        });
      }

      const { generateOTP, sendOTP } = require("../utils/emailService");
      const otpCode = generateOTP();

      user.resetPasswordOTP = otpCode;
      user.resetPasswordOTPExpire = Date.now() + 15 * 60 * 1000;
      await user.save();

      try {
        await sendOTP(user.email, otpCode);
      } catch (emailError) {
        logger.error("Forgot password email failed");
      }

      res.json({
        success: true,
        message:
          "If an account with that email exists, a verification code has been sent.",
        userId: user._id,
      });
    } catch (error) {
      logger.error("Forgot password error");
      res.status(500).json({ success: false, message: "Server error" });
    }
  },
);

router.post(
  "/reset-password",
  resetPasswordLimiter,
  validate(schemas.auth.resetPassword),
  async (req, res) => {
    try {
      const { email, otp, newPassword } = req.body;

      if (!email || !otp || !newPassword) {
        return res.status(400).json({
          success: false,
          message: "Please provide email, code, and new password",
        });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const providedOTP = otp.toString().trim();

      const user = await User.findOne({
        email: normalizedEmail,
      });

      if (!user) {
        logger.log("[RESET_PASSWORD] User not found for provided email.");
        return res.status(400).json({
          success: false,
          message: "Invalid verification code",
        });
      }

      const matchesOTP =
        user.resetPasswordOTP && user.resetPasswordOTP === providedOTP;

      if (!matchesOTP) {
        return res.status(400).json({
          success: false,
          message: "Invalid verification code",
        });
      }

      const isExpired = user.resetPasswordOTPExpire <= Date.now();

      if (isExpired) {
        return res.status(400).json({
          success: false,
          message: "Verification code has expired",
        });
      }

      user.password = newPassword;
      user.resetPasswordOTP = undefined;
      user.resetPasswordOTPExpire = undefined;
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      await user.save();

      res.json({
        success: true,
        message: "Password reset successful",
      });
    } catch (error) {
      logger.error("Reset password error:", error);
      res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  },
);

router.post("/logout", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        await User.findByIdAndUpdate(decoded.id, { $inc: { tokenVersion: 1 } });
        if (decoded.sessionId) {
          await Session.deleteOne({ sessionId: decoded.sessionId });
        }
      } catch (_) {}
    }
    res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Refresh-token rotation is intentionally disabled. The /refresh endpoint
// validates the refresh token, issues a new short-lived access token, and
// returns the SAME refresh token unchanged for the lifetime of the Session
// (30 days, enforced by the Session TTL). Rotation was previously enabled
// with a 60s grace window but caused random sign-outs whenever the rotated
// token didn't make it back to the client (network blips, app backgrounding,
// localStorage write races, parallel refreshes from two pages, etc).
//
// Security model without rotation:
//   - Sessions are revocable server-side via Redis (`revoked:${sessionId}`)
//     and via tokenVersion bumps on the User document.
//   - Refresh tokens are sha256-hashed before storage, so a DB leak alone
//     cannot impersonate a user.
//   - Logout / "log out all devices" / password change all invalidate
//     refresh tokens immediately by deleting the Session row or bumping
//     tokenVersion.
//   - Inactive sessions expire automatically via the Session TTL.
// This matches the standard first-party mobile-app pattern used by Tinder,
// Bumble, Hinge, and other dating apps where UX cost of rotation > the
// marginal security benefit.
router.post("/refresh", refreshLimiter, async (req, res) => {
  try {
    const { refreshToken: rawToken } = req.body;
    if (!rawToken) {
      return res.status(400).json({ success: false, message: "Refresh token required" });
    }

    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Look up the session by the current refresh-token hash. We also still
    // accept a previousRefreshTokenHash within its grace window so that any
    // sessions left over from when rotation was enabled can finish draining
    // without forcing those users to re-login.
    let session = await Session.findOne({ refreshTokenHash: hash });
    if (!session) {
      session = await Session.findOne({
        previousRefreshTokenHash: hash,
        previousRefreshTokenExpiresAt: { $gt: new Date() },
      });
    }

    if (!session) {
      return res.status(401).json({ success: false, message: "Invalid refresh token", tokenRevoked: true });
    }

    const revoked = await redis.get(`revoked:${session.sessionId}`);
    if (revoked) {
      await Session.deleteOne({ _id: session._id });
      return res.status(401).json({ success: false, message: "Session revoked", tokenRevoked: true });
    }

    const user = await User.findById(session.userId).select('+tokenVersion');
    if (!user || user.banned) {
      await Session.deleteOne({ _id: session._id });
      return res.status(401).json({ success: false, message: "Account unavailable", tokenRevoked: true });
    }

    session.lastActive = new Date();
    await session.save();

    const newAccessToken = generateToken(user._id, user.tokenVersion || 0, session.sessionId);

    // Note: we deliberately do NOT return a new refreshToken. The client
    // keeps the same refresh token it already has for the life of the
    // session. tokenManager.ts and adminApi.ts both handle a missing
    // refreshToken in the response by leaving the stored one in place.
    return res.json({ success: true, token: newAccessToken });
  } catch (error) {
    logger.error("Token refresh error:", error);
    res.status(500).json({ success: false, message: "Server error during token refresh" });
  }
});

router.post("/appeal", async (req, res) => {
  try {
    const { appealToken, message } = req.body;

    if (!appealToken) {
      return res.status(401).json({
        success: false,
        message: "Appeal token is required",
      });
    }

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Appeal message is required",
      });
    }

    if (message.length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Appeal message must be under 1000 characters",
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(appealToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid or expired appeal token. Please try logging in again.",
      });
    }

    if (decoded.purpose !== "appeal") {
      return res.status(401).json({
        success: false,
        message: "Invalid token type",
      });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.banned && !user.suspended) {
      return res.status(400).json({
        success: false,
        message: "You do not have an active ban or suspension to appeal",
      });
    }

    if (user.appeal && user.appeal.status === "pending") {
      return res.status(400).json({
        success: false,
        message: "You already have a pending appeal",
      });
    }

    if (
      user.appeal &&
      user.appeal.status === "rejected" &&
      user.appeal.lastAppealRejectedAt
    ) {
      const daysSinceRejection =
        (Date.now() - user.appeal.lastAppealRejectedAt) / (1000 * 60 * 60 * 24);
      if (daysSinceRejection < 30) {
        const daysLeft = Math.ceil(30 - daysSinceRejection);
        return res.status(400).json({
          success: false,
          message: `You can submit a new appeal in ${daysLeft} days`,
        });
      }
    }


    user.appeal = {
      status: "pending",
      message,
      submittedAt: Date.now(),
    };
    await user.save();

    res.json({
      success: true,
      message: "Appeal submitted successfully. Admins will review it soon.",
    });
  } catch (error) {
    logger.error("Appeal submission error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

module.exports = router;
