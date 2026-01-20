
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const OpenAI = require("openai");

let openai;
if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
} else {
  console.log('⚠️ OpenAI API Key not found - AI features will be limited to templates');
}

// @route   POST /api/ai/translate
// @desc    Translate text to a target language
// @access  Private
router.post('/translate', protect, async (req, res) => {
  try {
    const { text, targetLanguage } = req.body;

    if (!text || !targetLanguage) {
      return res.status(400).json({ success: false, message: "Text and targetLanguage are required" });
    }

    if (!openai) {
      return res.status(503).json({ success: false, message: "AI translation service unavailable" });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are a professional polyglot translator specialized in African languages. 
          Translate the following text to ${targetLanguage}. 
          Supported languages include ALL African languages (Swahili, Amharic, Zulu, Shona, Arabic, Wolof, etc.) as well as international ones. 
          Return ONLY the translated text without any explanations or notes.`
        },
        {
          role: "user",
          content: text
        }
      ],
      max_completion_tokens: 1000,
    });

    const translatedText = response.choices[0].message.content.trim();
    res.json({ success: true, translatedText });
  } catch (error) {
    console.error("Translation error:", error);
    res.status(500).json({ success: false, message: "Translation failed" });
  }
});

// Predefined romantic message templates
const romanticTemplates = [
  "Hey! Your smile caught my attention. How's your day going? 😊",
  "I couldn't help but notice we share a love for {interest}. What's your favorite thing about it?",
  "Your profile really stood out to me! Would love to get to know you better ✨",
  "Hi there! I saw you're into {interest} - me too! What got you interested in it?",
  "Hey! Your energy seems amazing. Tell me something interesting about yourself 💫",
  "I love your vibe! What's something you're passionate about?",
  "Your photos are stunning! Where was that {location} picture taken?",
  "Hi! We matched! What's been the highlight of your week? 🌟",
  "Hey beautiful! What's your idea of a perfect date?",
  "I noticed we both love {interest}. Any recommendations?",
];

const iceBreakers = [
  "If you could have dinner with anyone, dead or alive, who would it be?",
  "What's your go-to karaoke song?",
  "Beach vacation or mountain retreat?",
  "What's the best advice you've ever received?",
  "If you could master any skill instantly, what would it be?",
  "Coffee or tea? (This is important 😄)",
  "What's your favorite way to spend a Sunday?",
  "What's something you're looking forward to?",
  "Cats or dogs? Or something more exotic?",
  "What's your guilty pleasure TV show?",
];

// @route   POST /api/ai/suggest-message
// @desc    Get AI-generated romantic message suggestions
// @access  Private
router.post('/suggest-message', protect, async (req, res) => {
  try {
    const { targetUserId, messageType } = req.body;

    const User = require('../models/User');
    const targetUser = await User.findById(targetUserId);

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let suggestions = [];

    if (messageType === 'icebreaker') {
      // Return random ice breakers
      suggestions = iceBreakers
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
    } else {
      // Return personalized romantic messages
      suggestions = romanticTemplates
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(template => {
          let message = template;
          
          // Replace {interest} with random shared interest
          if (template.includes('{interest}') && targetUser.interests.length > 0) {
            const randomInterest = targetUser.interests[
              Math.floor(Math.random() * targetUser.interests.length)
            ];
            message = message.replace('{interest}', randomInterest.toLowerCase());
          }
          
          return message;
        });
    }

    res.json({ 
      success: true, 
      suggestions,
      tip: "Remember to be genuine and authentic! These are just conversation starters."
    });
  } catch (error) {
    console.error('AI suggestion error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
