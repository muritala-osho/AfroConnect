import { GoogleGenAI, Type } from "@google/genai";

export interface ModerationResult {
  riskScore: number;
  reasoning: string;
  flaggedContent: string[];
  actionRecommendation: 'allow' | 'warn' | 'suspend' | 'ban';
}

export const analyzeUserContent = async (bio: string, reportReasons: string[]): Promise<ModerationResult> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze this user's profile and report history for a dating app. 
                 Bio: ${bio}
                 Recent reports: ${reportReasons.join(', ')}
                 Provide a risk score from 0-100 and a recommendation.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            riskScore: { type: Type.NUMBER },
            reasoning: { type: Type.STRING },
            flaggedContent: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            actionRecommendation: { 
              type: Type.STRING,
              enum: ['allow', 'warn', 'suspend', 'ban']
            }
          },
          required: ["riskScore", "reasoning", "actionRecommendation"]
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response text received from Gemini API");
    }
    return JSON.parse(text.trim()) as ModerationResult;
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    return {
      riskScore: 0,
      reasoning: "Analysis unavailable due to system error.",
      flaggedContent: [],
      actionRecommendation: 'allow'
    };
  }
};

/**
 * Uses Google Maps Grounding to get up-to-date information about locations.
 * Using gemini-2.5-flash-native-audio-preview-12-2025 for reliable tool support.
 */
export const getLocationIntel = async (query: string, location?: { latitude: number, longitude: number }) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-native-audio-preview-12-2025",
      contents: `Acting as a Dating App Regional Analyst, provide a safety and trend report for this location/query: ${query}`,
      config: {
        tools: [{ googleMaps: {} }],
        ...(location && {
          toolConfig: {
            retrievalConfig: {
              latLng: {
                latitude: location.latitude,
                longitude: location.longitude
              }
            }
          }
        })
      }
    });

    return {
      text: response.text,
      groundingChunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  } catch (error: any) {
    console.error("Maps Grounding failed:", error);
    return {
      text: "Maps Grounding failed: googleMaps parameter is not supported in Gemini API.",
      groundingChunks: []
    };
  }
};
