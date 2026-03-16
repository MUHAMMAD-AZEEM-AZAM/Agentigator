import React, { useRef, forwardRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type BrowserCardProps = {
  visible: boolean;
  url: string;
  onNavigationChange?: (url: string) => void;
  onLoadEnd?: () => void;
  onMessage?: (event: any) => void;
};

export const BrowserCard = forwardRef<WebView, BrowserCardProps>(
  function BrowserCard({ visible, url, onNavigationChange, onLoadEnd, onMessage }, ref) {
    const { colors } = useTheme();
    const translateY = useSharedValue(SCREEN_HEIGHT);

    React.useEffect(() => {
      translateY.value = withSpring(visible ? 0 : SCREEN_HEIGHT, {
        damping: 20,
        stiffness: 90,
      });
    }, [visible]);

    const animatedStyle = useAnimatedStyle(() => {
      return {
        transform: [{ translateY: translateY.value }],
      };
    });

    return (
      <Animated.View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
          },
          animatedStyle,
        ]}
      >
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          {url ? (
              <WebView
              ref={ref}
              source={{ uri: url }}
              style={styles.webview}
              onNavigationStateChange={(navState) => {
                onNavigationChange?.(navState.url);
              }}
              onLoadEnd={onLoadEnd}
              onMessage={onMessage}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={true}
            />
          ) : null}
        </View>
      </Animated.View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    paddingTop: 60,
  },
  card: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
