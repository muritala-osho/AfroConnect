
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  verificationOTP: String,
  verificationOTPExpire: Date,
  resetPasswordOTP: String,
  resetPasswordOTPExpire: Date,
  password: {
    type: String,
    required: function() {
      return !this.googleId;
    }
  },
  googleId: {
    type: String,
    sparse: true
  },
  age: {
    type: Number,
    required: true,
    min: 18,
    max: 100
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    required: true
  },
  zodiacSign: {
    type: String,
    enum: ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'],
    default: null
  },
  jobTitle: {
    type: String,
    maxlength: 100,
    trim: true,
    default: ''
  },
  education: {
    type: String,
    enum: ['high_school', 'some_college', 'bachelors', 'masters', 'doctorate', 'trade_school', 'other', 'prefer_not_to_say'],
    default: null
  },
  livingIn: {
    type: String,
    maxlength: 100,
    trim: true,
    default: ''
  },
  bio: {
    type: String,
    maxlength: 500,
    default: ''
  },
  favoriteSong: {
    title: { type: String, maxlength: 200, default: '' },
    artist: { type: String, maxlength: 200, default: '' },
    spotifyUri: { type: String, default: '' }
  },
  spotify: {
    connected: { type: Boolean, default: false },
    userId: { type: String, default: '' },
    displayName: { type: String, default: '' },
    accessToken: { type: String, default: '' },
    refreshToken: { type: String, default: '' },
    tokenExpiry: { type: Date, default: null }
  },
  interests: [{
    type: String,
    trim: true
  }],
  photos: [{
    url: String,
    publicId: String,
    isPrimary: {
      type: Boolean,
      default: false
    },
    privacy: {
      type: String,
      enum: ['public', 'friends', 'private'],
      default: 'public'
    },
    order: {
      type: Number,
      default: 0
    }
  }],
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0]
    },
    city: String,
    country: String
  },
  locationSharingEnabled: {
    type: Boolean,
    default: true
  },
  locationUpdatedAt: {
    type: Date,
    default: Date.now
  },
  verified: {
    type: Boolean,
    default: false
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  expireAt: {
    type: Date,
    index: { expires: '30m' },
    // Only set this for unverified users
    default: function() {
      return this.emailVerified ? undefined : new Date();
    }
  },
  verificationStatus: {
    type: String,
    enum: ['not_requested', 'pending', 'approved', 'rejected'],
    default: 'not_requested'
  },
  verificationPhoto: {
    type: String,
    default: null
  },
  idPhoto: {
    url: String,
    publicId: String,
    submittedAt: Date
  },
  selfiePhoto: {
    url: String,
    publicId: String,
    submittedAt: Date
  },
  verificationRequestDate: {
    type: Date,
    default: null
  },
  verificationApprovedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  verificationApprovedAt: {
    type: Date,
    default: null
  },
  verificationRejectionReason: {
    type: String,
    default: null
  },
  onlineStatus: {
    type: String,
    enum: ['online', 'offline', 'away'],
    default: 'offline'
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  lookingFor: {
    type: String,
    enum: ['relationship', 'friendship', 'casual', 'networking'],
    default: 'relationship'
  },
  preferences: {
    ageRange: {
      min: { type: Number, default: 18 },
      max: { type: Number, default: 50 }
    },
    genderPreference: {
      type: String,
      enum: ['male', 'female', 'both'],
      default: 'both'
    },
    maxDistance: {
      type: Number,
      default: 10000 // 10km in meters
    },
    showOnlineOnly: {
      type: Boolean,
      default: false
    },
    showVerifiedOnly: {
      type: Boolean,
      default: false
    },
    dealBreakers: [{
      type: String,
      enum: ['smoking', 'drinking', 'no_kids', 'has_kids', 'pets']
    }],
    language: {
      type: String,
      enum: ['en', 'es', 'fr', 'pt', 'ar', 'sw', 'yo', 'ig', 'ha', 'zu', 'xh', 'am'],
      default: 'en'
    }
  },
  lifestyle: {
    smoking: {
      type: String,
      enum: ['never', 'socially', 'regularly', 'prefer_not_to_say']
    },
    drinking: {
      type: String,
      enum: ['never', 'socially', 'regularly', 'prefer_not_to_say']
    },
    workout: {
      type: String,
      enum: ['never', 'rarely', 'sometimes', 'regularly', 'very_active', 'prefer_not_to_say'],
      default: null
    },
    religion: {
      type: String,
      enum: ['christian', 'muslim', 'traditional', 'atheist', 'agnostic', 'spiritual', 'other', 'prefer_not_to_say'],
      default: null,
      trim: true
    },
    ethnicity: {
      type: String,
      maxlength: 100,
      trim: true
    },
    communicationStyle: {
      type: String,
      enum: ['introverted', 'ambiverted', 'extroverted', 'prefer_not_to_say'],
      default: null
    },
    loveStyle: {
      type: String,
      enum: ['romantic', 'playful', 'passionate', 'intellectual', 'caring', 'adventurous', 'prefer_not_to_say'],
      default: null
    },
    personalityType: {
      type: String,
      maxlength: 4, // e.g. INFJ
      trim: true
    },
    hasKids: {
      type: Boolean,
      default: false
    },
    wantsKids: {
      type: Boolean
    },
    hasPets: {
      type: Boolean,
      default: false
    },
    pets: {
      type: String,
      default: ''
    },
    relationshipStatus: {
      type: String,
      default: ''
    }
  },
  swipedRight: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  swipedLeft: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  superLiked: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  blockedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  privacySettings: {
    showOnlineStatus: {
      type: Boolean,
      default: true
    },
    showDistance: {
      type: Boolean,
      default: true
    },
    showLastActive: {
      type: Boolean,
      default: true
    },
    hideAge: {
      type: Boolean,
      default: false
    },
    whoCanViewStories: {
      type: String,
      enum: ['friends', 'matches', 'everyone'],
      default: 'friends'
    },
    allowMessageCopying: {
      type: Boolean,
      default: true
    }
  },
  settings: {
    emailNotifications: {
      type: Boolean,
      default: true
    },
    pushNotifications: {
      type: Boolean,
      default: true
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system'
    }
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  banned: {
    type: Boolean,
    default: false
  },
  bannedAt: Date,
  banReason: String,
  suspended: {
    type: Boolean,
    default: false
  },
  suspendedUntil: Date,
  warnings: {
    type: Number,
    default: 0
  },
  appeal: {
    status: {
      type: String,
      enum: ['none', 'pending', 'approved', 'rejected'],
      default: 'none'
    },
    message: {
      type: String,
      maxlength: 1000,
      default: null
    },
    submittedAt: {
      type: Date,
      default: null
    },
    reviewedAt: {
      type: Date,
      default: null
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    adminResponse: {
      type: String,
      maxlength: 500,
      default: null
    },
    lastAppealRejectedAt: {
      type: Date,
      default: null
    }
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  deletionOTP: String,
  deletionOTPExpire: Date,
  premium: {
    isActive: {
      type: Boolean,
      default: false
    },
    plan: {
      type: String,
      enum: ['free', 'plus', 'gold', 'platinum'],
      default: 'free'
    },
    stripeCustomerId: {
      type: String,
      default: null
    },
    stripeSubscriptionId: {
      type: String,
      default: null
    },
    expiresAt: {
      type: Date,
      default: null
    },
    features: {
      unlimitedSwipes: { type: Boolean, default: false },
      seeWhoLikesYou: { type: Boolean, default: false },
      unlimitedRewinds: { type: Boolean, default: false },
      boostPerMonth: { type: Number, default: 0 },
      superLikesPerDay: { type: Number, default: 1 },
      noAds: { type: Boolean, default: false },
      advancedFilters: { type: Boolean, default: false },
      readReceipts: { type: Boolean, default: false },
      priorityMatches: { type: Boolean, default: false },
      incognitoMode: { type: Boolean, default: false },
      voiceNoteLimit: { type: Number, default: 30 }, // Default 30 seconds for free
      unsendLimit: { type: Number, default: 15 } // Minutes
    }
  },
  storyPrivacy: {
    blockedUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    whoCanSee: {
      type: String,
      enum: ['everyone', 'matches', 'friends', 'custom'],
      default: 'matches'
    }
  },
  dailySwipes: {
    count: { type: Number, default: 0 },
    lastReset: { type: Date, default: Date.now }
  },
  dailySuperLikes: {
    count: { type: Number, default: 0 },
    lastReset: { type: Date, default: Date.now }
  },
  profileComments: [{
    _id: mongoose.Schema.Types.ObjectId,
    authorId: mongoose.Schema.Types.ObjectId,
    authorName: String,
    text: String,
    createdAt: { type: Date, default: Date.now }
  }],
  profileViews: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    viewedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Geospatial index for location-based queries
userSchema.index({ location: '2dsphere' });
// Email uniqueness handled by schema definition
userSchema.index({ email: 1 }, { unique: true });

// Hash password before saving
userSchema.pre('save', async function() {
  if (!this.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
