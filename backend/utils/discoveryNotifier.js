const logger = require('./logger');
const User = require('../models/User');

const MAX_NOTIFY_RADIUS_KM = 200;

/**
 * Called whenever a user becomes newly discoverable (location update or face
 * verification approved).  Finds every nearby user whose discovery stack is
 * currently exhausted, emits a real-time socket event so the new card appears
 * in their deck immediately, and sends an instant push notification.
 *
 * @param {Object} newUser  - Mongoose document of the newly discoverable user
 * @param {Object} io       - Socket.io server instance (from app.get('io'))
 */
const notifyExhaustedUsersOfNewMember = async (newUser, io) => {
  try {
    if (!newUser || !io) return;

    if (newUser.verificationStatus !== 'approved') return;
    if (newUser.banned || newUser.suspended) return;

    const privacyIncognito = newUser.privacySettings?.incognitoMode === true;
    if (privacyIncognito) return;

    const coords =
      (newUser.liveLocation?.coordinates?.[0] && newUser.liveLocation?.coordinates?.[1])
        ? newUser.liveLocation.coordinates
        : newUser.location?.coordinates;

    if (!coords || (coords[0] === 0 && coords[1] === 0)) return;

    const newUserGender = newUser.gender;
    if (!newUserGender || newUserGender === 'other') return;

    const radiusInRadians = MAX_NOTIFY_RADIUS_KM / 6371;

    const genderMatchConditions = [
      { 'preferences.genderPreference': newUserGender },
      { 'preferences.genderPreference': 'both' },
      { 'preferences.genderPreference': 'any' },
      { 'preferences.genderPreference': { $exists: false } },
      { 'preferences.genderPreference': null },
    ];

    const candidates = await User.find({
      _id: { $ne: newUser._id },
      discoveryStackExhaustedAt: { $ne: null },
      banned: { $ne: true },
      suspended: { $ne: true },
      $or: genderMatchConditions,
      location: {
        $geoWithin: {
          $centerSphere: [[coords[0], coords[1]], radiusInRadians],
        },
      },
      'location.coordinates': { $ne: [0, 0] },
    })
      .select('_id pushToken pushNotificationsEnabled muteSettings notificationPreferences preferences discoveryStackExhaustedAt')
      .limit(150)
      .lean();

    if (candidates.length === 0) return;

    const newUserCard = {
      _id: newUser._id,
      name: newUser.name,
      age: newUser.age,
      gender: newUser.gender,
      bio: newUser.bio,
      photos: newUser.photos || [],
      interests: newUser.interests || [],
      lookingFor: newUser.lookingFor,
      livingIn: newUser.livingIn,
      verified: newUser.verified,
      verificationStatus: newUser.verificationStatus,
      isFaceVerified: newUser.isFaceVerified,
      prompts: newUser.prompts,
    };

    const { sendSmartNotification } = require('./pushNotifications');

    const updateIds = [];

    for (const candidate of candidates) {
      try {
        io.to(candidate._id.toString()).emit('discovery:new_user', {
          user: newUserCard,
        });

        await sendSmartNotification(
          candidate,
          {
            title: 'New people are waiting for you 💫',
            body: 'Open AfroConnect — your discovery just got fresh!',
            data: { type: 'discovery_waiting', screen: 'Discovery' },
          },
          'system',
        );

        updateIds.push(candidate._id);
      } catch (innerErr) {
        logger.error(
          `[DiscoveryNotifier] Failed to notify user ${candidate._id}:`,
          innerErr.message,
        );
      }
    }

    if (updateIds.length > 0) {
      await User.updateMany(
        { _id: { $in: updateIds } },
        { $unset: { discoveryStackExhaustedAt: '' } },
      );
      logger.log(
        `[DiscoveryNotifier] Notified ${updateIds.length} exhausted user(s) of new member ${newUser._id}`,
      );
    }
  } catch (err) {
    logger.error('[DiscoveryNotifier] Unexpected error:', err.message);
  }
};

module.exports = { notifyExhaustedUsersOfNewMember };
