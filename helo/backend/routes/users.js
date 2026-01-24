const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const { sendOTPEmail } = require('../utils/emailService');
const crypto = require('crypto'); // For generating OTP

// @route   POST /api/auth/signup
// @desc    Register user
// @access  Public
router.post('/register', async (req, res) => {
  const { name, email, password, gender, age } = req.body;

  try {
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    // Generate OTP
    const verificationOTP = crypto.randomInt(100000, 999999).toString();
    const verificationOTPExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

    user = new User({
      name,
      email,
      password,
      gender,
      age,
      verified: false,
      verificationOTP,
      verificationOTPExpire,
      preferences: { // Default preferences
        ageRange: { min: 18, max: 30 },
        maxDistance: 50000,
        language: 'en' // Default language
      },
      lookingFor: gender === 'male' ? 'female' : 'male' // Default lookingFor
    });

    await user.save();

    // Send verification email
    await sendOTPEmail(user.email, user.name, verificationOTP);

    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please check your email for verification.',
      userId: user._id // Return user ID for the next step (verification)
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/auth/verify-email
// @desc    Verify user email with OTP
// @access  Public
router.post('/verify-email', async (req, res) => {
  const { userId, otp } = req.body;

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.verified) {
      return res.status(400).json({ success: false, message: 'User already verified' });
    }

    if (user.verificationOTP !== otp || user.verificationOTPExpire < Date.now()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    user.verified = true;
    user.verificationOTP = undefined;
    user.verificationOTPExpire = undefined;
    await user.save();

    res.json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


// @route   GET /api/users/me
// @desc    Get current user profile
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    // Ensure the user has verified their email before returning profile
    if (!req.user.emailVerified) {
      return res.status(403).json({ success: false, message: 'Please verify your email first' });
    }
    const user = await User.findById(req.user._id);
    res.json({ 
      success: true, 
      user,
      needsVerification: !user.verified,
      profileIncomplete: !user.photos || user.photos.length === 0
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/users/me
// @desc    Update current user profile
// @access  Private
router.put('/me', protect, async (req, res) => {
  try {
    // Ensure the user has verified their email before allowing profile updates
    if (!req.user.emailVerified) {
      return res.status(403).json({ success: false, message: 'Please verify your email first' });
    }

    const updates = req.body;
    const allowedUpdates = [
      'name', 'age', 'gender', 'bio', 'interests', 'photos', 'lookingFor', 
      'preferences', 'location', 'favoriteSong', 'zodiacSign', 
      'jobTitle', 'education', 'livingIn', 'lifestyle', 'ethnicity', 
      'communicationStyle', 'loveStyle', 'personalityType', 'privacySettings',
      'pets', 'relationshipStatus'
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
          Object.keys(updates.preferences).forEach(prefKey => {
            if (prefKey === 'ageRange' && updates.preferences.ageRange) {
              user.preferences.ageRange = {
                ...(user.preferences.ageRange || {}),
                ...updates.preferences.ageRange
              };
            } else if (updates.preferences[prefKey] !== undefined) {
              user.preferences[prefKey] = updates.preferences[prefKey];
            }
          });
        } else if (field === 'lifestyle' && updates.lifestyle) {
          // Merge lifestyle instead of replacing
          user.lifestyle = {
            ...(user.lifestyle && typeof user.lifestyle.toObject === 'function' ? user.lifestyle.toObject() : (user.lifestyle || {})),
            ...updates.lifestyle
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

    res.json({ 
      success: true, 
      user,
      needsVerification: !user.verified,
      profileIncomplete: !user.photos || user.photos.length === 0
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
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

// @route   GET /api/users/nearby
// @desc    Get nearby users based on location and preferences
// @access  Private
router.get('/nearby', protect, async (req, res) => {
  try {
    const { lat, lng, maxDistance, minAge, maxAge, genders, includeAll } = req.query;

    // Ensure the user has verified their email before fetching nearby users
    if (!req.user.emailVerified && process.env.NODE_ENV === 'production') {
      return res.status(403).json({ success: false, message: 'Please verify your email first' });
    }

    // Discovery: Worldwide priority if specified, otherwise nearby
    const currentUser = await User.findById(req.user.id);
    const blockedUserIds = currentUser.blockedUsers || [];
    
    // Also get users who have blocked the current user
    const usersWhoBlockedMe = await User.find({
      blockedUsers: req.user.id
    }).select('_id');
    const blockedByIds = usersWhoBlockedMe.map(u => u._id);

    // Initial query: exclude self, blocked users, and people already swiped
    let excludedIds = [...blockedUserIds, ...blockedByIds, req.user.id];
    
    // In includeAll mode, we might want to see already swiped users for testing
    if (includeAll !== 'true') {
      excludedIds = [...excludedIds, ...(currentUser.swipedRight || []), ...(currentUser.swipedLeft || [])];
    }

    const query = {
      _id: { $nin: excludedIds },
    };

    // If verifiedOnly is passed, filter by verified status
    if (req.query.verifiedOnly === 'true') {
      query.verified = true;
    }

    // Filter by online status if requested
    if (req.query.onlineOnly === 'true') {
      query.online = true;
    }

    // If testing/includeAll, we skip strict filters to show cards
    if (includeAll === 'true') {
      console.log('IncludeAll mode: skipping strict filters and expanding query');
    } else {
      // Age filter
      const minAgeFilter = minAge ? parseInt(minAge) : currentUser.preferences?.ageRange?.min || 18;
      const maxAgeFilter = maxAge ? parseInt(maxAge) : currentUser.preferences?.ageRange?.max || 100;
      query.age = { $gte: minAgeFilter, $lte: maxAgeFilter };

      // Gender filter
      if (genders) {
        const genderArray = genders.split(',');
        query.gender = { $in: genderArray };
      } else {
        const genderPref = currentUser.preferences?.genderPreference || 'both';
        if (genderPref !== 'both') query.gender = genderPref;
      }
    }

    // DISCOVERY LOGIC: Nearby Focus
    const maxDist = maxDistance ? parseInt(maxDistance) : 10000; 
    
    // Don't use geo query - fetch users with any location format and filter in memory
    // This ensures compatibility with both location.coordinates and location.lat/lng formats
    if (lat && lng && includeAll !== 'true') {
      query.$or = [
        { 'location.coordinates': { $exists: true } },
        { 'location.lat': { $exists: true } }
      ];
    }

    let users = await User.find(query)
      .select('-password -resetPasswordToken -resetPasswordExpire -verificationOTP -verificationOTPExpire')
      .limit(200);
    
    users = users.map(user => {
      const userObj = user.toObject();
      let score = 0;

      // Distance calculation - support both location formats
      let distanceKm = 0;
      if (lat && lng) {
        let userLat, userLng;
        if (user.location?.coordinates && user.location.coordinates.length >= 2) {
          userLng = user.location.coordinates[0];
          userLat = user.location.coordinates[1];
        } else if (user.location?.lat && user.location?.lng) {
          userLat = user.location.lat;
          userLng = user.location.lng;
        }
        
        if (userLat && userLng) {
          distanceKm = calculateDistance(
            parseFloat(lat),
            parseFloat(lng),
            userLat,
            userLng
          );
        }
      }

      // Boost nearby users
      score += (maxDist - distanceKm);

      // Personality match
      if (currentUser.lifestyle?.personalityType && user.lifestyle?.personalityType === currentUser.lifestyle?.personalityType) {
        score += 30;
      }

      return { ...userObj, score, distance: distanceKm };
    });

    // Sort: Nearby first, then personality
    users.sort((a, b) => b.score - a.score);
    users = users.slice(0, 40); 

    const isPremium = currentUser.premium?.isActive;

    users = users.map(user => {
      const privacy = user.privacySettings || {};
      const isOnline = user.onlineStatus === 'online' || user.online;
      
      const distanceVisible = isPremium || privacy.showDistance !== false;
      
      return {
        ...user,
        age: privacy.hideAge ? null : user.age,
        online: privacy.showOnlineStatus === false ? null : isOnline,
        onlineStatus: privacy.showOnlineStatus === false ? null : user.onlineStatus,
        distance: distanceVisible ? user.distance : null,
        lastActive: privacy.showLastActive === false ? null : user.lastActive,
      };
    });

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

    res.json({
      success: true,
      views: uniqueViews
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    // Ensure the user has verified their email before fetching other users
    if (!req.user.emailVerified) {
      return res.status(403).json({ success: false, message: 'Please verify your email first' });
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

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

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