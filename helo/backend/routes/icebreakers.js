const express = require('express');
const router = express.Router();
const IceBreaker = require('../models/IceBreaker');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const defaultIceBreakers = [
  { category: 'general', question: "What's the most spontaneous thing you've ever done?", relatedInterests: [] },
  { category: 'general', question: "If you could have dinner with anyone, dead or alive, who would it be?", relatedInterests: [] },
  { category: 'general', question: "What's your go-to karaoke song?", relatedInterests: ['music', 'singing'] },
  { category: 'music', question: "What song always puts you in a good mood?", relatedInterests: ['music'] },
  { category: 'music', question: "What was the last concert you went to?", relatedInterests: ['music', 'concerts'] },
  { category: 'music', question: "If your life had a theme song, what would it be?", relatedInterests: ['music'] },
  { category: 'movies', question: "What's your all-time favorite movie?", relatedInterests: ['movies', 'film'] },
  { category: 'movies', question: "What's the last movie that made you cry?", relatedInterests: ['movies'] },
  { category: 'movies', question: "Do you prefer Marvel or DC?", relatedInterests: ['movies', 'comics'] },
  { category: 'food', question: "What's your comfort food?", relatedInterests: ['food', 'cooking'] },
  { category: 'food', question: "Pineapple on pizza - yes or no?", relatedInterests: ['food', 'pizza'] },
  { category: 'food', question: "What's the most exotic food you've tried?", relatedInterests: ['food', 'travel'] },
  { category: 'travel', question: "What's your dream travel destination?", relatedInterests: ['travel', 'adventure'] },
  { category: 'travel', question: "Beach vacation or mountain adventure?", relatedInterests: ['travel'] },
  { category: 'travel', question: "What's the best trip you've ever taken?", relatedInterests: ['travel'] },
  { category: 'sports', question: "Do you follow any sports teams?", relatedInterests: ['sports', 'football', 'soccer', 'basketball'] },
  { category: 'sports', question: "What sport would you love to try?", relatedInterests: ['sports', 'fitness'] },
  { category: 'hobbies', question: "What do you do to unwind after a long day?", relatedInterests: [] },
  { category: 'hobbies', question: "What's a hobby you've always wanted to pick up?", relatedInterests: [] },
  { category: 'hobbies', question: "Are you a morning person or a night owl?", relatedInterests: [] },
  { category: 'dating', question: "What's your idea of a perfect date?", relatedInterests: ['dating'] },
  { category: 'dating', question: "What's the most important quality you look for in a partner?", relatedInterests: ['dating'] },
  { category: 'dating', question: "Do you believe in love at first sight?", relatedInterests: ['dating'] },
  { category: 'lifestyle', question: "Coffee or tea?", relatedInterests: ['coffee', 'tea'] },
  { category: 'lifestyle', question: "What's the best advice you've ever received?", relatedInterests: [] },
  { category: 'lifestyle', question: "What's something on your bucket list?", relatedInterests: ['adventure'] }
];

router.get('/suggestions/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const currentUser = await User.findById(req.user.id).select('interests');
    if (!currentUser) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }
    
    const otherUser = await User.findById(userId).select('interests name');
    if (!otherUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const currentInterests = currentUser.interests || [];
    const otherInterests = otherUser.interests || [];
    
    const sharedInterests = currentInterests.filter(
      interest => otherInterests.some(
        otherInterest => otherInterest.toLowerCase() === interest.toLowerCase()
      )
    );

    let iceBreakers = await IceBreaker.find({ isActive: true });
    
    if (iceBreakers.length === 0) {
      await IceBreaker.insertMany(defaultIceBreakers);
      iceBreakers = await IceBreaker.find({ isActive: true });
    }

    let suggestions = [];
    let hasPersonalizedContent = false;
    
    if (sharedInterests.length > 0) {
      const interestLower = sharedInterests.map(i => i.toLowerCase());
      const matchingBreakers = iceBreakers.filter(breaker => 
        breaker.relatedInterests.some(ri => 
          interestLower.some(si => ri.toLowerCase().includes(si) || si.includes(ri.toLowerCase()))
        )
      );
      suggestions = matchingBreakers.slice(0, 3);
      hasPersonalizedContent = suggestions.length > 0;
    }
    
    if (suggestions.length < 5) {
      const generalBreakers = iceBreakers.filter(
        b => (b.category === 'general' || b.category === 'dating') && 
             !suggestions.find(s => s._id.equals(b._id))
      );
      const shuffled = generalBreakers.sort(() => 0.5 - Math.random());
      suggestions = [...suggestions, ...shuffled.slice(0, 5 - suggestions.length)];
    }

    res.json({
      success: true,
      data: {
        sharedInterests,
        hasPersonalizedContent,
        iceBreakers: suggestions.map(ib => ({
          id: ib._id,
          question: ib.question,
          category: ib.category,
          isPersonalized: sharedInterests.length > 0 && ib.relatedInterests.some(ri => 
            sharedInterests.some(si => 
              ri.toLowerCase().includes(si.toLowerCase()) || si.toLowerCase().includes(ri.toLowerCase())
            )
          )
        })),
        otherUserName: otherUser.name
      }
    });
  } catch (error) {
    console.error('Get ice breaker suggestions error:', error);
    res.status(500).json({ success: false, message: 'Failed to load conversation starters' });
  }
});

router.get('/random', protect, async (req, res) => {
  try {
    const { category, count = 3 } = req.query;
    
    let query = { isActive: true };
    if (category) {
      query.category = category;
    }
    
    let iceBreakers = await IceBreaker.find(query);
    
    if (iceBreakers.length === 0 && !category) {
      await IceBreaker.insertMany(defaultIceBreakers);
      iceBreakers = await IceBreaker.find(query);
    }
    
    const shuffled = iceBreakers.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, parseInt(count));
    
    res.json({
      success: true,
      data: selected.map(ib => ({
        id: ib._id,
        question: ib.question,
        category: ib.category
      }))
    });
  } catch (error) {
    console.error('Get random ice breakers error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/categories', protect, async (req, res) => {
  try {
    const categories = ['general', 'music', 'movies', 'food', 'travel', 'sports', 'hobbies', 'dating', 'lifestyle'];
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
