import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import * as Haptics from 'expo-haptics';

type IconFamily = 'ionicons' | 'material' | 'fontawesome';

interface InterestConfig {
  icon: string;
  iconFamily: IconFamily;
  color: string;
  bgColor: string;
}

const interestIcons: Record<string, InterestConfig> = {
  'travel': { icon: 'airplane', iconFamily: 'ionicons', color: '#3498db', bgColor: '#e8f4fc' },
  'music': { icon: 'musical-notes', iconFamily: 'ionicons', color: '#9b59b6', bgColor: '#f4ecf7' },
  'fitness': { icon: 'fitness', iconFamily: 'ionicons', color: '#e74c3c', bgColor: '#fce8e6' },
  'cooking': { icon: 'restaurant', iconFamily: 'ionicons', color: '#e67e22', bgColor: '#fdf2e6' },
  'reading': { icon: 'book', iconFamily: 'ionicons', color: '#2ecc71', bgColor: '#e8f8f0' },
  'movies': { icon: 'film', iconFamily: 'ionicons', color: '#34495e', bgColor: '#ebedef' },
  'photography': { icon: 'camera', iconFamily: 'ionicons', color: '#1abc9c', bgColor: '#e8f6f3' },
  'art': { icon: 'color-palette', iconFamily: 'ionicons', color: '#e91e63', bgColor: '#fce4ec' },
  'gaming': { icon: 'game-controller', iconFamily: 'ionicons', color: '#673ab7', bgColor: '#ede7f6' },
  'dancing': { icon: 'human-female-dance', iconFamily: 'material', color: '#ff5722', bgColor: '#fbe9e7' },
  'hiking': { icon: 'walk', iconFamily: 'ionicons', color: '#4caf50', bgColor: '#e8f5e9' },
  'yoga': { icon: 'meditation', iconFamily: 'material', color: '#00bcd4', bgColor: '#e0f7fa' },
  'coffee': { icon: 'cafe', iconFamily: 'ionicons', color: '#795548', bgColor: '#efebe9' },
  'wine': { icon: 'wine', iconFamily: 'ionicons', color: '#c0392b', bgColor: '#f9ebeb' },
  'fashion': { icon: 'shirt', iconFamily: 'ionicons', color: '#ff4081', bgColor: '#fce4ec' },
  'sports': { icon: 'football', iconFamily: 'ionicons', color: '#ff9800', bgColor: '#fff3e0' },
  'nature': { icon: 'leaf', iconFamily: 'ionicons', color: '#4caf50', bgColor: '#e8f5e9' },
  'pets': { icon: 'paw', iconFamily: 'ionicons', color: '#8d6e63', bgColor: '#efebe9' },
  'tech': { icon: 'hardware-chip', iconFamily: 'ionicons', color: '#607d8b', bgColor: '#eceff1' },
  'writing': { icon: 'pencil', iconFamily: 'ionicons', color: '#5c6bc0', bgColor: '#e8eaf6' },
  'comedy': { icon: 'happy', iconFamily: 'ionicons', color: '#ffc107', bgColor: '#fff8e1' },
  'theater': { icon: 'theater-masks', iconFamily: 'fontawesome', color: '#9c27b0', bgColor: '#f3e5f5' },
  'beach': { icon: 'umbrella-beach', iconFamily: 'fontawesome', color: '#00acc1', bgColor: '#e0f7fa' },
  'camping': { icon: 'bonfire', iconFamily: 'ionicons', color: '#ff7043', bgColor: '#fbe9e7' },
  'cycling': { icon: 'bicycle', iconFamily: 'ionicons', color: '#26a69a', bgColor: '#e0f2f1' },
  'running': { icon: 'running', iconFamily: 'fontawesome', color: '#42a5f5', bgColor: '#e3f2fd' },
  'swimming': { icon: 'water', iconFamily: 'ionicons', color: '#29b6f6', bgColor: '#e1f5fe' },
  'meditation': { icon: 'flower', iconFamily: 'ionicons', color: '#ab47bc', bgColor: '#f3e5f5' },
  'volunteering': { icon: 'hand-left', iconFamily: 'ionicons', color: '#66bb6a', bgColor: '#e8f5e9' },
  'shopping': { icon: 'cart', iconFamily: 'ionicons', color: '#ec407a', bgColor: '#fce4ec' },
  'foodie': { icon: 'pizza', iconFamily: 'ionicons', color: '#ef5350', bgColor: '#ffebee' },
  'concerts': { icon: 'musical-note', iconFamily: 'ionicons', color: '#7e57c2', bgColor: '#ede7f6' },
  'karaoke': { icon: 'mic', iconFamily: 'ionicons', color: '#26c6da', bgColor: '#e0f7fa' },
  'languages': { icon: 'language', iconFamily: 'ionicons', color: '#5c6bc0', bgColor: '#e8eaf6' },
  'astrology': { icon: 'moon', iconFamily: 'ionicons', color: '#7c4dff', bgColor: '#ede7f6' },
  'diy': { icon: 'construct', iconFamily: 'ionicons', color: '#ffa726', bgColor: '#fff3e0' },
  'gardening': { icon: 'flower-outline', iconFamily: 'material', color: '#66bb6a', bgColor: '#e8f5e9' },
  'anime': { icon: 'sparkles', iconFamily: 'ionicons', color: '#f06292', bgColor: '#fce4ec' },
  'podcasts': { icon: 'radio', iconFamily: 'ionicons', color: '#8e24aa', bgColor: '#f3e5f5' },
  'netflix': { icon: 'tv', iconFamily: 'ionicons', color: '#d32f2f', bgColor: '#ffebee' },
  'brunch': { icon: 'sunny', iconFamily: 'ionicons', color: '#ffb300', bgColor: '#fff8e1' },
  'nightlife': { icon: 'moon', iconFamily: 'ionicons', color: '#5e35b1', bgColor: '#ede7f6' },
  'cars': { icon: 'car-sport', iconFamily: 'ionicons', color: '#37474f', bgColor: '#eceff1' },
  'motorcycles': { icon: 'motorcycle', iconFamily: 'fontawesome', color: '#455a64', bgColor: '#eceff1' },
  'basketball': { icon: 'basketball', iconFamily: 'ionicons', color: '#ff5722', bgColor: '#fbe9e7' },
  'soccer': { icon: 'football-outline', iconFamily: 'ionicons', color: '#43a047', bgColor: '#e8f5e9' },
  'tennis': { icon: 'tennisball', iconFamily: 'ionicons', color: '#c0ca33', bgColor: '#f9fbe7' },
  'golf': { icon: 'golf', iconFamily: 'ionicons', color: '#388e3c', bgColor: '#e8f5e9' },
  'skiing': { icon: 'snow', iconFamily: 'ionicons', color: '#03a9f4', bgColor: '#e1f5fe' },
  'surfing': { icon: 'boat', iconFamily: 'ionicons', color: '#00bcd4', bgColor: '#e0f7fa' },
};

const getDefaultConfig = (interest: string): InterestConfig => ({
  icon: 'heart',
  iconFamily: 'ionicons',
  color: '#e91e63',
  bgColor: '#fce4ec',
});

interface InterestBadgeProps {
  interest: string;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  selected?: boolean;
  onPress?: () => void;
}

export const InterestBadge: React.FC<InterestBadgeProps> = ({
  interest,
  size = 'medium',
  showLabel = true,
  selected = false,
  onPress,
}) => {
  const { theme } = useTheme();
  const normalizedInterest = interest.toLowerCase().replace(/\s+/g, '');
  const config = interestIcons[normalizedInterest] || getDefaultConfig(interest);

  const sizeStyles = {
    small: { iconSize: 14, padding: 6, fontSize: 11, gap: 4 },
    medium: { iconSize: 18, padding: 10, fontSize: 13, gap: 6 },
    large: { iconSize: 24, padding: 14, fontSize: 15, gap: 8 },
  };

  const { iconSize, padding, fontSize, gap } = sizeStyles[size];

  const renderIcon = () => {
    const iconColor = selected ? '#FFF' : config.color;
    
    switch (config.iconFamily) {
      case 'material':
        return <MaterialCommunityIcons name={config.icon as any} size={iconSize} color={iconColor} />;
      case 'fontawesome':
        return <FontAwesome5 name={config.icon as any} size={iconSize} color={iconColor} />;
      default:
        return <Ionicons name={config.icon as any} size={iconSize} color={iconColor} />;
    }
  };

  const handlePress = () => {
    if (onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }
  };

  const content = (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: selected ? config.color : config.bgColor,
          paddingVertical: padding * 0.6,
          paddingHorizontal: padding,
          gap,
        },
        selected && styles.selectedBadge,
      ]}
    >
      {renderIcon()}
      {showLabel && (
        <Text
          style={[
            styles.label,
            { fontSize, color: selected ? '#FFF' : config.color },
          ]}
        >
          {interest}
        </Text>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={handlePress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

interface InterestBadgesListProps {
  interests: string[];
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  maxVisible?: number;
  horizontal?: boolean;
  selectedInterests?: string[];
  onInterestPress?: (interest: string) => void;
}

export const InterestBadgesList: React.FC<InterestBadgesListProps> = ({
  interests,
  size = 'medium',
  showLabel = true,
  maxVisible,
  horizontal = false,
  selectedInterests = [],
  onInterestPress,
}) => {
  const { theme } = useTheme();
  const displayInterests = maxVisible ? interests.slice(0, maxVisible) : interests;
  const hiddenCount = maxVisible && interests.length > maxVisible ? interests.length - maxVisible : 0;

  if (horizontal) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalContainer}
      >
        {displayInterests.map((interest, index) => (
          <InterestBadge
            key={`${interest}-${index}`}
            interest={interest}
            size={size}
            showLabel={showLabel}
            selected={selectedInterests.includes(interest)}
            onPress={onInterestPress ? () => onInterestPress(interest) : undefined}
          />
        ))}
        {hiddenCount > 0 && (
          <View style={[styles.moreBadge, { backgroundColor: theme.border }]}>
            <Text style={[styles.moreText, { color: theme.textSecondary }]}>
              +{hiddenCount}
            </Text>
          </View>
        )}
      </ScrollView>
    );
  }

  return (
    <View style={styles.gridContainer}>
      {displayInterests.map((interest, index) => (
        <InterestBadge
          key={`${interest}-${index}`}
          interest={interest}
          size={size}
          showLabel={showLabel}
          selected={selectedInterests.includes(interest)}
          onPress={onInterestPress ? () => onInterestPress(interest) : undefined}
        />
      ))}
      {hiddenCount > 0 && (
        <View style={[styles.moreBadge, { backgroundColor: theme.border }]}>
          <Text style={[styles.moreText, { color: theme.textSecondary }]}>
            +{hiddenCount}
          </Text>
        </View>
      )}
    </View>
  );
};

interface InterestSelectorProps {
  selectedInterests: string[];
  onSelectionChange: (interests: string[]) => void;
  maxSelection?: number;
}

export const InterestSelector: React.FC<InterestSelectorProps> = ({
  selectedInterests,
  onSelectionChange,
  maxSelection = 10,
}) => {
  const { theme } = useTheme();
  const allInterests = Object.keys(interestIcons).map(
    (key) => key.charAt(0).toUpperCase() + key.slice(1)
  );

  const toggleInterest = (interest: string) => {
    const normalizedInterest = interest.toLowerCase();
    const isSelected = selectedInterests.some(
      (i) => i.toLowerCase() === normalizedInterest
    );

    if (isSelected) {
      onSelectionChange(
        selectedInterests.filter((i) => i.toLowerCase() !== normalizedInterest)
      );
    } else if (selectedInterests.length < maxSelection) {
      onSelectionChange([...selectedInterests, interest]);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  };

  return (
    <View style={styles.selectorContainer}>
      <View style={styles.selectorHeader}>
        <Text style={[styles.selectorTitle, { color: theme.text }]}>
          Select Your Interests
        </Text>
        <Text style={[styles.selectorCount, { color: theme.textSecondary }]}>
          {selectedInterests.length}/{maxSelection}
        </Text>
      </View>
      <FlatList
        data={allInterests}
        keyExtractor={(item) => item}
        numColumns={3}
        contentContainerStyle={styles.selectorGrid}
        renderItem={({ item }) => (
          <View style={styles.selectorItem}>
            <InterestBadge
              interest={item}
              size="medium"
              showLabel={true}
              selected={selectedInterests.some(
                (i) => i.toLowerCase() === item.toLowerCase()
              )}
              onPress={() => toggleInterest(item)}
            />
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
  },
  selectedBadge: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  label: {
    fontWeight: '600',
  },
  horizontalContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  moreBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreText: {
    fontWeight: '600',
    fontSize: 13,
  },
  selectorContainer: {
    flex: 1,
  },
  selectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  selectorTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  selectorCount: {
    fontSize: 14,
  },
  selectorGrid: {
    paddingHorizontal: 8,
    paddingBottom: 16,
  },
  selectorItem: {
    flex: 1,
    padding: 4,
    maxWidth: '33.33%',
  },
});

export default InterestBadge;
