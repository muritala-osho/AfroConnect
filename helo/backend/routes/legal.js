
const express = require('express');
const router = express.Router();

// Privacy Policy Content
const PRIVACY_POLICY = {
  lastUpdated: "2025-01-25",
  content: `
# Privacy Policy

Last Updated: January 25, 2025

## Introduction
AfroConnect ("we", "us", or "our") respects your privacy and is committed to protecting your personal data.

## Data We Collect
- **Profile Information**: Name, age, gender, bio, photos, interests
- **Location Data**: Your location for matching purposes
- **Usage Data**: Swipe history, matches, messages, call history
- **Device Information**: Device type, OS version, unique identifiers

## How We Use Your Data
- To provide and improve our matching service
- To facilitate communication between matched users
- To ensure safety and prevent fraud
- To send important notifications about your account

## Data Sharing
We do NOT sell your personal data. We may share data with:
- Other users you match with (limited profile information)
- Service providers (cloud hosting, analytics)
- Law enforcement when legally required

## Your Rights
- Access your data
- Delete your account and data
- Opt out of certain data processing
- Export your data

## Data Security
We use industry-standard encryption and security measures to protect your data.

## Contact Us
For privacy concerns: privacy@afroconnect.com

## Changes to Privacy Policy
We may update this policy and will notify you of significant changes.
  `
};

// Terms of Service Content
const TERMS_OF_SERVICE = {
  lastUpdated: "2025-01-25",
  content: `
# Terms of Service

Last Updated: January 25, 2025

## Agreement to Terms
By using AfroConnect, you agree to these Terms of Service.

## Eligibility
- You must be at least 18 years old
- You must provide accurate information
- One account per person

## User Conduct
You agree NOT to:
- Harass, abuse, or harm other users
- Share inappropriate or offensive content
- Use the service for commercial purposes
- Create fake profiles or impersonate others
- Share other users' information without consent

## Content Rights
- You retain rights to your photos and content
- You grant us license to use your content within the app
- You're responsible for content you share

## Safety
- Report suspicious behavior
- Never share financial information with matches
- Meet in public places for first dates
- We verify some profiles but cannot guarantee authenticity

## Account Termination
We may suspend or terminate accounts that violate these terms.

## Limitation of Liability
AfroConnect is provided "as is". We're not liable for:
- User conduct or safety
- Lost connections or data
- Third-party actions

## Subscription & Payments
- Subscriptions auto-renew unless cancelled
- Refunds subject to our refund policy
- Prices subject to change with notice

## Changes to Terms
We may update these terms and will notify you of material changes.

## Contact
For questions: support@afroconnect.com

## Governing Law
These terms are governed by applicable laws.
  `
};

// @route   GET /api/legal/privacy-policy
// @desc    Get privacy policy
// @access  Public
router.get('/privacy-policy', (req, res) => {
  res.json({
    success: true,
    data: PRIVACY_POLICY
  });
});

// @route   GET /api/legal/terms-of-service
// @desc    Get terms of service
// @access  Public
router.get('/terms-of-service', (req, res) => {
  res.json({
    success: true,
    data: TERMS_OF_SERVICE
  });
});

// @route   GET /api/legal/community-guidelines
// @desc    Get community guidelines
// @access  Public
router.get('/community-guidelines', (req, res) => {
  res.json({
    success: true,
    data: {
      lastUpdated: "2025-01-25",
      content: `
# Community Guidelines

## Be Respectful
Treat everyone with respect and kindness.

## Be Authentic
Use real photos and honest information.

## Be Safe
- Don't share personal information too quickly
- Report suspicious behavior
- Meet in public places

## Be Appropriate
- No nudity or sexual content
- No hate speech or discrimination
- No violence or threats

## Be Legal
Follow all applicable laws and regulations.

Violations may result in account suspension or termination.
      `
    }
  });
});

module.exports = router;
