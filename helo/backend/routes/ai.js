
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

// Language code mapping for MyMemory API
const LANG_NAME_TO_CODE = {
  'english': 'en', 'french': 'fr', 'spanish': 'es', 'portuguese': 'pt', 'arabic': 'ar',
  'swahili': 'sw', 'amharic': 'am', 'yoruba': 'yo', 'hausa': 'ha', 'igbo': 'ig',
  'zulu': 'zu', 'xhosa': 'xh', 'twi': 'tw', 'wolof': 'wo', 'shona': 'sn',
  'somali': 'so', 'oromo': 'om', 'tigrinya': 'ti', 'afrikaans': 'af', 'malagasy': 'mg',
  'chinese': 'zh', 'mandarin': 'zh', 'cantonese': 'zh', 'hindi': 'hi', 'japanese': 'ja',
  'korean': 'ko', 'german': 'de', 'italian': 'it', 'russian': 'ru', 'turkish': 'tr',
  'dutch': 'nl', 'polish': 'pl', 'czech': 'cs', 'swedish': 'sv', 'danish': 'da',
  'norwegian': 'no', 'finnish': 'fi', 'greek': 'el', 'hungarian': 'hu', 'romanian': 'ro',
  'bulgarian': 'bg', 'croatian': 'hr', 'serbian': 'sr', 'ukrainian': 'uk', 'thai': 'th',
  'vietnamese': 'vi', 'indonesian': 'id', 'malay': 'ms', 'tagalog': 'tl', 'filipino': 'tl',
  'bengali': 'bn', 'tamil': 'ta', 'telugu': 'te', 'urdu': 'ur', 'persian': 'fa',
  'farsi': 'fa', 'hebrew': 'he', 'georgian': 'ka', 'armenian': 'hy', 'nepali': 'ne',
  'sinhala': 'si', 'khmer': 'km', 'lao': 'lo', 'burmese': 'my', 'mongolian': 'mn',
  'kazakh': 'kk', 'uzbek': 'uz', 'azerbaijani': 'az', 'catalan': 'ca', 'basque': 'eu',
  'galician': 'gl', 'maltese': 'mt', 'icelandic': 'is', 'estonian': 'et', 'latvian': 'lv',
  'lithuanian': 'lt', 'albanian': 'sq', 'macedonian': 'mk', 'slovenian': 'sl', 'slovak': 'sk',
  'welsh': 'cy', 'irish': 'ga', 'scottish gaelic': 'gd', 'esperanto': 'eo',
  'latin': 'la', 'hawaiian': 'haw', 'samoan': 'sm', 'maori': 'mi',
  'kinyarwanda': 'rw', 'lingala': 'ln', 'luganda': 'lg', 'tswana': 'tn',
  'sesotho': 'st', 'tsonga': 'ts', 'swati': 'ss', 'venda': 've', 'ndebele': 'nr',
  'punjabi': 'pa', 'gujarati': 'gu', 'marathi': 'mr', 'kannada': 'kn', 'malayalam': 'ml',
  'odia': 'or', 'assamese': 'as', 'pashto': 'ps', 'sindhi': 'sd', 'kurdish': 'ku',
};

function getLanguageCode(langName) {
  const normalized = langName.toLowerCase().trim();
  if (LANG_NAME_TO_CODE[normalized]) return LANG_NAME_TO_CODE[normalized];
  // If it's already a 2-letter code, use it directly
  if (normalized.length === 2) return normalized;
  // Try partial match
  const partial = Object.keys(LANG_NAME_TO_CODE).find(k => k.includes(normalized) || normalized.includes(k));
  if (partial) return LANG_NAME_TO_CODE[partial];
  return null;
}

// @route   POST /api/ai/translate
// @desc    Translate text to a target language using MyMemory API
// @access  Private
router.post('/translate', protect, async (req, res) => {
  try {
    const { text, targetLanguage, sourceLanguage } = req.body;

    if (!text || !targetLanguage) {
      return res.status(400).json({ success: false, message: "Text and targetLanguage are required" });
    }

    const targetCode = getLanguageCode(targetLanguage);
    if (!targetCode) {
      return res.status(400).json({ success: false, message: `Language "${targetLanguage}" not recognized. Try using a common language name or 2-letter code.` });
    }

    let sourceCode = 'en';
    if (sourceLanguage) {
      const resolved = getLanguageCode(sourceLanguage);
      if (resolved) sourceCode = resolved;
    }

    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.substring(0, 500))}&langpair=${sourceCode}|${targetCode}`;
    let data;
    try {
      const response = await fetch(url);
      data = await response.json();
    } catch (fetchErr) {
      console.error("MyMemory fetch error:", fetchErr);
      return res.status(502).json({ success: false, message: "Translation service is temporarily unavailable. Please try again later." });
    }

    if (data.responseData?.translatedText) {
      let translatedText = data.responseData.translatedText;
      if (data.responseData.match < 0.5 && data.matches && data.matches.length > 1) {
        const betterMatch = data.matches.find(m => m.translation && m.quality && parseInt(m.quality) > 50);
        if (betterMatch) translatedText = betterMatch.translation;
      }
      res.json({ success: true, translatedText });
    } else {
      res.status(400).json({ success: false, message: data.responseDetails || 'Translation failed' });
    }
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

const chatSuggestionTemplates = [
  "Hey! How's your day going? 😊",
  "I love your profile! What are your hobbies?",
  "What's your favorite thing to do on weekends?",
  "I noticed we have similar interests! Tell me more about yourself",
  "You seem really interesting! What do you do for fun?",
  "Hi there! What made you swipe right on me? 😄",
  "I'd love to get to know you better!",
  "What's the best trip you've ever taken?",
  "What are you passionate about?",
  "Any fun plans for this week?",
  "What's your idea of a perfect date?",
  "Tell me something that made you smile today! 😊",
];

router.post('/chat-suggestions', protect, async (req, res) => {
  try {
    const { recipientName, context } = req.body;
    
    if (openai) {
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are a friendly dating assistant. Generate 5 short, casual, flirty but respectful conversation starters for someone named ${recipientName || 'this person'}. Keep each message under 100 characters. Be warm and genuine. Return as JSON array of strings.`
            },
            {
              role: "user",
              content: context ? `Previous conversation context: ${context}` : "Generate opening messages for a new match."
            }
          ],
          max_completion_tokens: 500,
        });
        
        try {
          const content = response.choices[0].message.content.trim();
          const suggestions = JSON.parse(content);
          return res.json({ success: true, suggestions });
        } catch (parseError) {
          console.log('AI response parse error, using templates');
        }
      } catch (aiError) {
        console.log('AI error, using templates');
      }
    }
    
    const suggestions = chatSuggestionTemplates
      .sort(() => Math.random() - 0.5)
      .slice(0, 5);
    
    res.json({ success: true, suggestions });
  } catch (error) {
    console.error('Chat suggestions error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
