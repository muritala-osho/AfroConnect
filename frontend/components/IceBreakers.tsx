import React, { useState, useEffect, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useApi } from '@/hooks/useApi';
import * as Haptics from 'expo-haptics';

interface IceBreaker {
  id: string;
  question: string;
  category: string;
  isPersonalized?: boolean;
}

interface IceBreakersProps {
  userId: string;
  onSelectQuestion: (question: string) => void;
  onDismiss?: () => void;
}

const categoryIcons: Record<string, string> = {
  general: 'chatbubble-ellipses',
  music: 'musical-notes',
  movies: 'film',
  food: 'restaurant',
  travel: 'airplane',
  sports: 'football',
  hobbies: 'color-palette',
  dating: 'heart',
  lifestyle: 'sunny',
};

function IceBreakers({ userId, onSelectQuestion, onDismiss }: IceBreakersProps) {
  const { theme } = useTheme();
  const { token } = useAuth();
  const { get } = useApi();
  const [iceBreakers, setIceBreakers] = useState<IceBreaker[]>([]);
  const [sharedInterests, setSharedInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchIceBreakers();
  }, [userId]);

  const fetchIceBreakers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await get<{
        sharedInterests: string[];
        iceBreakers: IceBreaker[];
        otherUserName: string;
        hasPersonalizedContent: boolean;
      }>(`/icebreakers/suggestions/${userId}`, token);

      if (response.success && response.data) {
        const breakers = response.data.iceBreakers || [];
        if (breakers.length === 0) {
          setError('No conversation starters available');
        } else {
          setIceBreakers(breakers);
          setSharedInterests(response.data.sharedInterests || []);
        }
      } else {
        setError(response.error || 'Could not load conversation starters');
      }
    } catch (err: any) {
      setError(err.message || 'Could not load conversation starters');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectQuestion = (question: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelectQuestion(question);
  };

  const handleRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchIceBreakers();
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.card }]}>
        <ActivityIndicator size="small" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
          Finding conversation starters...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: theme.card }]}>
        <Text style={[styles.errorText, { color: theme.textSecondary }]}>
          {error}
        </Text>
        <TouchableOpacity onPress={handleRefresh} style={styles.retryButton}>
          <Text style={[styles.retryText, { color: theme.primary }]}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.card }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="sparkles" size={18} color={theme.primary} />
          <Text style={[styles.title, { color: theme.text }]}>
            Conversation Starters
          </Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
            <Ionicons name="refresh" size={18} color={theme.textSecondary} />
          </TouchableOpacity>
          {onDismiss && (
            <TouchableOpacity onPress={onDismiss} style={styles.dismissButton}>
              <Ionicons name="close" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {sharedInterests.length > 0 && (
        <View style={styles.sharedInterestsContainer}>
          <Text style={[styles.sharedLabel, { color: theme.textSecondary }]}>
            You both like:
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {sharedInterests.slice(0, 3).map((interest, index) => (
              <View
                key={index}
                style={[styles.interestBadge, { backgroundColor: theme.primary + '20' }]}
              >
                <Text style={[styles.interestText, { color: theme.primary }]}>
                  {interest}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.questionsContainer}
      >
        {iceBreakers.map((iceBreaker) => (
          <TouchableOpacity
            key={iceBreaker.id}
            style={[
              styles.questionCard,
              {
                backgroundColor: iceBreaker.isPersonalized
                  ? theme.primary + '15'
                  : theme.background,
                borderColor: iceBreaker.isPersonalized
                  ? theme.primary + '40'
                  : theme.border,
              },
            ]}
            onPress={() => handleSelectQuestion(iceBreaker.question)}
            activeOpacity={0.7}
          >
            <View style={styles.questionHeader}>
              <Ionicons
                name={categoryIcons[iceBreaker.category] as any || 'chatbubble'}
                size={16}
                color={iceBreaker.isPersonalized ? theme.primary : theme.textSecondary}
              />
              {iceBreaker.isPersonalized && (
                <View style={[styles.personalizedBadge, { backgroundColor: theme.primary }]}>
                  <Text style={styles.personalizedText}>Based on interests</Text>
                </View>
              )}
            </View>
            <Text
              style={[styles.questionText, { color: theme.text }]}
              numberOfLines={3}
            >
              {iceBreaker.question}
            </Text>
            <View style={styles.tapHint}>
              <Text style={[styles.tapHintText, { color: theme.textSecondary }]}>
                Tap to use
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    borderRadius: 12,
    marginHorizontal: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
  },
  refreshButton: {
    padding: 4,
  },
  dismissButton: {
    padding: 4,
  },
  loadingText: {
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'center',
  },
  retryText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sharedInterestsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  sharedLabel: {
    fontSize: 12,
  },
  interestBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
  },
  interestText: {
    fontSize: 12,
    fontWeight: '500',
  },
  questionsContainer: {
    paddingVertical: 4,
  },
  questionCard: {
    width: 180,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 10,
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  personalizedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  personalizedText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '600',
  },
  questionText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  tapHint: {
    marginTop: 8,
    alignItems: 'flex-end',
  },
  tapHintText: {
    fontSize: 11,
  },
});

export default memo(IceBreakers);
