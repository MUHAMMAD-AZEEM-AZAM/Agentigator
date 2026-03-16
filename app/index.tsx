import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

export default function Index() {
  const router = useRouter();
  const { colors } = useTheme();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/language-selection');
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  return <View style={[styles.container, { backgroundColor: colors.background }]} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
