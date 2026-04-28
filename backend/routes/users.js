const logger = require('../utils/logger');
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const { sendOTP } = require('../utils/emailService');
const crypto = require('crypto'); // For generating OTP
const redis = require('../utils/redis');
const { distanceToUser, normaliseMaxDistanceKm } = require('../utils/distance');
const { calculateMatchScore } = require('../utils/matching');
const { discoveryLimiter } = require('../middleware/rateLimiter');

function parseLivingIn(livingIn) {
  if (!livingIn || typeof livingIn !== 'string') return {};
  const parts = livingIn.split(',').map(part => part.trim()).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { city: parts[0] };
  return { city: parts.slice(0, -1).join(', '), country: parts[parts.length - 1] };
}

function normaliseLocationUpdate(location, livingIn) {
  if (!location || typeof location !== 'object') return location;

  const parsedLivingIn = parseLivingIn(livingIn);
  const coords = Array.isArray(location.coordinates) && location.coordinates.length >= 2
    ? [Number(location.coordinates[0]), Number(location.coordinates[1])]
    : null;
  const lng = location.lng ?? location.longitude ?? (coords ? coords[0] : undefined);
  const lat = location.lat ?? location.latitude ?? (coords ? coords[1] : undefined);
  const numericLat = Number(lat);
  const numericLng = Number(lng);

  const nextLocation = {
    type: 'Point',
    city: location.city || parsedLivingIn.city,
    country: location.country || parsedLivingIn.country
  };

  if (
    Number.isFinite(numericLat) &&
    Number.isFinite(numericLng) &&
    numericLat >= -90 &&
    numericLat <= 90 &&
    numericLng >= -180 &&
    numericLng <= 180
  ) {
    nextLocation.coordinates = [numericLng, numericLat];
  }

  return nextLocation;
}


router.get('/me', protect, async (req, res) => {
  try {
    if (!req.user.emailVerified) {
      return res.status(403).json({ success: false, message: 'Please verify your email first' });
    }
    const cacheKey = `profile:me:${req.user._id}`;
    const cached = await redis.get(cacheKey);
    if (cached) return res.json({ success: true, user: cached.user, needsVerification: cached.needsVerification, profileIncomplete: cached.profileIncomplete, fromCache: true });

    const user = await User.findById(req.user._id);
    const payload = {
      user,
      needsVerification: !user.verified,
      profileIncomplete: !user.photos || user.photos.length === 0
    };
    await redis.set(cacheKey, payload, 60);
    res.json({ success: true, ...payload });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/me', protect, require('../middleware/validate')(require('../validators/schemas').updateProfile), async (req, res) => {
  try {
    if (!req.user.emailVerified) {
      return res.status(403).json({ success: false, message: 'Please verify your email first' });
    }

    const updates = req.body;
    const allowedUpdates = [
      'name', 'age', 'gender', 'bio', 'interests', 'photos', 'lookingFor', 
      'preferences', 'location', 'favoriteSong', 'zodiacSign', 'relationshipGoal',
      'jobTitle', 'education', 'school', 'livingIn', 'lifestyle', 'ethnicity', 
      'communicationStyle', 'loveStyle', 'personalityType', 'privacySettings',
      'pets', 'relationshipStatus',
      'height', 'countryOfOrigin', 'tribe', 'languages', 'diasporaGeneration', 'language',
      'autoUpdateProfileLocation', 'locationSharingEnabled',
    ];

    const user = await User.findById(req.user._id);
    const isPremium = user.premium?.isActive;

    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        if (field === 'photos' && Array.isArray(updates[field]) && updates[field].length > 0) {
          user.photos = updates[field].map((photo, index) => ({
            ...photo,
            isPrimary: index === 0,
            order: index
          }));
        }

        else if (field === 'preferences') {
          const allowedPrefKeys = ['ageRange', 'genderPreference', 'maxDistance', 'showOnlineOnly', 'showVerifiedOnly', 'dealBreakers', 'language', 'smoking', 'drinking', 'wantsKids', 'onlineNow', 'interests'];
          allowedPrefKeys.forEach(prefKey => {
            if (!Object.prototype.hasOwnProperty.call(updates.preferences, prefKey) || updates.preferences[prefKey] === undefined) return;
            if (prefKey === 'ageRange' && updates.preferences.ageRange) {
              user.preferences.ageRange = {
                ...(user.preferences.ageRange || {}),
                ...updates.preferences.ageRange
              };
            } else if (prefKey === 'maxDistance') {
              const maxDistance = normaliseMaxDistanceKm(updates.preferences.maxDistance, 50);
              user.preferences.maxDistance = isPremium ? maxDistance : Math.min(maxDistance, 50);
            } else if (prefKey === 'showVerifiedOnly') {
              user.preferences.showVerifiedOnly = isPremium ? updates.preferences.showVerifiedOnly : false;
            } else {
              user.preferences[prefKey] = updates.preferences[prefKey];
            }
          });
          if (Array.isArray(updates.preferences.genders) && updates.preferences.genders.length > 0) {
            const g = updates.preferences.genders;
            user.preferences.genderPreference = g.length === 1 ? g[0] : 'both';
          }
        } else if (field === 'lifestyle' && updates.lifestyle) {
          const lifestyleUpdate = { ...updates.lifestyle };
          if (Array.isArray(lifestyleUpdate.pets)) {
            lifestyleUpdate.pets = lifestyleUpdate.pets.join(',');
          }
          user.lifestyle = {
            ...(user.lifestyle && typeof user.lifestyle.toObject === 'function' ? user.lifestyle.toObject() : (user.lifestyle || {})),
            ...lifestyleUpdate
          };
        } else if (field === 'privacySettings' && updates.privacySettings) {
          if (updates.privacySettings.incognitoMode === true && !user.premium?.isActive) {
            return res.status(403).json({ success: false, message: 'Incognito mode is a premium feature' });
          }
          user.privacySettings = {
            ...(user.privacySettings || {}),
            ...updates.privacySettings
          };
        } else if (['communicationStyle', 'loveStyle', 'personalityType'].includes(field)) {
          const currentLifestyle = user.lifestyle && typeof user.lifestyle.toObject === 'function'
            ? user.lifestyle.toObject()
            : (user.lifestyle || {});
          user.lifestyle = { ...currentLifestyle, [field]: updates[field] };
        } else if (field === 'location') {
          user.location = normaliseLocationUpdate(updates.location, updates.livingIn ?? user.livingIn);
          user.locationUpdatedAt = new Date();
        } else if (Object.prototype.hasOwnProperty.call(updates, field)) {
          user[field] = updates[field];
        }
      }
    });

    await user.save();
    await redis.del(`profile:me:${req.user._id}`);

    res.json({ 
      success: true, 
      user,
      needsVerification: !user.verified,
      profileIncomplete: !user.photos || user.photos.length === 0
    });
  } catch (error) {
    logger.error('Profile update error:', error);
    let message = 'Server error';
    if (error.name === 'ValidationError') {
      message = Object.values(error.errors).map(e => e.message).join(', ');
    } else if (error.message) {
      message = error.message;
    }
    res.status(500).json({ success: false, message });
  }
});

router.get('/search', protect, async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters'
      });
    }

    if (!req.user.emailVerified) {
      return res.status(403).json({ success: false, message: 'Please verify your email first' });
    }

    const users = await User.find({
      _id: { $ne: req.user.id },
      verified: true, // Only search for verified users
      $or: [
        { name: { $regex: query, $options: 'i' } }
      ]
    })
    .select('-password -resetPasswordToken -resetPasswordExpire -verificationOTP -verificationOTPExpire -email -resetPasswordOTP -resetPasswordOTPExpire -banned -banReason -bannedAt -appeal -suspended -suspendedUntil -tokenVersion')
    .limit(20);

    res.json({
      success: true,
      users
    });
  } catch (error) {
    logger.error('Search error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

router.get('/countries', protect, async (req, res) => {
  try {
    const countries = await User.distinct('location.country', {
      'location.country': { $exists: true, $nin: [null, ''] },
      banned: { $ne: true },
      suspended: { $ne: true }
    });

    const filtered = countries.filter(c => c && c.trim() !== '').sort();

    res.json({
      success: true,
      countries: filtered
    });
  } catch (error) {
    logger.error('Countries list error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


router.get('/nearby', protect, discoveryLimiter, async (req, res) => {
  let inflightCacheKey = null;
  let resolveInflight = null;
  let rejectInflight = null;
  try {
    const {
      lat, lng, maxDistance, minAge, maxAge, genders,
      lookingFor, religion, smoking, drinking, wantsKids,
      verifiedOnly, onlineOnly,
    } = req.query;
    const isGlobal = req.query.global === 'true';
    const countryFilter = req.query.country;

    if (!req.user.emailVerified && process.env.NODE_ENV === 'production') {
      return res.status(403).json({ success: false, message: 'Please verify your email first' });
    }

    // Face verification gate — enforced in all environments.
    // We re-fetch the user's verification state from DB to prevent any
    // client-side bypass (the JWT payload only carries tokenVersion, not
    // isFaceVerified, so an attacker cannot craft a token to bypass this).
    const gateUser = await User.findById(req.user._id).select('isFaceVerified verificationStatus');
    if (!gateUser || !gateUser.isFaceVerified || gateUser.verificationStatus !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Face verification required',
        verificationRequired: true,
        verificationStatus: gateUser?.verificationStatus || 'not_requested',
      });
    }

    const cursor = req.query.cursor ? String(req.query.cursor) : null;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 40, 1), 60);

    const normLat  = Math.round((parseFloat(lat)  || 0) * 10);
    const normLng  = Math.round((parseFloat(lng)  || 0) * 10);
    const normDist = parseInt(maxDistance) || '';
    const normMin  = parseInt(minAge)      || '';
    const normMax  = parseInt(maxAge)      || '';
    const normGen  = (genders || '').split(',').sort().join(',');
    const cacheKey = `discovery:${req.user.id}:${isGlobal}:${countryFilter || ''}:${normLat}:${normLng}:${normDist}:${normMin}:${normMax}:${normGen}:${cursor || ''}:${limit}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json({ success: true, users: cached.users || cached, nextCursor: cached.nextCursor || null, fromCache: true });
    }

    // In-process stampede lock: if another request for the same key is already
    // computing, wait briefly for it to populate the cache instead of running
    // the same expensive query in parallel.
    const inflight = req.app.get('discoveryInflight') || new Map();
    if (!req.app.get('discoveryInflight')) req.app.set('discoveryInflight', inflight);
    if (inflight.has(cacheKey)) {
      try {
        const result = await inflight.get(cacheKey);
        return res.json({ success: true, users: result.users, nextCursor: result.nextCursor, fromCache: true });
      } catch (_) {
        // fall through and recompute
      }
    }
    const inflightPromise = new Promise((resolve, reject) => {
      resolveInflight = resolve;
      rejectInflight = reject;
    });
    inflight.set(cacheKey, inflightPromise);
    inflightCacheKey = cacheKey;

    const currentUser = await User.findById(req.user.id);

    if (isGlobal && !currentUser.premium?.isActive) {
      if (rejectInflight) rejectInflight(new Error('forbidden'));
      if (inflightCacheKey) inflight.delete(inflightCacheKey);
      return res.status(403).json({ success: false, message: 'Global discovery is a Premium feature' });
    }

    let searchLat = lat ? parseFloat(lat) : null;
    let searchLng = lng ? parseFloat(lng) : null;

    let isPassportOrTravel = false;

    if (currentUser.premium?.isActive && currentUser.passportLocation?.isActive && currentUser.passportLocation?.coordinates?.length >= 2) {
      searchLng = currentUser.passportLocation.coordinates[0];
      searchLat = currentUser.passportLocation.coordinates[1];
      isPassportOrTravel = true;
    }
    else if (currentUser.premium?.isActive && currentUser.activeLocationId) {
      const activeLoc = (currentUser.additionalLocations || []).find(
        l => l._id.toString() === currentUser.activeLocationId.toString()
      );
      if (activeLoc?.lat && activeLoc?.lng) {
        searchLat = activeLoc.lat;
        searchLng = activeLoc.lng;
        isPassportOrTravel = true;
        logger.log(`[DISCOVERY] Using saved location: ${activeLoc.city || activeLoc.name} (${activeLoc.lat}, ${activeLoc.lng})`);
      }
    }

    const blockedUserIds = currentUser.blockedUsers || [];

    const usersWhoBlockedMe = await User.find({
      blockedUsers: req.user.id
    }).select('_id');
    const blockedByIds = usersWhoBlockedMe.map(u => u._id);

    let excludedIds = [
      ...blockedUserIds.map(id => id.toString()),
      ...blockedByIds.map(id => id.toString()),
      req.user.id.toString(),
      ...(currentUser.swipedRight || []).map(id => id.toString()),
      ...(currentUser.swipedLeft || []).map(id => id.toString())
    ];

    const Match = require('../models/Match');
    const matches = await Match.find({ users: req.user.id, status: 'active' });
    const matchedUserIds = matches.flatMap(m => m.users.map(u => u.toString())).filter(id => id !== req.user.id.toString());
    excludedIds = [...excludedIds, ...matchedUserIds];

    // NOTE: We deliberately do NOT exclude users with pending FriendRequests
    // any more. Previously this hid two groups from Discovery:
    //   1. Users I already liked (request where I'm the sender) — already
    //      excluded via swipedRight above, so this was redundant.
    //   2. Users who liked ME but I haven't responded to yet (request where
    //      I'm the receiver) — these were being silently hidden, which is
    //      why people reported "users show on Radar but never appear on
    //      Discovery." Showing them on Discovery lets the swipe trigger an
    //      instant Match (their pending request becomes the mutual right-
    //      swipe in the /swipe handler).
    // Now Discovery and Radar use the same exclusion set: blocked, blocked-by,
    // already-swiped (left or right), and active matches.

    excludedIds = [...new Set(excludedIds)];

    const query = {
      _id: { $nin: excludedIds },
      banned: { $ne: true },
      suspended: { $ne: true },
    };

    const wantVerifiedOnly =
      currentUser.premium?.isActive && (verifiedOnly === 'true' || currentUser.preferences?.showVerifiedOnly === true);
    if (wantVerifiedOnly) query.verified = true;

    const wantOnlineOnly =
      onlineOnly === 'true' || currentUser.preferences?.onlineNow === true;
    if (wantOnlineOnly) query.onlineStatus = 'online';

    const minAgeFilter = minAge ? parseInt(minAge, 10) : (currentUser.preferences?.ageRange?.min || 18);
    const maxAgeFilter = maxAge ? parseInt(maxAge, 10) : (currentUser.preferences?.ageRange?.max || 100);
    query.age = { $gte: Number(minAgeFilter), $lte: Number(maxAgeFilter) };

    const resolvedGenders = genders || currentUser.preferences?.genderPreference;
    if (resolvedGenders && resolvedGenders !== 'both' && resolvedGenders !== 'any') {
      const genderArray = resolvedGenders.split(',').map(g => g.trim().toLowerCase());
      const expandedGenders = [];
      genderArray.forEach(g => {
        expandedGenders.push(g);
        if (g === 'male') expandedGenders.push('man');
        else if (g === 'man') expandedGenders.push('male');
        else if (g === 'female') expandedGenders.push('woman');
        else if (g === 'woman') expandedGenders.push('female');
      });
      query.gender = { $in: [...new Set(expandedGenders)] };
    }

    const resolvedLookingFor = lookingFor || null;
    if (resolvedLookingFor) query.lookingFor = resolvedLookingFor;

    const resolvedReligion = religion || null;
    if (resolvedReligion && resolvedReligion !== 'any') {
      query['lifestyle.religion'] = resolvedReligion;
    }

    const resolvedSmoking = smoking || null;
    if (resolvedSmoking && resolvedSmoking !== 'any') {
      query['lifestyle.smoking'] = resolvedSmoking;
    }

    const resolvedDrinking = drinking || null;
    if (resolvedDrinking && resolvedDrinking !== 'any') {
      query['lifestyle.drinking'] = resolvedDrinking;
    }

    if (wantsKids != null && wantsKids !== 'any') {
      query['lifestyle.wantsKids'] = wantsKids === 'true';
    }

    const isPremium = currentUser.premium?.isActive;
    const FREE_MAX_DISTANCE_KM = 50;

    const rawMaxDist = normaliseMaxDistanceKm(
      maxDistance ? parseInt(maxDistance, 10) : currentUser.preferences?.maxDistance,
      FREE_MAX_DISTANCE_KM
    );
    const maxDist = (isPremium || isGlobal || isPassportOrTravel) ? rawMaxDist : Math.min(rawMaxDist, FREE_MAX_DISTANCE_KM);

    let effectiveLat = searchLat || (lat ? parseFloat(lat) : null);
    let effectiveLng = searchLng || (lng ? parseFloat(lng) : null);

    // Fall back to the user's stored profile coordinates if the client didn't
    // send them on this request (e.g. silent radar refresh).
    if (effectiveLat == null || effectiveLng == null) {
      const stored = currentUser?.location;
      const storedLat = stored?.coordinates?.coordinates?.[1] ?? stored?.lat ?? null;
      const storedLng = stored?.coordinates?.coordinates?.[0] ?? stored?.lng ?? null;
      if (storedLat != null && storedLng != null) {
        effectiveLat = storedLat;
        effectiveLng = storedLng;
      }
    }
    const hasOrigin = effectiveLat != null && effectiveLng != null;

    // Gate: a user who is not using Global discovery and has no usable origin
    // (no GPS in this request, no stored profile coords, no active passport/saved
    // location) must enable location before they can browse. Returning an empty
    // result with `requiresLocation:true` lets the client show a clear prompt
    // instead of silently leaking unfiltered users.
    if (!isGlobal && !hasOrigin) {
      if (resolveInflight) resolveInflight({ users: [], nextCursor: null, requiresLocation: true });
      if (inflightCacheKey) {
        const inflight = req.app.get('discoveryInflight');
        if (inflight) inflight.delete(inflightCacheKey);
      }
      return res.json({
        success: true,
        users: [],
        nextCursor: null,
        requiresLocation: true,
        message: 'Enable location to discover people near you, or switch to Global (Premium) to browse by country.',
      });
    }

    if (isGlobal) {
      if (countryFilter) {
        query['location.country'] = { $regex: new RegExp(countryFilter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') };
      }
    } else if (hasOrigin) {
      // Use the 2dsphere index when origin coordinates are available.
      // $geoWithin / $centerSphere uses the index and only returns docs
      // with valid GeoJSON Point coordinates within the search radius.
      // Legacy users with only flat lat/lng are matched via the second
      // branch of $or so they aren't dropped.
      const radiusKm = Math.max(1, Math.min(maxDist * 2, 20000));
      const radiusInRadians = radiusKm / 6371;
      query.$or = [
        {
          'location.coordinates': {
            $geoWithin: { $centerSphere: [[effectiveLng, effectiveLat], radiusInRadians] }
          }
        },
        {
          'location.lat': { $exists: true },
          'location.coordinates': { $exists: false }
        }
      ];
    }

    const queryStart = Date.now();
    let users = await User.find(query)
      .select('-password -resetPasswordToken -resetPasswordExpire -verificationOTP -verificationOTPExpire')
      .limit(200);
    const queryMs = Date.now() - queryStart;

    users = users.map(user => {
      const userObj = user.toObject();

      const distanceKm = distanceToUser(effectiveLat, effectiveLng, user.location);

      const { total: score, breakdown } = calculateMatchScore(
        userObj,
        currentUser,
        isGlobal ? null : distanceKm,
        maxDist
      );

      return { ...userObj, score, scoreBreakdown: breakdown, distance: distanceKm };
    });

    if (!isGlobal && !isPassportOrTravel && hasOrigin) {
      users = users.filter(u => u.distance == null || u.distance <= maxDist);
    }

    users.sort((a, b) => b.score - a.score);

    const offset = cursor ? Math.max(0, parseInt(cursor, 10) || 0) : 0;
    const totalAvailable = users.length;
    users = users.slice(offset, offset + limit);
    const nextCursor = offset + limit < totalAvailable ? String(offset + limit) : null;

    users = users.map(user => {
      const privacy = user.privacySettings || {};
      const isOnline = user.onlineStatus === 'online' || user.online;
      const distanceVisible = true;

      const visiblePhotos = (user.photos || []).filter(p => !p.privacy || p.privacy === 'public');

      // eslint-disable-next-line no-unused-vars
      const { scoreBreakdown, ...userWithoutBreakdown } = user;

      return {
        ...userWithoutBreakdown,
        photos: visiblePhotos,
        age: privacy.hideAge ? null : user.age,
        online: privacy.showOnlineStatus === false ? null : isOnline,
        onlineStatus: privacy.showOnlineStatus === false ? null : user.onlineStatus,
        distance: distanceVisible ? user.distance : null,
        lastActive: privacy.showLastActive === false ? null : user.lastActive,
      };
    });

    const totalMs = Date.now() - queryStart;
    logger.log(`[DISCOVERY] Returning ${users.length}/${totalAvailable} users (global=${isGlobal}, country=${countryFilter || 'all'}, maxDist=${maxDist}km, premium=${!!isPremium}, queryMs=${queryMs}, totalMs=${totalMs}, offset=${offset})`);

    const payload = { users, nextCursor };
    await redis.set(cacheKey, payload, 120);

    if (resolveInflight) resolveInflight(payload);
    if (inflightCacheKey) {
      const inflight = req.app.get('discoveryInflight');
      if (inflight) inflight.delete(inflightCacheKey);
    }

    res.json({
      success: true,
      users,
      nextCursor
    });
  } catch (error) {
    logger.error('Nearby users error:', error);
    if (rejectInflight) rejectInflight(error);
    if (inflightCacheKey) {
      const inflight = req.app.get('discoveryInflight');
      if (inflight) inflight.delete(inflightCacheKey);
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


router.get('/profile-views', protect, async (req, res) => {
  try {
    const isPremium = req.user.premium?.isActive;
    if (!isPremium) {
      return res.status(403).json({ success: false, message: 'Who viewed me is a Premium feature' });
    }

    const cacheKey = `profileviews:${req.user._id}`;
    const cachedViews = await redis.get(cacheKey);
    if (cachedViews) return res.json({ success: true, views: cachedViews, fromCache: true });

    const user = await User.findById(req.user._id)
      .populate('profileViews.user', 'name username photos age gender');
    
    const uniqueViews = [];
    const seenUsers = new Set();
    
    [...user.profileViews].reverse().forEach(view => {
      if (view.user && !seenUsers.has(view.user._id.toString())) {
        uniqueViews.push(view);
        seenUsers.add(view.user._id.toString());
      }
    });

    await redis.set(cacheKey, uniqueViews, 60);
    res.json({
      success: true,
      views: uniqueViews
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


router.get('/who-viewed-me', protect, async (req, res) => {
  try {
    const isPremium = req.user.premium?.isActive;
    const cacheKey = `whoviewedme:${req.user._id}:${isPremium ? 'premium' : 'free'}`;
    const cachedWVM = await redis.get(cacheKey);
    if (cachedWVM) return res.json({ success: true, ...cachedWVM, fromCache: true });

    const user = await User.findById(req.user._id)
      .populate('profileViews.user', 'name username photos age gender verified');
    
    if (!user.profileViews || user.profileViews.length === 0) {
      return res.json({ success: true, views: [], isPremium });
    }
    
    const uniqueViews = [];
    const seenUsers = new Set();
    
    [...user.profileViews].reverse().forEach(view => {
      if (view.user && !seenUsers.has(view.user._id.toString())) {
        uniqueViews.push(view);
        seenUsers.add(view.user._id.toString());
      }
    });

    const processedViews = uniqueViews.map(view => {
      const viewData = {
        _id: view.user._id,
        name: view.user.name,
        age: view.user.age,
        gender: view.user.gender,
        verified: view.user.verified,
        viewedAt: view.viewedAt
      };
      
      if (isPremium) {
        viewData.photos = view.user.photos;
        viewData.canInteract = true;
      } else {
        viewData.photos = [];
        viewData.isBlurred = true;
        viewData.canInteract = false;
      }
      
      return viewData;
    });

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weeklyViews = (user.profileViews || []).filter(v => new Date(v.viewedAt) >= oneWeekAgo);
    const weeklyViewCount = new Set(weeklyViews.map(v => v.user?._id?.toString()).filter(Boolean)).size;

    const FriendRequest = require('../models/FriendRequest');
    const almostLiked = await FriendRequest.countDocuments({
      receiver: req.user._id,
      status: 'pending',
      createdAt: { $gte: oneWeekAgo }
    });

    const wvmPayload = {
      views: processedViews,
      isPremium,
      totalCount: processedViews.length,
      weeklyInsights: {
        viewsThisWeek: weeklyViewCount,
        almostLikedYou: almostLiked
      }
    };
    await redis.set(cacheKey, wvmPayload, 60);
    res.json({ success: true, ...wvmPayload });
  } catch (error) {
    logger.error('Who viewed me error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    if (!req.user.emailVerified) {
      return res.status(403).json({ success: false, message: 'Please verify your email first' });
    }

    const isOwnProfileCheck = req.user._id.toString() === req.params.id;
    const cacheKey = `profile:${req.params.id}:viewer:${req.user._id}`;
    if (!isOwnProfileCheck) {
      const cachedProfile = await redis.get(cacheKey);
      if (cachedProfile) return res.json({ success: true, user: cachedProfile, fromCache: true });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const { password, resetPasswordToken, resetPasswordExpire, verificationOTP, verificationOTPExpire, ...otherUserInfo } = user.toObject();

    if (req.user._id.toString() !== req.params.id) {
      delete otherUserInfo.email;
      delete otherUserInfo.resetPasswordOTP;
      delete otherUserInfo.resetPasswordOTPExpire;
      delete otherUserInfo.banned;
      delete otherUserInfo.banReason;
      delete otherUserInfo.bannedAt;
      delete otherUserInfo.appeal;
      delete otherUserInfo.suspended;
      delete otherUserInfo.suspendedUntil;
      delete otherUserInfo.tokenVersion;
      delete otherUserInfo.verificationOTP;
      delete otherUserInfo.verificationOTPExpire;
    }

    if (req.user._id.toString() !== req.params.id) {
      const viewerIncognito = req.user.privacySettings?.incognitoMode === true;
      if (!viewerIncognito) {
        await User.findByIdAndUpdate(req.params.id, {
          $push: {
            profileViews: {
              user: req.user._id,
              viewedAt: new Date()
            }
          }
        });
      }
    }

    const isPremium = req.user.premium?.isActive;
    const privacy = user.privacySettings || {};

    if (privacy.hideAge) otherUserInfo.age = null;
    if (privacy.showOnlineStatus === false) {
      otherUserInfo.online = null;
      otherUserInfo.onlineStatus = null;
    }

    if (!isPremium && (privacy.showDistance === false || !isPremium)) {
      otherUserInfo.distance = null;
    }

    if (privacy.showLastActive === false) otherUserInfo.lastActive = null;

    const Match = require('../models/Match');
    const isMatched = await Match.exists({
      users: { $all: [req.user._id, user._id] },
      status: 'active'
    });
    const isOwnProfile = req.user._id.toString() === req.params.id;

    otherUserInfo.photos = (otherUserInfo.photos || []).filter(photo => {
      if (!photo.privacy || photo.privacy === 'public') return true;
      if (photo.privacy === 'friends') return isOwnProfile || isMatched;
      if (photo.privacy === 'private') return isOwnProfile;
      return false;
    });

    if (!isOwnProfileCheck) {
      await redis.set(cacheKey, otherUserInfo, 120);
    }
    res.json({ success: true, user: otherUserInfo });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/photos/:photoIndex', protect, async (req, res) => {
  try {
    const { photoIndex } = req.params;
    const index = parseInt(photoIndex);
    
    const user = await User.findById(req.user._id);
    if (!user || !user.photos) {
      return res.status(400).json({ success: false, message: 'No photos to delete' });
    }
    
    if (index < 0 || index >= user.photos.length) {
      return res.status(400).json({ success: false, message: 'Invalid photo index' });
    }
    
    if (user.photos.length <= 4) {
      return res.status(400).json({ success: false, message: 'You need at least 4 photos on your profile. Add more before deleting this one.' });
    }
    
    user.photos.splice(index, 1);
    
    if (user.photos.length > 0) {
      user.photos = user.photos.map((photo, idx) => ({
        ...photo,
        isPrimary: idx === 0,
        order: idx
      }));
    }
    
    await user.save();
    
    res.json({ success: true, message: 'Photo deleted successfully', photos: user.photos });
  } catch (error) {
    logger.error('Delete photo error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/me', protect, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.user._id);
    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/me/live-location', protect, async (req, res) => {
  try {
    const { lat, latitude, lng, longitude, accuracy, city, country } = req.body || {};
    const numericLat = Number(lat ?? latitude);
    const numericLng = Number(lng ?? longitude);

    if (
      !Number.isFinite(numericLat) || !Number.isFinite(numericLng) ||
      numericLat < -90 || numericLat > 90 ||
      numericLng < -180 || numericLng > 180
    ) {
      return res.status(400).json({ success: false, message: 'Invalid coordinates' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (user.locationSharingEnabled === false) {
      return res.status(403).json({ success: false, message: 'Location sharing is disabled' });
    }

    const resolvedCity = city || user.liveLocation?.city;
    const resolvedCountry = country || user.liveLocation?.country;

    user.liveLocation = {
      type: 'Point',
      coordinates: [numericLng, numericLat],
      city: resolvedCity,
      country: resolvedCountry,
      accuracy: Number.isFinite(Number(accuracy)) ? Number(accuracy) : undefined
    };
    user.liveLocationUpdatedAt = new Date();

    let profileLocationUpdated = false;
    if (user.autoUpdateProfileLocation) {
      user.location = {
        type: 'Point',
        coordinates: [numericLng, numericLat],
        city: resolvedCity || user.location?.city,
        country: resolvedCountry || user.location?.country
      };
      user.locationUpdatedAt = new Date();
      if (resolvedCity || resolvedCountry) {
        user.livingIn = [resolvedCity, resolvedCountry].filter(Boolean).join(', ');
      }
      profileLocationUpdated = true;
    }

    await user.save();

    try { await redis.del(`profile:me:${user._id}`); } catch (_) {}

    res.json({
      success: true,
      liveLocation: user.liveLocation,
      liveLocationUpdatedAt: user.liveLocationUpdatedAt,
      profileLocationUpdated,
      livingIn: user.livingIn,
      location: user.location
    });
  } catch (error) {
    logger.error('Update live location error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/me/locations', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user.premium?.isActive) {
      return res.status(403).json({ success: false, message: 'Premium required for additional locations' });
    }
    if (!user.additionalLocations) user.additionalLocations = [];
    if (user.additionalLocations.length >= 3) {
      return res.status(400).json({ success: false, message: 'Maximum 3 additional locations reached' });
    }

    const { name } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: 'Location name is required' });
    }

    let lat = null, lng = null, city = '', country = '';
    try {
      const geoUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=json&limit=1`;
      const geoRes = await fetch(geoUrl, { headers: { 'User-Agent': 'AfroConnect/1.0' } });
      const geoData = await geoRes.json();
      if (geoData && geoData.length > 0) {
        lat = parseFloat(geoData[0].lat);
        lng = parseFloat(geoData[0].lon);
        const display = geoData[0].display_name?.split(',') || [];
        city = display[0]?.trim() || name;
        country = display[display.length - 1]?.trim() || '';
      }
    } catch (geoErr) {
      logger.warn('Geocoding failed for location:', name, geoErr.message);
    }

    user.additionalLocations.push({ name: name.trim(), lat, lng, city, country });
    await user.save();
    res.json({ success: true, locations: user.additionalLocations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/me/locations/active', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const { locationId } = req.body;

    if (!locationId) {
      user.activeLocationId = null;
      await user.save();
      return res.json({ success: true, message: 'Reverted to GPS location', activeLocationId: null });
    }

    const loc = (user.additionalLocations || []).find(l => l._id.toString() === locationId);
    if (!loc) {
      return res.status(404).json({ success: false, message: 'Location not found' });
    }
    if (!loc.lat || !loc.lng) {
      return res.status(400).json({ success: false, message: 'This location could not be geocoded. Please try a more specific name.' });
    }

    user.activeLocationId = loc._id;
    await user.save();
    res.json({ success: true, message: `Discovery set to ${loc.city || loc.name}`, activeLocationId: loc._id, location: loc });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/passport-location', protect, async (req, res) => {
  try {
    if (!req.user.premium?.isActive) {
      return res.status(403).json({ success: false, message: 'Passport is a Premium feature!' });
    }
    const { lat, lng, city, country, isActive } = req.body;
    const user = await User.findById(req.user._id);
    if (isActive === false) {
      user.passportLocation = { isActive: false };
      await user.save();
      return res.json({ success: true, message: 'Passport location cleared' });
    }
    if (!lat || !lng) {
      return res.status(400).json({ success: false, message: 'Location required' });
    }
    user.passportLocation = {
      type: 'Point',
      coordinates: [parseFloat(lng), parseFloat(lat)],
      city: city || '',
      country: country || '',
      isActive: true
    };
    await user.save();
    res.json({ success: true, message: `Passport set to ${city || 'selected location'}`, passportLocation: user.passportLocation });
  } catch (error) {
    logger.error('Passport location error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/me/locations/:locationId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.activeLocationId?.toString() === req.params.locationId) {
      user.activeLocationId = null;
    }
    user.additionalLocations = (user.additionalLocations || []).filter(
      loc => loc._id.toString() !== req.params.locationId
    );
    await user.save();
    res.json({ success: true, locations: user.additionalLocations, activeLocationId: user.activeLocationId });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;