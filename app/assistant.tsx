import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import ViewShot from 'react-native-view-shot';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/contexts/ThemeContext';
import { AssistantAvatar } from '@/components/AssistantAvatar';
import { BrowserCard } from '@/components/BrowserCard';
import { FloatingAssistant } from '@/components/FloatingAssistant';
import { Menu, Mic, MicOff, Wifi, WifiOff } from 'lucide-react-native';
import WebSocketService from '@/services/websocketService';
import BrowserActionHandler from '@/services/browserActionHandler';
import { WebView } from 'react-native-webview';
import { API_CONFIG } from '@/config/api';

type AgentState = 'idle' | 'connecting' | 'listening' | 'processing' | 'speaking';
const LANGUAGE_STORAGE_KEY = 'preferred_language';

// Audio recording config (server decodes to 16kHz PCM)
const RECORDING_OPTIONS: Audio.RecordingOptions = {
  isMeteringEnabled: true,
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 64000,
  },
  ios: {
    extension: '.wav',
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 256000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 128000,
  },
};

// How often to send audio chunks (ms)
const CHUNK_INTERVAL_MS = Platform.OS === 'android' ? 1000 : 250;
const BARGE_IN_METERING_THRESHOLD = -35;
const BARGE_IN_COOLDOWN_MS = 800;
const ENABLE_AUDIO_DEBUG = false;

export default function Assistant() {
  const { colors } = useTheme();
  const [agentState, _setAgentState] = useState<AgentState>('connecting');
  const [isCallActive, setIsCallActive] = useState(false);
  const [browserVisible, setBrowserVisible] = useState(false);
  const [browserUrl, setBrowserUrl] = useState('');
  const [assistantMessage, setAssistantMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [preferredLanguage, setPreferredLanguage] = useState<string>('en');

  // Wrapper for setAgentState to log state changes
  const setAgentState = useCallback((newState: AgentState) => {
    console.log(`[Agent State Change]: ${newState}`);
    _setAgentState(newState);
  }, []);

  const webViewRef = useRef<WebView>(null);
  const viewShotRef = useRef<ViewShot>(null);
  const audioPlayerRef = useRef<Audio.Sound | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const streamingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isStreamingRef = useRef(false);
  // Pending tool call ids for actions that respond via WebView postMessage
  const pendingToolCallIdsRef = useRef<Record<string, string[]>>({
    get_page_text: [],
    wait_for_element: [],
  });
  const pendingActionByToolCallIdRef = useRef<Record<string, string>>({});
  const pendingActionTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Audio playback queue for streamed response chunks
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingAudioRef = useRef(false);
  const bargeInCooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bargeInArmedRef = useRef(true);
  const loadWaitersRef = useRef<Array<(loaded: boolean) => void>>([]);

  const waitForWebView = async (timeoutMs: number = 3000) => {
    const start = Date.now();
    while (!webViewRef.current && Date.now() - start < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return !!webViewRef.current;
  };

  const waitForPageLoad = async (timeoutMs: number = 5000) => {
    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), timeoutMs);
      loadWaitersRef.current.push((loaded) => {
        clearTimeout(timer);
        resolve(loaded);
      });
    });
  };

  useEffect(() => {
    initializeApp();
    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (isConnected && preferredLanguage) {
      WebSocketService.sendConfig({ language: preferredLanguage });
    }
  }, [isConnected, preferredLanguage]);

  const initializeApp = async () => {
    // Request microphone permissions
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      console.log('Microphone permission denied');
    }

    try {
      const storedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (storedLanguage) {
        setPreferredLanguage(storedLanguage);
      }
    } catch {
      // Ignore storage errors
    }

    setupWebSocket();
    BrowserActionHandler.setWebViewRef(webViewRef);
  };

  const cleanup = async () => {
    stopStreaming();
    WebSocketService.disconnect();
    WebSocketService.removeAllListeners();
    await stopAgentAudio();
    await clearAudioQueue();
  };

  // Helper to stop and unload agent's audio cleanly
  const stopAgentAudio = async () => {
    if (audioPlayerRef.current) {
      try {
        await audioPlayerRef.current.stopAsync();
        await audioPlayerRef.current.unloadAsync();
      } catch (e) {
        // Ignore cleanup errors
      }
      audioPlayerRef.current = null;
    }
    await clearAudioQueue();
  };

  const captureAndSendScreenshot = async () => {
    try {
      const uri = await viewShotRef.current?.capture?.({
        format: 'jpg',
        quality: 0.7,
      });
      if (!uri) {
        return { status: 'error', message: 'Screenshot capture failed' };
      }
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      WebSocketService.sendScreenshot(base64, 'image/jpeg');
      return { status: 'success', message: 'Screenshot sent' };
    } catch (error) {
      console.error('Screenshot capture error:', error);
      return { status: 'error', message: 'Screenshot capture error' };
    }
  };

  const clearAudioQueue = async () => {
    if (audioQueueRef.current.length === 0) return;
    const pending = [...audioQueueRef.current];
    audioQueueRef.current = [];
    isPlayingAudioRef.current = false;
    for (const fileUri of pending) {
      try {
        await FileSystem.deleteAsync(fileUri, { idempotent: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  };

  const enqueueAudioChunk = async (wavBase64: string) => {
    try {
      const fileUri = `${FileSystem.cacheDirectory}agent_chunk_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}.wav`;
      await FileSystem.writeAsStringAsync(fileUri, wavBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      audioQueueRef.current.push(fileUri);
      if (!isPlayingAudioRef.current) {
        playNextAudioChunk();
      }
    } catch (e) {
      console.error('Failed to enqueue audio chunk:', e);
    }
  };

  const playNextAudioChunk = async () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingAudioRef.current = false;
      if (isStreamingRef.current) {
        setAgentState('listening');
      } else {
        setAgentState('idle');
      }
      return;
    }

    isPlayingAudioRef.current = true;
    const nextUri = audioQueueRef.current.shift()!;
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: true,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: nextUri },
        { shouldPlay: true, volume: 1.0 },
        async (status) => {
          if (status.isLoaded && status.didJustFinish) {
            try {
              await sound.unloadAsync();
            } catch {
              // Ignore unload errors
            }
            try {
              await FileSystem.deleteAsync(nextUri, { idempotent: true });
            } catch {
              // Ignore cleanup errors
            }
            playNextAudioChunk();
          }
        }
      );

      audioPlayerRef.current = sound;
      setAgentState('speaking');
    } catch (error) {
      console.error('Error playing audio chunk:', error);
      try {
        await FileSystem.deleteAsync(nextUri, { idempotent: true });
      } catch {
        // Ignore cleanup errors
      }
      playNextAudioChunk();
    }
  };

  // ─── WebSocket Setup ──────────────────────────────────────
  const setupWebSocket = () => {
    WebSocketService.onConnect(() => {
      console.log('Connected to backend');
      setIsConnected(true);
      // Wait for Gemini connection_ready before setting idle
    });

    WebSocketService.onDisconnect(() => {
      console.log('Disconnected from backend');
      setIsConnected(false);
      setAgentState('connecting');
      setAssistantMessage('Reconnecting to server...');
    });

    // Gemini session is ready
    WebSocketService.on('connection_ready', (message) => {
      setAgentState('idle');
      setAssistantMessage("Hi! I'm ready to help you. Tap the mic to start talking.");
      if (preferredLanguage) {
        WebSocketService.sendConfig({ language: preferredLanguage });
      }
    });

    // Streamed audio chunks from backend (base64 WAV)
    WebSocketService.on('agent_audio_chunk', async (message) => {
      if (message?.audio) {
        await enqueueAudioChunk(message.audio);
      }
    });

    WebSocketService.on('agent_audio_start', () => {
      setAgentState('speaking');
    });

    WebSocketService.on('agent_audio_end', () => {
      if (!isPlayingAudioRef.current) {
        if (isStreamingRef.current) {
          setAgentState('listening');
        } else {
          setAgentState('idle');
        }
      }
    });

    // Fallback: if backend still emits a full wav URL, try to play it
    WebSocketService.on('agent_stream_start', async (message) => {
      if (!message?.url) return;
      let streamUrl = message.url;
      if (streamUrl.startsWith('/')) {
        streamUrl = API_CONFIG.HTTP_URL + streamUrl;
      }
      try {
        await stopAgentAudio();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
          staysActiveInBackground: true,
        });
        const { sound } = await Audio.Sound.createAsync(
          { uri: streamUrl },
          { shouldPlay: true, volume: 1.0 },
          (status) => {
            if (status.isLoaded && status.didJustFinish) {
              if (isStreamingRef.current) {
                setAgentState('listening');
              } else {
                setAgentState('idle');
              }
            }
          }
        );
        audioPlayerRef.current = sound;
        setAgentState('speaking');
      } catch (error) {
        console.error('Error starting agent stream:', error);
        setAgentState(isStreamingRef.current ? 'listening' : 'idle');
      }
    });

    // Agent text response
    WebSocketService.on('agent_text', (message) => {
      setAssistantMessage(message.text);
    });

    // Turn complete — agent finished its HTTP stream generation
    WebSocketService.on('turn_complete', () => {
      // Only go back to listening if we are actively recording, otherwise idle
      if (isStreamingRef.current) {
        setAgentState('listening');
      } else {
        // NOTE: we wait for the player 'didJustFinish' to become idle if speaking
      }
    });

    // Browser action from agent
    WebSocketService.on('browser_action', async (message) => {
      console.log('Browser action:', message.action, message.params);
      const toolCallId = message.tool_call_id || '';

      // Handle close_browser
      if (message.action === 'close_browser') {
        setBrowserVisible(false);
        setBrowserUrl('');
        return;
      }

      // Ensure browser is visible for any action
      if (!browserVisible) {
        setBrowserVisible(true);
      }

      // Show browser if loading a URL or searching the web
      if (message.action === 'load_url' && message.params?.url) {
        setBrowserUrl(message.params.url);
        setBrowserVisible(true);
      }
      if (message.action === 'search_web' && message.params?.query) {
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(
          message.params.query
        )}`;
        setBrowserUrl(searchUrl);
        setBrowserVisible(true);
      }

      if (message.action === 'load_url' || message.action === 'search_web') {
        const ready = await waitForWebView(3000);
        if (!ready) {
          WebSocketService.sendToolResult(message.action, toolCallId, {
            status: 'error',
            message: 'WebView not ready',
          });
          return;
        }
      }

      // Ensure WebView is mounted for actions that require it
      const requiresWebView = !['load_url', 'search_web', 'close_browser', 'take_screenshot'].includes(
        message.action
      );
      if (requiresWebView) {
        const ready = await waitForWebView(3000);
        if (!ready) {
          WebSocketService.sendToolResult(message.action, toolCallId, {
            status: 'error',
            message: 'WebView not ready',
          });
          return;
        }
      }

      // Execute the browser action
      const result = await BrowserActionHandler.executeAction(
        message.action,
        { ...message.params, toolCallId }
      );

      // Actions that return data via WebView postMessage
      if (message.action === 'get_page_text' || message.action === 'wait_for_element') {
        if (toolCallId) {
          pendingToolCallIdsRef.current[message.action]?.push(toolCallId);
        }
        return; // Don't send result yet, waiting for onMessage
      }

      if (result?.needsResult && toolCallId) {
        pendingActionByToolCallIdRef.current[toolCallId] = message.action;
        if (pendingActionTimeoutsRef.current[toolCallId]) {
          clearTimeout(pendingActionTimeoutsRef.current[toolCallId]);
        }
        pendingActionTimeoutsRef.current[toolCallId] = setTimeout(() => {
          const toolName = pendingActionByToolCallIdRef.current[toolCallId];
          if (toolName) {
            delete pendingActionByToolCallIdRef.current[toolCallId];
            WebSocketService.sendToolResult(toolName, toolCallId, {
              status: 'error',
              message: 'Action timed out',
            });
          }
        }, 4000);
        return; // Wait for action_result from WebView
      }

      // Update URL if changed and ensure browser is visible
      if (result && result.url) {
        setBrowserUrl(result.url);
        setBrowserVisible(true);
      }

      if (message.action === 'load_url' || message.action === 'search_web') {
        await waitForPageLoad(5000);
      }

      if (result?.needsScreenshot || message.action === 'take_screenshot') {
        await captureAndSendScreenshot();
      }

      // Send result back to backend
      WebSocketService.sendToolResult(message.action, toolCallId, result);
    });

    // Error from backend
    WebSocketService.on('error', (message) => {
      console.error('Backend error:', message.message);
      setAssistantMessage(message.message || 'An error occurred');
    });

    // Connect
    WebSocketService.connect();
  };

  // ─── Audio Streaming (Chunked Recording) ──────────────────
  const startStreaming = async () => {
    if (!isConnected) {
      Alert.alert('Not Connected', 'Please wait for connection to the AI assistant');
      return;
    }

    try {
      // INTERRUPT: Stop agent from speaking immediately when human speaks
      await stopAgentAudio();

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      isStreamingRef.current = true;
      setIsCallActive(true);
      setAgentState('listening');

      // Start the chunked recording loop
      recordAndSendChunk();

    } catch (error) {
      console.error('Failed to start streaming:', error);
      Alert.alert('Microphone Error', 'Failed to access microphone');
      isStreamingRef.current = false;
      setIsCallActive(false);
      setAgentState('idle');
    }
  };

  const recordAndSendChunk = async () => {
    if (!isStreamingRef.current) return;

    try {
      // We still use expo-av for recording right now as createAudioPlayer is the main gapless fix.
      // We will leave expo-av recording alone natively or upgrade to expo-audio recorder next. 
      // Using expo-av here is okay for recording chunk-by-chunk since it's just generating files.
      // The massive stutter was strictly on the EXPO-AV PLAYBACK side.
      const { recording } = await Audio.Recording.createAsync(RECORDING_OPTIONS);
      recording.setProgressUpdateInterval(100);
      recording.setOnRecordingStatusUpdate(async (status) => {
        if (!status.isRecording) return;
        if (!bargeInArmedRef.current) return;
        if (agentState === 'speaking' && typeof status.metering === 'number') {
          if (status.metering > BARGE_IN_METERING_THRESHOLD) {
            bargeInArmedRef.current = false;
            await stopAgentAudio();
            WebSocketService.sendUserInterrupt();
            setAgentState('listening');
            if (bargeInCooldownRef.current) {
              clearTimeout(bargeInCooldownRef.current);
            }
            bargeInCooldownRef.current = setTimeout(() => {
              bargeInArmedRef.current = true;
            }, BARGE_IN_COOLDOWN_MS);
          }
        }
      });
      recordingRef.current = recording;

      // Wait for the chunk interval
      streamingTimerRef.current = setTimeout(async () => {
        if (!isStreamingRef.current) return;

        try {
          // Stop this chunk
          await recording.stopAndUnloadAsync();
          const uri = recording.getURI();

          if (uri) {
            // Save a copy of the recorded user voice locally for debugging
            if (__DEV__ && ENABLE_AUDIO_DEBUG) {
              try {
                const timestamp = Date.now();
                const extension = uri.substring(uri.lastIndexOf('.'));
                const localDest = `${FileSystem.documentDirectory}user_voice_${timestamp}${extension}`;
                await FileSystem.copyAsync({ from: uri, to: localDest });
                console.log(`[Audio Saved] User voice copy saved to: ${localDest}`);
              } catch (err) {
                console.log('Error saving user voice:', err);
              }
            }

            // Read the recorded file as base64
            const base64Audio = await FileSystem.readAsStringAsync(uri, {
              encoding: 'base64',
            });

            // Send to backend
            if (base64Audio && isStreamingRef.current) {
              console.log(`[Audio Pipeline] Sending chunk (${base64Audio.length} chars)`);
              WebSocketService.sendAudioChunk(base64Audio);
            }

            // Delete the temp file
            try {
              await FileSystem.deleteAsync(uri, { idempotent: true });
            } catch (e) {
              // Ignore cleanup errors
            }
          }
        } catch (error) {
          console.error('Error processing audio chunk:', error);
        }

        // Start the next chunk immediately
        recordAndSendChunk();

      }, CHUNK_INTERVAL_MS);

    } catch (error) {
      console.error('Error in recording chunk:', error);
      // Retry after a short delay
      if (isStreamingRef.current) {
        setTimeout(() => recordAndSendChunk(), 200);
      }
    }
  };

  const stopStreaming = async () => {
    isStreamingRef.current = false;

    if (streamingTimerRef.current) {
      clearTimeout(streamingTimerRef.current);
      streamingTimerRef.current = null;
    }

    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
        });
      } catch (error) {
        // Ignore errors during cleanup
      }
      recordingRef.current = null;
    }
    if (bargeInCooldownRef.current) {
      clearTimeout(bargeInCooldownRef.current);
      bargeInCooldownRef.current = null;
    }
    bargeInArmedRef.current = true;

    setIsCallActive(false);
    // Don't set to idle if agent is speaking
    if (agentState !== 'speaking') {
      setAgentState('idle');
    }
  };

  const toggleCall = () => {
    if (isCallActive) {
      stopStreaming();
    } else {
      startStreaming();
    }
  };

  // ─── Browser Controls ─────────────────────────────────────
  const closeBrowser = () => {
    setBrowserVisible(false);
    setBrowserUrl('');
    setAssistantMessage('');
    WebSocketService.sendToolResult('close_browser', '', {
      status: 'success',
      message: 'Browser closed by user',
    });
  };

  // ─── Render ───────────────────────────────────────────────
  return (
    <ViewShot
      ref={viewShotRef}
      style={[styles.container, { backgroundColor: '#000000' }]}
      options={{ format: 'jpg', quality: 0.7 }}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton}>
            <Menu size={24} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            {agentState === 'connecting' && (
              <Text style={[styles.headerTitle, { color: colors.textSecondary }]}>
                Connecting...
              </Text>
            )}
            {agentState === 'idle' && (
              <Text style={[styles.headerTitle, { color: colors.textSecondary }]}>
                Ready to assist
              </Text>
            )}
            {agentState === 'listening' && (
              <Text style={[styles.headerTitle, { color: colors.primary }]}>
                Listening...
              </Text>
            )}
            {agentState === 'processing' && (
              <Text style={[styles.headerTitle, { color: colors.primary }]}>
                Processing...
              </Text>
            )}
            {agentState === 'speaking' && (
              <Text style={[styles.headerTitle, { color: colors.primary }]}>
                Speaking...
              </Text>
            )}
          </View>

          <TouchableOpacity style={styles.headerButton}>
            {isConnected ? (
              <Wifi size={24} color={colors.primary} />
            ) : (
              <WifiOff size={24} color={colors.error} />
            )}
          </TouchableOpacity>
        </View>

        {!browserVisible ? (
          <View style={styles.mainContent}>
            <View style={styles.avatarContainer}>
              <AssistantAvatar state={agentState} />
            </View>

            {assistantMessage && (
              <View
                style={[
                  styles.messageContainer,
                  { backgroundColor: colors.surface },
                ]}
              >
                <Text style={[styles.messageText, { color: colors.text }]}>
                  {assistantMessage}
                </Text>
              </View>
            )}



            <View style={styles.controls}>
              <TouchableOpacity
                onPress={toggleCall}
                activeOpacity={0.8}
                style={styles.micButtonContainer}
                disabled={!isConnected}
              >
                <LinearGradient
                  colors={
                    isCallActive
                      ? ['#EF4444', '#DC2626']
                      : isConnected
                      ? [colors.primaryGradientStart, colors.primaryGradientEnd]
                      : ['#666666', '#444444']
                  }
                  style={styles.micButton}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  {isCallActive ? (
                    <MicOff size={32} color="#FFFFFF" />
                  ) : (
                    <Mic size={32} color="#FFFFFF" />
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <Text style={[styles.micHint, { color: colors.textSecondary }]}>
                {!isConnected
                  ? 'Connecting...'
                  : isCallActive
                  ? 'Tap to mute'
                  : 'Tap to talk'}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.browserContainer}>
            <BrowserCard 
              visible={browserVisible} 
              url={browserUrl} 
              ref={webViewRef} 
              onLoadEnd={() => {
                const waiters = [...loadWaitersRef.current];
                loadWaitersRef.current = [];
                waiters.forEach((fn) => fn(true));
              }}
              onMessage={(event) => {
                try {
                  const msgData = JSON.parse(event.nativeEvent.data);
                  console.log("WebView Message:", msgData.type);
                  if (msgData.type === 'page_text_result') {
                     const toolCallId = msgData.tool_call_id || pendingToolCallIdsRef.current.get_page_text?.shift() || '';
                     WebSocketService.sendToolResult('get_page_text', toolCallId, msgData.data);
                  } else if (msgData.type === 'wait_element_result') {
                     const toolCallId = msgData.tool_call_id || pendingToolCallIdsRef.current.wait_for_element?.shift() || '';
                     WebSocketService.sendToolResult('wait_for_element', toolCallId, msgData.data);
                  } else if (msgData.type === 'action_result') {
                     const toolCallId = msgData.tool_call_id || '';
                     const toolName = pendingActionByToolCallIdRef.current[toolCallId];
                     if (toolName) {
                       delete pendingActionByToolCallIdRef.current[toolCallId];
                       if (pendingActionTimeoutsRef.current[toolCallId]) {
                         clearTimeout(pendingActionTimeoutsRef.current[toolCallId]);
                         delete pendingActionTimeoutsRef.current[toolCallId];
                       }
                       WebSocketService.sendToolResult(toolName, toolCallId, msgData.data);
                       if (toolName === 'submit_form' && msgData.data?.status === 'success') {
                         captureAndSendScreenshot();
                       }
                       if (msgData.data?.status === 'error') {
                         captureAndSendScreenshot();
                       }
                     }
                  }
                } catch (e) {
                  console.error("Error parsing webview message", e);
                }
              }}
            />
            <FloatingAssistant
              state={agentState}
              message={assistantMessage}
              onMicPress={toggleCall}
              onClose={closeBrowser}
            />
          </View>
        )}
      </SafeAreaView>
    </ViewShot>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 0,
  },
  avatarContainer: {
    marginBottom: 40,
    overflow: 'visible',
  },
  messageContainer: {
    marginTop: 32,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 20,
    maxWidth: '90%',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },

  controls: {
    position: 'absolute',
    bottom: 60,
    alignItems: 'center',
  },
  micButtonContainer: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  micButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micHint: {
    marginTop: 16,
    fontSize: 14,
  },
  browserContainer: {
    flex: 1,
  },
});
