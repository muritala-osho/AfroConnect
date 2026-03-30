import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AnimatedActionButton } from './AnimatedActionButton';
import { useTheme } from '@/hooks/useTheme';

interface ActionButtonsProps {
  onRewind?: () => void;
  onPass?: () => void;
  onLike?: () => void;
  onMessage?: () => void;
  onSuperLike?: () => void;
}

export function ActionButtons({
  onRewind,
  onPass,
  onLike,
  onMessage,
  onSuperLike,
}: ActionButtonsProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <AnimatedActionButton
        icon="rotate-ccw"
        onPress={onRewind || (() => {})}
        color="#fff"
        backgroundColor="#666"
        size={20}
      />
      <AnimatedActionButton
        icon="x"
        onPress={onPass || (() => {})}
        color="#fff"
        backgroundColor="#FF6B6B"
        size={22}
      />
      <AnimatedActionButton
        icon="heart"
        onPress={onLike || (() => {})}
        color="#fff"
        backgroundColor="#FF6B6B"
        size={22}
      />
      <AnimatedActionButton
        icon="send"
        onPress={onMessage || (() => {})}
        color="#fff"
        backgroundColor="#4B9EFF"
        size={20}
      />
      <AnimatedActionButton
        icon="star"
        onPress={onSuperLike || (() => {})}
        color="#fff"
        backgroundColor="#FFD700"
        size={20}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
});
