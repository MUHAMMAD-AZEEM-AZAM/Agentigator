import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { Globe } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANGUAGE_STORAGE_KEY = 'preferred_language';

type Language = {
  code: string;
  name: string;
  nativeName: string;
};

const languages: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
];

export default function LanguageSelection() {
  const { colors } = useTheme();
  const router = useRouter();
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');

  const handleContinue = async () => {
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, selectedLanguage);
    } catch (e) {
      // Ignore storage errors
    }
    router.replace('/assistant');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
            <Globe size={48} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>
            Choose Your Language
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Select your preferred language for the assistant
          </Text>
        </View>

        <ScrollView
          style={styles.languageList}
          contentContainerStyle={styles.languageListContent}
          showsVerticalScrollIndicator={false}
        >
          {languages.map((language) => (
            <TouchableOpacity
              key={language.code}
              style={[
                styles.languageItem,
                {
                  backgroundColor: colors.surface,
                  borderColor:
                    selectedLanguage === language.code
                      ? colors.primary
                      : colors.border,
                  borderWidth: selectedLanguage === language.code ? 2 : 1,
                },
              ]}
              onPress={() => setSelectedLanguage(language.code)}
            >
              <View style={styles.languageInfo}>
                <Text style={[styles.languageName, { color: colors.text }]}>
                  {language.name}
                </Text>
                <Text
                  style={[styles.languageNative, { color: colors.textSecondary }]}
                >
                  {language.nativeName}
                </Text>
              </View>
              {selectedLanguage === language.code && (
                <View
                  style={[styles.checkmark, { backgroundColor: colors.primary }]}
                >
                  <Text style={styles.checkmarkText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TouchableOpacity
          style={[styles.continueButton, { backgroundColor: colors.primary }]}
          onPress={handleContinue}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  languageList: {
    flex: 1,
  },
  languageListContent: {
    gap: 12,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderRadius: 16,
  },
  languageInfo: {
    flex: 1,
  },
  languageName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  languageNative: {
    fontSize: 14,
  },
  checkmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  continueButton: {
    marginTop: 24,
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
