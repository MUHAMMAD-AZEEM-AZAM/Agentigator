/**
 * API Configuration
 * Centralized configuration for backend connection
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Get local IP for development
// Run 'ipconfig' on Windows or 'ifconfig' on Mac/Linux to find your IP
// Then update BACKEND_IP below or set EXPO_PUBLIC_BACKEND_IP / EXPO_PUBLIC_BACKEND_PORT

const ENV_BACKEND_IP =
  process.env.EXPO_PUBLIC_BACKEND_IP ||
  (Constants.expoConfig?.extra as { backendIp?: string } | undefined)?.backendIp;

const ENV_BACKEND_PORT =
  process.env.EXPO_PUBLIC_BACKEND_PORT ||
  (Constants.expoConfig?.extra as { backendPort?: string } | undefined)?.backendPort;

const isAndroidEmulator =
  Platform.OS === 'android' && Constants.isDevice === false;

const FALLBACK_IP = isAndroidEmulator ? '10.0.2.2' : '192.168.0.102';

const BACKEND_IP = ENV_BACKEND_IP || FALLBACK_IP;
const BACKEND_PORT = ENV_BACKEND_PORT || '8000';

// Environment-based configuration
const isDevelopment = __DEV__;

export const API_CONFIG = {
  // WebSocket URL for backend connection
  WS_URL: isDevelopment
    ? `ws://${BACKEND_IP}:${BACKEND_PORT}`
    : 'wss://your-production-backend.run.app',
  
  // HTTP URL for REST endpoints (if needed)
  HTTP_URL: isDevelopment
    ? `http://${BACKEND_IP}:${BACKEND_PORT}`
    : 'https://your-production-backend.run.app',
  
  // Connection settings
  RECONNECT_INTERVAL: 3000,
  MAX_RECONNECT_ATTEMPTS: 5,
  
  // Audio settings
  AUDIO_SAMPLE_RATE: 16000,
  AUDIO_CHUNK_SIZE: 4096,
};

// Helper to get current device IP (for display purposes)
export const getDeviceInfo = () => {
  return {
    backendUrl: API_CONFIG.WS_URL,
    environment: isDevelopment ? 'development' : 'production',
  };
};
