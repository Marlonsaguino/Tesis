import type { ChatMessage } from '../types/llm';

export type LlmHealth = {
  configured: boolean;
  model: string | null;
  provider: string | null;
  isOllama?: boolean;
  reachable?: boolean;
  warning?: string | null;
  availableModels?: string[];
};

export type LlmChatResult = {
  message: {
    role: 'assistant';
    content: string | null;
    tool_calls?: Array<{
      id: string;
      type: 'function';
      function: { name: string; arguments: string };
    }>;
  };
  model: string;
};

export async function fetchLlmHealth(): Promise<LlmHealth> {
  try {
    const res = await fetch(window.emailAgentHost.config.apiBaseUrl+'/api/gmail/agent/health',{headers:{'X-EmailAgent-Token':window.emailAgentHost.config.pairingToken},signal:AbortSignal.timeout(8000)});
    if (!res.ok) {
      return { configured: false, model: null, provider: null };
    }
    return (await res.json()) as LlmHealth;
  } catch {
    return { configured: false, model: null, provider: null };
  }
}

export async function chatWithLlm(
  messages: ChatMessage[],
  tools: unknown[]
): Promise<LlmChatResult> {
  const res = await fetch(window.emailAgentHost.config.apiBaseUrl+'/api/gmail/agent/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json','X-EmailAgent-Token':window.emailAgentHost.config.pairingToken },
    body: JSON.stringify({ messages, tools }),
  });

  const data = await res.json();

  if (!res.ok) {
    const err = data as { error?: string; message?: string;detail?: string };
    throw new Error(err.message || err.detail || err.error || `LLM HTTP ${res.status}`);
  }

  return data as LlmChatResult;
}
