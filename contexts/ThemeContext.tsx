import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';

type ThemeMode = 'light' | 'dark' | 'system';

type ThemeColors = {
  background: string;
  card: string;
  text: string;
  textSecondary: string;
  primary: string;
  primaryGradientStart: string;
  primaryGradientEnd: string;
  border: string;
  error: string;
  success: string;
  surface: string;
  surfaceVariant: string;
};

type ThemeContextType = {
  theme: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  setTheme: (theme: ThemeMode) => void;
};

const lightColors: ThemeColors = {
  background: '#FFFFFF',
  card: '#F5F5F5',
  text: '#000000',
  textSecondary: '#666666',
  primary: '#6366F1',
  primaryGradientStart: '#6366F1',
  primaryGradientEnd: '#8B5CF6',
  border: '#E0E0E0',
  error: '#EF4444',
  success: '#10B981',
  surface: '#FFFFFF',
  surfaceVariant: '#F3F4F6',
};

const darkColors: ThemeColors = {
  background: '#0F0F1E',
  card: '#1A1A2E',
  text: '#FFFFFF',
  textSecondary: '#A0A0B0',
  primary: '#8B5CF6',
  primaryGradientStart: '#6366F1',
  primaryGradientEnd: '#A855F7',
  border: '#2A2A3E',
  error: '#F87171',
  success: '#34D399',
  surface: '#16162A',
  surfaceVariant: '#1F1F33',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [theme, setTheme] = useState<ThemeMode>('dark');

  const isDark =
    theme === 'dark' || (theme === 'system' && systemColorScheme === 'dark');

  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ theme, isDark, colors, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
