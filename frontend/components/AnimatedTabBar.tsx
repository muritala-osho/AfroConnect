import React from 'react';
import { View, Pressable, StyleSheet, Platform, Text } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import * as Haptics from 'expo-haptics';
import { useUnread } from '@/contexts/UnreadContext';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const TAB_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  Discovery: 'compass',
  Matches: 'heart',
  Events: 'calendar',
  Stories: 'award',
  Chats: 'message-circle',
  MyProfile: 'user',
};

export default function AnimatedTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { unreadCount } = useUnread();

  return (
    <View
      style={[
        styles.tabBar,
        {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const icon = TAB_ICONS[route.name] || 'circle';
        const showBadge = route.name === 'Chats' && unreadCount > 0;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            navigation.navigate(route.name);
          }
        };

        return (
          <TabButton
            key={route.key}
            icon={icon}
            isFocused={isFocused}
            onPress={onPress}
            theme={theme}
            label={route.name}
            badgeCount={showBadge ? unreadCount : 0}
          />
        );
      })}
    </View>
  );
}

function TabButton({
  icon,
  isFocused,
  onPress,
  theme,
  label,
  badgeCount,
}: {
  icon: keyof typeof Feather.glyphMap;
  isFocused: boolean;
  onPress: () => void;
  theme: any;
  label: string;
  badgeCount: number;
}) {
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);

  const handlePressIn = () => {
    scale.value = withSpring(0.85, { damping: 15 });
    rotation.value = withTiming(isFocused ? 0 : 15, { duration: 100 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15 });
    rotation.value = withTiming(0, { duration: 200 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${rotation.value}deg` },
    ],
  }));

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: isFocused
      ? withSpring(`${theme.primary}15`)
      : withSpring('transparent'),
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.tabButton, containerAnimatedStyle]}
    >
      {/* Icon + optional unread badge */}
      <View style={styles.iconWrapper}>
        <Animated.View style={animatedStyle}>
          <Feather
            name={icon}
            size={22}
            color={isFocused ? theme.primary : theme.textSecondary}
          />
        </Animated.View>

        {/* Unread message count badge */}
        {badgeCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText} numberOfLines={1}>
              {badgeCount > 99 ? '99+' : String(badgeCount)}
            </Text>
          </View>
        )}
      </View>

      <Animated.Text
        style={[
          styles.tabLabel,
          {
            color: isFocused ? theme.primary : theme.textSecondary,
            fontWeight: isFocused ? '600' : '400',
          },
        ]}
      >
        {label}
      </Animated.Text>

      {isFocused && (
        <View style={[styles.activeIndicator, { backgroundColor: theme.primary }]} />
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 16,
    position: 'relative',
  },
  iconWrapper: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 4,
  },
});
