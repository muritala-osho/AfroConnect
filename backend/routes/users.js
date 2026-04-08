const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const { sendOTP } = require('../utils/emailService');
const crypto = require('crypto'); // For generating OTP
const redis = require('../utils/redis');
const { distanceToUser, normaliseMaxDistanceKm } = require('../utils/distance');
const { calculateMatchScore } = require('../utils/matching');


// @route   GET /api/users/me
// @desc    Get current user profile
// @access  Private
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

// @route   PUT /api/users/me
// @desc    Update current user profile
// @access  Private
router.put('/me', protect, require('../middleware/validate')(require('../validators/schemas').updateProfile), async (req, res) => {
  try {
    // Ensure the user has verified their email before allowing profile updates
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
    ];

    const user = await User.findById(req.user._id);

    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        // Special handling for photos - set first photo as primary
        if (field === 'photos' && Array.isArray(updates[field]) && updates[field].length > 0) {
          user.photos = updates[field].map((photo, index) => ({
            ...photo,
            isPrimary: index === 0,
            order: index
          }));
        }

        // Handle preference updates
        else if (field === 'preferences') {
          // Merge preferences instead of replacing
          const allowedPrefKeys = ['ageRange', 'genderPreference', 'maxDistance', 'showOnlineOnly', 'showVerifiedOnly', 'dealBreakers', 'language'];
          allowedPrefKeys.forEach(prefKey => {
            if (updates.preferences[prefKey] === undefined) return;
            if (prefKey === 'ageRange' && updates.preferences.ageRange) {
              user.preferences.ageRange = {
                ...(user.preferences.ageRange || {}),
                ...updates.preferences.ageRange
              };
            } else {
              user.preferences[prefKey] = updates.preferences[prefKey];
            }
          });
        } else if (field === 'lifestyle' && updates.lifestyle) {
          // Merge lifestyle instead of replacing
          const lifestyleUpdate = { ...updates.lifestyle };
          // Convert pets array to comma-separated string if needed
          if (Array.isArray(lifestyleUpdate.pets)) {
            lifestyleUpdate.pets = lifestyleUpdate.pets.join(',');
          }
          user.lifestyle = {
            ...(user.lifestyle && typeof user.lifestyle.toObject === 'function' ? user.lifestyle.toObject() : (user.lifestyle || {})),
            ...lifestyleUpdate
          };
        } else if (field === 'privacySettings' && updates.privacySettings) {
          // Merge privacySettings
          user.privacySettings = {
            ...(user.privacySettings || {}),
            ...updates.privacySettings
          };
        } else {
          user[field] = updates[field];
        }
      }
    });

    await user.save();
    // Invalidate own profile cache on update
    await redis.del(`profile:me:${req.user._id}`);

    res.json({ 
      success: true, 
      user,
      needsVerification: !user.verified,
      profileIncomplete: !user.photos || user.photos.length === 0
    });
  } catch (error) {
    console.error('Profile update error:', error);
    let message = 'Server error';
    if (error.name === 'ValidationError') {
      message = Object.values(error.errors).map(e => e.message).join(', ');
    } else if (error.message) {
      message = error.message;
    }
    res.status(500).json({ success: false, message });
  }
});

// @route   GET /api/users/search
// @desc    Search users by username or name
// @access  Private
router.get('/search', protect, async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters'
      });
    }

    // Ensure the user has verified their email before allowing search
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
    .select('-password -resetPasswordToken -resetPasswordExpire -verificationOTP -verificationOTPExpire')
    .limit(20);

    res.json({
      success: true,
      users
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/users/countries
// @desc    Get distinct countries from user locations
// @access  Private
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
    console.error('Countries list error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


router.get('/nearby', protect, async (req, res) => {
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

    // Cache discovery results per user (2 min TTL — fast enough to stay fresh)
    const cacheKey = `discovery:${req.user.id}:${isGlobal}:${countryFilter || ''}:${Math.round((parseFloat(lat) || 0) * 10)}:${Math.round((parseFloat(lng) || 0) * 10)}:${maxDistance || ''}:${minAge || ''}:${maxAge || ''}:${genders || ''}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json({ success: true, users: cached, fromCache: true });
    }

    const currentUser = await User.findById(req.user.id);

    if (isGlobal && !currentUser.premium?.isActive) {
      return res.status(403).json({ success: false, message: 'Global discovery is a Premium feature' });
    }

    let searchLat = lat ? parseFloat(lat) : null;
    let searchLng = lng ? parseFloat(lng) : null;
    if (currentUser.premium?.isActive && currentUser.passportLocation?.isActive && currentUser.passportLocation?.coordinates?.length >= 2) {
      searchLng = currentUser.passportLocation.coordinates[0];
      searchLat = currentUser.passportLocation.coordinates[1];
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

    const FriendRequest = require('../models/FriendRequest');
    const pendingRequests = await FriendRequest.find({
      $or: [
        { sender: req.user._id, status: 'pending' },
        { receiver: req.user._id, status: 'pending' }
      ]
    }).select('sender receiver');
    const pendingIds = pendingRequests.map(r => {
      const sid = r.sender.toString();
      const rid = r.receiver.toString();
      return sid === req.user._id.toString() ? rid : sid;
    });
    excludedIds = [...excludedIds, ...pendingIds];

    excludedIds = [...new Set(excludedIds)];

    const query = {
      _id: { $nin: excludedIds },
      banned: { $ne: true },
      suspended: { $ne: true },
    };

    const wantVerifiedOnly =
      verifiedOnly === 'true' || currentUser.preferences?.showVerifiedOnly === true;
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
    const maxDist = isPremium ? rawMaxDist : Math.min(rawMaxDist, FREE_MAX_DISTANCE_KM);

    if (isGlobal) {
      if (countryFilter) {
        query['location.country'] = { $regex: new RegExp(countryFilter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') };
      }
    } else {
      const effectiveLat = searchLat || (lat ? parseFloat(lat) : null);
      const effectiveLng = searchLng || (lng ? parseFloat(lng) : null);

      if (effectiveLat || effectiveLng) {
        query.$or = [
          { 'location.coordinates': { $exists: true } },
          { 'location.lat': { $exists: true } }
        ];
      }
    }

    const effectiveLat = searchLat || (lat ? parseFloat(lat) : null);
    const effectiveLng = searchLng || (lng ? parseFloat(lng) : null);

    let users = await User.find(query)
      .select('-password -resetPasswordToken -resetPasswordExpire -verificationOTP -verificationOTPExpire')
      .limit(200);

    const hasOrigin = effectiveLat != null && effectiveLng != null;

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

    // Apply distance cap for free users in local mode
    if (!isGlobal && hasOrigin && !isPremium) {
      users = users.filter(u => u.distance == null || u.distance <= maxDist);
    }

    // Sort by match score descending (score already encodes distance, recency,
    // interests, profile completeness, etc.)
    users.sort((a, b) => b.score - a.score);

    users = users.slice(0, 40);

    users = users.map(user => {
      const privacy = user.privacySettings || {};
      const isOnline = user.onlineStatus === 'online' || user.online;
      const distanceVisible = isPremium || privacy.showDistance !== false;

      // Filter photos by per-photo privacy — in discovery (no match yet) only show public photos
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

    console.log(`[DISCOVERY] Returning ${users.length} users (global=${isGlobal}, country=${countryFilter || 'all'}, maxDist=${maxDist}km, premium=${!!isPremium})`);

    // Cache discovery results for 2 minutes
    await redis.set(cacheKey, users, 120);

    res.json({
      success: true,
      users
    });
  } catch (error) {
    console.error('Nearby users error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


// @route   GET /api/users/profile-views
// @desc    Get users who viewed current user's profile
// @access  Private
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
    
    // Sort by latest view and remove duplicates (only latest view from each user)
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
    
    // Sort by latest view and remove duplicates (only latest view from each user)
    const uniqueViews = [];
    const seenUsers = new Set();
    
    [...user.profileViews].reverse().forEach(view => {
      if (view.user && !seenUsers.has(view.user._id.toString())) {
        uniqueViews.push(view);
        seenUsers.add(view.user._id.toString());
      }
    });

    // For non-premium users, blur photos but show name and age
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
    console.error('Who viewed me error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private
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
    // Do not return sensitive info like password, OTP etc.
    const { password, resetPasswordToken, resetPasswordExpire, verificationOTP, verificationOTPExpire, ...otherUserInfo } = user.toObject();

    // Log profile view (don't log if viewing own profile)
    if (req.user._id.toString() !== req.params.id) {
      await User.findByIdAndUpdate(req.params.id, {
        $push: {
          profileViews: {
            user: req.user._id,
            viewedAt: new Date()
          }
        }
      });
    }

    // Apply privacy settings
    const isPremium = req.user.premium?.isActive;
    const privacy = user.privacySettings || {};

    if (privacy.hideAge) otherUserInfo.age = null;
    if (privacy.showOnlineStatus === false) {
      otherUserInfo.online = null;
      otherUserInfo.onlineStatus = null;
    }

    // Feature: Distance viewing is premium only
    if (!isPremium && (privacy.showDistance === false || !isPremium)) {
      otherUserInfo.distance = null;
    }

    if (privacy.showLastActive === false) otherUserInfo.lastActive = null;

    // Enforce per-photo privacy
    // Check if viewer is matched with the profile owner (friends-level access)
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

// @route   DELETE /api/users/photos/:photoIndex
// @desc    Delete a specific photo from user's profile
// @access  Private
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
    
    // Don't allow deleting all photos
    if (user.photos.length === 1) {
      return res.status(400).json({ success: false, message: 'You must have at least one photo' });
    }
    
    // Remove photo
    user.photos.splice(index, 1);
    
    // Reset primary photo if needed
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
    console.error('Delete photo error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   DELETE /api/users/me
// @desc    Delete user account
// @access  Private
router.delete('/me', protect, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.user._id);
    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Location routes
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
    user.additionalLocations.push({ name: req.body.name });
    await user.save();
    res.json({ success: true, locations: user.additionalLocations });
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
    console.error('Passport location error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/me/locations/:locationId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.additionalLocations = user.additionalLocations.filter(
      loc => loc._id.toString() !== req.params.locationId
    );
    await user.save();
    res.json({ success: true, locations: user.additionalLocations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;