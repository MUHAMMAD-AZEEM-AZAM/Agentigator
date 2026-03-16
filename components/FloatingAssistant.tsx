import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { Mic, X } from 'lucide-react-native';

type AgentState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'processing'
  | 'speaking';

type FloatingAssistantProps = {
  state: AgentState;
  message?: string;
  onMicPress?: () => void;
  onClose?: () => void;
};

export function FloatingAssistant({
  state,
  message,
  onMicPress,
  onClose,
}: FloatingAssistantProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const messageOpacity = useSharedValue(0);

  useEffect(() => {
    if (state === 'speaking') {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else if (state === 'listening') {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.15, {
            duration: 600,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      scale.value = withTiming(1, { duration: 300 });
    }
  }, [state]);

  useEffect(() => {
    messageOpacity.value = withTiming(message ? 1 : 0, { duration: 300 });
  }, [message]);

  const bubbleAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const messageAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: messageOpacity.value,
      transform: [
        {
          translateY: messageOpacity.value === 0 ? 10 : 0,
        },
      ],
    };
  });

  return (
    <View style={styles.container}>
      {message && (
        <Animated.View
          style={[
            styles.messageContainer,
            { backgroundColor: colors.surface },
            messageAnimatedStyle,
          ]}
        >
          <Text style={[styles.message, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
            {message}
          </Text>
        </Animated.View>
      )}

      <View style={styles.controls}>
        <TouchableOpacity
          onPress={onMicPress}
          activeOpacity={0.8}
          style={styles.micButton}
        >
          <Animated.View style={bubbleAnimatedStyle}>
            <LinearGradient
              colors={[colors.primaryGradientStart, colors.primaryGradientEnd]}
              style={styles.bubble}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Mic size={28} color="#FFFFFF" />
            </LinearGradient>
          </Animated.View>
        </TouchableOpacity>

        {onClose && (
          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeButton, { backgroundColor: colors.surface }]}
          >
            <X size={20} color={colors.text} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  messageContainer: {
    marginHorizontal: 24,
    marginBottom: 16,
    padding: 16,
    borderRadius: 20,
    maxWidth: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  micButton: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  bubble: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
});
