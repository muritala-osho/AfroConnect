import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useApi } from '../hooks/useApi';
import * as Haptics from 'expo-haptics';

interface DealBreaker {
  id: string;
  label: string;
  description: string;
  icon: string;
}

interface DealBreakersProps {
  onSave?: (dealBreakers: string[]) => void;
  onClose?: () => void;
  initialDealBreakers?: string[];
  compact?: boolean;
}

const DEAL_BREAKER_OPTIONS: DealBreaker[] = [
  {
    id: 'smoking',
    label: 'No Smokers',
    description: 'Filter out people who smoke regularly',
    icon: 'ban-outline',
  },
  {
    id: 'drinking',
    label: 'No Heavy Drinkers',
    description: 'Filter out people who drink regularly',
    icon: 'wine-outline',
  },
  {
    id: 'no_kids',
    label: 'Must Not Have Kids',
    description: 'Filter out people who already have children',
    icon: 'people-outline',
  },
  {
    id: 'has_kids',
    label: 'Must Want Kids',
    description: 'Filter out people who don\'t want children',
    icon: 'heart-outline',
  },
  {
    id: 'pets',
    label: 'No Pet Owners',
    description: 'Filter out people who have pets',
    icon: 'paw-outline',
  },
];

export const DealBreakers: React.FC<DealBreakersProps> = ({
  onSave,
  onClose,
  initialDealBreakers = [],
  compact = false,
}) => {
  const { colors } = useTheme();
  const api = useApi();
  
  const [selectedDealBreakers, setSelectedDealBreakers] = useState<string[]>(initialDealBreakers);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (!initialDealBreakers || initialDealBreakers.length === 0) {
      fetchCurrentDealBreakers();
    }
  }, []);

  useEffect(() => {
    const sorted1 = [...selectedDealBreakers].sort();
    const sorted2 = [...initialDealBreakers].sort();
    setHasChanges(JSON.stringify(sorted1) !== JSON.stringify(sorted2));
  }, [selectedDealBreakers, initialDealBreakers]);

  const fetchCurrentDealBreakers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/users/me');
      if (response.success && response.user?.preferences?.dealBreakers) {
        setSelectedDealBreakers(response.user.preferences.dealBreakers);
      }
    } catch (err) {
      console.error('Failed to fetch deal breakers:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleDealBreaker = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDealBreakers(prev => {
      if (prev.includes(id)) {
        return prev.filter(db => db !== id);
      } else {
        return [...prev, id];
      }
    });
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      const response = await api.put('/api/users/me', {
        preferences: {
          dealBreakers: selectedDealBreakers,
        },
      });
      
      if (response.success) {
        onSave?.(selectedDealBreakers);
        onClose?.();
      }
    } catch (err) {
      console.error('Failed to save deal breakers:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (compact) {
    return (
      <View style={[styles.compactContainer, { backgroundColor: colors.card }]}>
        <View style={styles.compactHeader}>
          <Ionicons name="filter" size={18} color={colors.primary} />
          <Text style={[styles.compactTitle, { color: colors.text }]}>
            Deal Breakers
          </Text>
          {selectedDealBreakers.length > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Text style={styles.badgeText}>{selectedDealBreakers.length}</Text>
            </View>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {DEAL_BREAKER_OPTIONS.map(option => {
            const isSelected = selectedDealBreakers.includes(option.id);
            return (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.compactChip,
                  {
                    backgroundColor: isSelected ? colors.primary + '20' : colors.background,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => toggleDealBreaker(option.id)}
              >
                <Ionicons
                  name={option.icon as any}
                  size={14}
                  color={isSelected ? colors.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.compactChipText,
                    { color: isSelected ? colors.primary : colors.textSecondary },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {hasChanges && (
          <TouchableOpacity
            style={[styles.compactSaveButton, { backgroundColor: colors.primary }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.compactSaveText}>Save</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Deal Breakers</Text>
        <TouchableOpacity
          style={[
            styles.saveButton,
            { 
              backgroundColor: hasChanges ? colors.primary : colors.border,
              opacity: saving ? 0.7 : 1,
            },
          ]}
          onPress={handleSave}
          disabled={!hasChanges || saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={[styles.saveButtonText, { color: hasChanges ? '#fff' : colors.textSecondary }]}>
              Save
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Description */}
      <View style={[styles.descriptionBox, { backgroundColor: colors.card }]}>
        <Ionicons name="information-circle" size={24} color={colors.primary} />
        <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>
          Set your deal breakers to automatically filter out profiles that don't match your preferences. 
          These filters are applied to your discovery feed.
        </Text>
      </View>

      {/* Deal Breaker Options */}
      <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
        {DEAL_BREAKER_OPTIONS.map(option => {
          const isSelected = selectedDealBreakers.includes(option.id);
          
          return (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.optionItem,
                {
                  backgroundColor: isSelected ? colors.primary + '10' : colors.card,
                  borderColor: isSelected ? colors.primary : colors.border,
                },
              ]}
              onPress={() => toggleDealBreaker(option.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.optionIcon, { backgroundColor: colors.background }]}>
                <Ionicons
                  name={option.icon as any}
                  size={24}
                  color={isSelected ? colors.primary : colors.textSecondary}
                />
              </View>
              <View style={styles.optionContent}>
                <Text style={[styles.optionLabel, { color: colors.text }]}>
                  {option.label}
                </Text>
                <Text style={[styles.optionDescription, { color: colors.textSecondary }]}>
                  {option.description}
                </Text>
              </View>
              <Switch
                value={isSelected}
                onValueChange={() => toggleDealBreaker(option.id)}
                trackColor={{ false: colors.border, true: colors.primary + '50' }}
                thumbColor={isSelected ? colors.primary : '#f4f3f4'}
              />
            </TouchableOpacity>
          );
        })}

        {/* Warning Note */}
        <View style={[styles.warningBox, { backgroundColor: colors.warning + '15' }]}>
          <Ionicons name="warning" size={20} color={colors.warning} />
          <Text style={[styles.warningText, { color: colors.warning }]}>
            Using too many deal breakers may significantly reduce the number of profiles you see.
          </Text>
        </View>

        {/* Active Filters Summary */}
        {selectedDealBreakers.length > 0 && (
          <View style={[styles.summaryBox, { backgroundColor: colors.card }]}>
            <Text style={[styles.summaryTitle, { color: colors.text }]}>
              Active Filters ({selectedDealBreakers.length})
            </Text>
            <View style={styles.summaryChips}>
              {selectedDealBreakers.map(id => {
                const option = DEAL_BREAKER_OPTIONS.find(o => o.id === id);
                if (!option) return null;
                return (
                  <View
                    key={id}
                    style={[styles.summaryChip, { backgroundColor: colors.primary + '20' }]}
                  >
                    <Text style={[styles.summaryChipText, { color: colors.primary }]}>
                      {option.label}
                    </Text>
                    <TouchableOpacity onPress={() => toggleDealBreaker(id)}>
                      <Ionicons name="close-circle" size={16} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

// Deal Breaker Warning Badge (for discovery cards)
interface DealBreakerWarningProps {
  warnings: Array<{ type: string; level: string; message: string }>;
}

export const DealBreakerWarning: React.FC<DealBreakerWarningProps> = ({ warnings }) => {
  const { colors } = useTheme();
  
  if (!warnings || warnings.length === 0) return null;

  return (
    <View style={[styles.warningBadge, { backgroundColor: colors.warning + '20' }]}>
      <Ionicons name="alert-circle" size={14} color={colors.warning} />
      <Text style={[styles.warningBadgeText, { color: colors.warning }]}>
        {warnings.map(w => w.message).join(', ')}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  saveButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  descriptionBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  descriptionText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    lineHeight: 20,
  },
  optionsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 12,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    marginVertical: 16,
  },
  warningText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 13,
    lineHeight: 18,
  },
  summaryBox: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  summaryChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  summaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  summaryChipText: {
    fontSize: 12,
    fontWeight: '500',
    marginRight: 6,
  },
  // Compact styles
  compactContainer: {
    padding: 12,
    borderRadius: 12,
    marginVertical: 8,
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  compactTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  badge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  compactChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  compactChipText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
  },
  compactSaveButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    marginTop: 12,
  },
  compactSaveText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  // Warning badge styles
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  warningBadgeText: {
    fontSize: 11,
    marginLeft: 4,
  },
});

export default DealBreakers;
