
import { Alert } from "react-native";

const SENSITIVE_PATTERNS = [
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
  /\b\d{10,11}\b/g,
  /\+\d{1,3}\s?\d{9,11}/g,
  
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  
  /@[A-Za-z0-9_]{3,}/g,
  
  /https?:\/\/[^\s]+/g,
  
  /\b\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Court|Ct|Lane|Ln)\b/gi,
];

const SENSITIVE_KEYWORDS = [
  'whatsapp', 'telegram', 'snapchat', 'instagram', 'facebook',
  'phone number', 'call me', 'text me', 'my number',
  'address', 'live at', 'meet at', 'come to',
  'bank', 'credit card', 'password', 'pin',
];

export function containsSensitiveInfo(text: string): boolean {
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }
  
  const lowerText = text.toLowerCase();
  for (const keyword of SENSITIVE_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      return true;
    }
  }
  
  return false;
}

export function showPersonalInfoWarning(onProceed: () => void, onCancel?: () => void): void {
  Alert.alert(
    "⚠️ Personal Information Detected",
    "We detected that you may be sharing personal contact information. For your safety, we recommend:\n\n• Keep conversations within the app\n• Never share financial information\n• Be cautious of scams\n• Report suspicious behavior\n\nDo you want to continue?",
    [
      {
        text: "Cancel",
        style: "cancel",
        onPress: onCancel,
      },
      {
        text: "Send Anyway",
        style: "destructive",
        onPress: onProceed,
      },
    ]
  );
}
