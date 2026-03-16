import React, { createContext, useContext, useState } from 'react';

type AgentState = 'idle' | 'connecting' | 'listening' | 'processing' | 'speaking';

type AgentContextType = {
  state: AgentState;
  isConnected: boolean;
  message: string;
  browserUrl: string;
  browserVisible: boolean;
  setBrowserVisible: (visible: boolean) => void;
};

const AgentContext = createContext<AgentContextType | undefined>(undefined);

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const [state] = useState<AgentState>('idle');
  const [isConnected] = useState(false);
  const [message] = useState('');
  const [browserUrl] = useState('');
  const [browserVisible, setBrowserVisible] = useState(false);

  return (
    <AgentContext.Provider
      value={{
        state,
        isConnected,
        message,
        browserUrl,
        browserVisible,
        setBrowserVisible,
      }}
    >
      {children}
    </AgentContext.Provider>
  );
}

export function useAgent() {
  const context = useContext(AgentContext);
  if (!context) {
    throw new Error('useAgent must be used within AgentProvider');
  }
  return context;
}
