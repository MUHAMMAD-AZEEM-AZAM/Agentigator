export type AgentState = 'idle' | 'connecting' | 'listening' | 'processing' | 'speaking';

export type BrowserAction = {
  type: 'load_url' | 'click' | 'type_text' | 'scroll' | 'go_back' | 'go_forward' | 'refresh_page';
  payload?: {
    url?: string;
    selector?: string;
    text?: string;
    x?: number;
    y?: number;
  };
};

export type AgentMessage = {
  type: 'state_change' | 'speech' | 'browser_action' | 'request_screenshot' | 'guidance';
  data: any;
};

export type Language = {
  code: string;
  name: string;
  nativeName: string;
};

export type GuidanceHighlight = {
  selector: string;
  message: string;
};
