import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';

type WaveformProps = {
  active: boolean;
  barCount?: number;
};

function WaveformBar({ delay, active }: { delay: number; active: boolean }) {
  const { colors } = useTheme();
  const height = useSharedValue(20);

  useEffect(() => {
    if (active) {
      height.value = withRepeat(
        withSequence(
          withTiming(60, {
            duration: 400 + delay * 50,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(20, {
            duration: 400 + delay * 50,
            easing: Easing.inOut(Easing.ease),
          })
        ),
        -1,
        true
      );
    } else {
      height.value = withTiming(20, { duration: 300 });
    }
  }, [active, delay]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      height: height.value,
    };
  });

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          backgroundColor: colors.primary,
        },
        animatedStyle,
      ]}
    />
  );
}

export function Waveform({ active, barCount = 5 }: WaveformProps) {
  return (
    <View style={styles.container}>
      {Array.from({ length: barCount }).map((_, i) => (
        <WaveformBar key={i} delay={i} active={active} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 80,
  },
  bar: {
    width: 4,
    borderRadius: 2,
    minHeight: 20,
  },
});
