import { useState, useEffect } from 'react';
import { Send, Bot, User, Cpu, Sparkles, ChevronDown, ChevronRight, Mail, Trash2, Tag, PanelLeftClose, RotateCcw, AlertTriangle } from 'lucide-react';
import type { AgentStep } from '../types/email';
import { fetchLlmHealth, type LlmHealth } from '../services/llmClient';

export interface Message {
  created_at?:string;
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
  steps?: AgentStep[];
}

interface AgentChatProps {
  onSendPrompt: (prompt: string) => Promise<{ answer: string; steps: AgentStep[] }>;
  isProcessing: boolean;
  restoredMessages?: Message[] | null;
  onHistoryChange?: (messages:Message[])=>void;
  onCollapse?: () => void;
  onClearHistory?: () => void;
}

interface QuickAction {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  prompt: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    icon: Sparkles,
    label: 'Resumir urgentes',
    prompt: 'Hazme un resumen de los correos urgentes de hoy'
  },
  {
    icon: Trash2,
    label: 'Limpiar boletines',
    prompt: 'Elimina los boletines y suscripciones de promociones'
  },
  {
    icon: Mail,
    label: 'Redactar confirmación',
    prompt: 'Redacta una respuesta de confirmación a la transferencia bancaria'
  },
  {
    icon: Tag,
    label: 'Etiquetar trabajo',
    prompt: 'Organiza los correos del proyecto con la etiqueta Trabajo'
  }
];

function formatModelDetails(llmHealth: LlmHealth | null) {
  if (!llmHealth || !llmHealth.configured) {
    return {
      full: 'Motor de reglas (sin IA)',
      compact: 'Motor de reglas',
      short: 'Local',
      provider: 'Motor Local',
      isConfigured: false,
      isOllama: false,
      isReachable: true,
      tooltip: 'Ejecutando en modo local seguro sin API key externa'
    };
  }

  const rawModel = llmHealth.model || 'Modelo IA';
  const provider = llmHealth.provider || 'LLM';
  const isOllama = Boolean(llmHealth.isOllama || provider.toLowerCase().includes('ollama'));
  const isReachable = llmHealth.reachable !== false;

  // Format clean human-readable version
  let compact = rawModel;
  if (rawModel.includes('gemini-3.8-flash')) compact = 'Gemini 3.8 Flash';
  else if (rawModel.includes('gemini-2.0-flash')) compact = 'Gemini 2.0 Flash';
  else if (rawModel.includes('gemini-1.5-flash')) compact = 'Gemini 1.5 Flash';
  else if (rawModel.includes('gemini-1.5-pro')) compact = 'Gemini 1.5 Pro';
  else if (rawModel.includes('gpt-4o-mini')) compact = 'GPT-4o mini';
  else if (rawModel.includes('gpt-4o')) compact = 'GPT-4o';
  else if (rawModel.includes('claude-3-5')) compact = 'Claude 3.5 Sonnet';
  else if (rawModel.includes('llama3.2')) compact = 'Llama 3.2';
  else if (rawModel.includes('llama3.1')) compact = 'Llama 3.1';
  else if (rawModel.includes('llama3.3')) compact = 'Llama 3.3';
  else if (rawModel.includes('qwen3')) compact = 'Qwen 3 4B';
  else if (rawModel.includes('qwen2.5')) compact = 'Qwen 2.5';
  else if (rawModel.includes('qwen')) compact = 'Qwen';
  else if (rawModel.includes('mistral')) compact = 'Mistral';
  else if (rawModel.includes('deepseek')) compact = 'DeepSeek R1';

  let full = `${provider} · ${compact}`;
  if (isOllama) {
    full = isReachable ? `Ollama Local · ${compact}` : `Ollama (Off) · ${compact}`;
    compact = isReachable ? `${compact} (Local)` : `${compact} (Off)`;
  }

  const tooltip = isOllama
    ? isReachable
      ? `Ollama Local (Sin costo de tokens) | Modelo: ${rawModel} | Procesamiento local`
      : `Ollama no responde en http://localhost:11434. Asegúrate de ejecutar 'ollama serve'.`
    : `Proveedor: ${provider} | Modelo: ${rawModel} | Guardrails Activos`;

  return {
    full,
    compact,
    short: compact.split(' ')[0] || compact,
    provider: isOllama ? 'Ollama Local' : provider,
    isConfigured: true,
    isOllama,
    isReachable,
    tooltip
  };
}

export const AgentChat: React.FC<AgentChatProps> = ({ onSendPrompt, isProcessing, onCollapse, onClearHistory, restoredMessages, onHistoryChange }) => {
  const [input, setInput] = useState('');
  const [llmHealth, setLlmHealth] = useState<LlmHealth | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});

  const initialMessage: Message = {
    id: 'm-1',
    sender: 'agent',
    text: '¡Hola! Soy tu **Agente de IA para Gestión de Correo**. Puedo leer, clasificar, redactar y ejecutar acciones en lenguaje natural.\n\n🧠 *Recuerdo el contexto de nuestra conversación para responder preguntas de seguimiento.*\n🔒 *Todas las acciones sensibles requieren tu autorización mediante Guardrails.*',
    timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  };

  const [messages, setMessages] = useState<Message[]>([initialMessage]);
  useEffect(()=>{if(restoredMessages!==null && restoredMessages!==undefined)setMessages(restoredMessages.length?restoredMessages:[initialMessage]);},[restoredMessages]);
  useEffect(()=>{onHistoryChange?.(messages);},[messages]);

  useEffect(() => {
    fetchLlmHealth().then(setLlmHealth);
  }, []);

  const modelInfo = formatModelDetails(llmHealth);
  const userTurnCount = messages.filter(m => m.sender === 'user').length;

  const handleClear = () => {
    if (isProcessing) return;
    setMessages([
      {
        ...initialMessage,
        id: `m-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    setExpandedSteps({});
    onClearHistory?.();
  };

  const toggleSteps = (msgId: string) => {
    setExpandedSteps(prev => ({
      ...prev,
      [msgId]: prev[msgId] === undefined ? false : !prev[msgId]
    }));
  };

  const handleSend = async (textToSend?: string) => {
    const promptText = textToSend || input;
    if (!promptText.trim() || isProcessing) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),created_at:new Date().toISOString(),
      sender: 'user',
      text: promptText,
      timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInput('');

    try {
      const res = await onSendPrompt(promptText);
      const agentMsg: Message = {
        id: crypto.randomUUID(),created_at:new Date().toISOString(),
        sender: 'agent',
        text: res.answer,
        timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        steps: res.steps
      };
      setMessages(prev => [...prev, agentMsg]);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="chat-header-main-row">
          <div className="chat-header-title">
            <Bot className="w-4 h-4 bot-icon" />
            <h2>Chat del agente IA (Gmail)</h2>
          </div>

          <div className="chat-header-controls">
            {/* Wide Screen Badge (Adapts full/compact via container queries) */}
            <span
              className={`badge-status header-badge-wide ${modelInfo.isConfigured ? 'connected' : ''}`}
              title={modelInfo.tooltip}
            >
              <Sparkles className="w-3 h-3" />
              <span className="model-text-full">{modelInfo.full}</span>
              <span className="model-text-compact">{modelInfo.compact}</span>
            </span>

            {/* Reset / New conversation button */}
            <button
              onClick={handleClear}
              disabled={isProcessing || userTurnCount === 0}
              className="icon-button"
              title="Reiniciar conversación y limpiar memoria del agente"
              aria-label="Reiniciar chat"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {onCollapse && (
              <button
                onClick={onCollapse}
                className="icon-button collapse-btn desktop-only"
                title="Colapsar panel del Agente"
                aria-label="Colapsar panel"
              >
                <PanelLeftClose className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Responsive Sub-bar: Appears gracefully when panel is narrow so model info is never clipped! */}
        <div className="chat-header-subbar" title={modelInfo.tooltip}>
          <div className={`model-subbar-pill ${modelInfo.isConfigured ? 'connected' : ''}`}>
            <span className={`status-dot ${modelInfo.isConfigured ? 'active' : 'warning'}`} />
            <span className="subbar-provider">{modelInfo.provider}:</span>
            <span className="subbar-model">{modelInfo.compact}</span>
          </div>

          {userTurnCount > 0 ? (
            <span className="subbar-badge" title="El agente recuerda los mensajes previos de esta sesión">
              🧠 Memoria: {userTurnCount} {userTurnCount === 1 ? 'mensaje' : 'mensajes'}
            </span>
          ) : (
            <span className="subbar-badge">Guardrails Activos</span>
          )}
        </div>
      </div>

      {llmHealth?.isOllama && llmHealth?.warning && (
        <div className="ollama-notice-banner" role="alert">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>{llmHealth.warning}</span>
        </div>
      )}

      <div className="chat-messages">
        {messages.map(msg => {
          const isStepsExpanded = expandedSteps[msg.id] ?? true;
          return (
            <div key={msg.id} className={`chat-bubble-wrapper ${msg.sender}`}>
              <div className="avatar" aria-hidden="true">
                {msg.sender === 'user' ? (
                  <User className="w-3.5 h-3.5" />
                ) : (
                  <Bot className="w-3.5 h-3.5" />
                )}
              </div>

              <div className="bubble-content">
                {/* Reasoning trace disclosure */}
                {msg.steps && msg.steps.length > 0 && (
                  <div className="reasoning-accordion">
                    <button
                      type="button"
                      onClick={() => toggleSteps(msg.id)}
                      className="accordion-title w-full text-left bg-transparent border-0 cursor-pointer p-0"
                    >
                      {isStepsExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                      <Cpu className="w-3.5 h-3.5" />
                      <span>Trazabilidad de Razonamiento ({msg.steps.length} pasos)</span>
                    </button>

                    {isStepsExpanded && (
                      <div className="steps-list mt-2">
                        {msg.steps.map((step, idx) => (
                          <div key={idx} className="step-item">
                            <div className="step-header">
                              {step.type === 'THINKING' && (
                                <span className="step-badge thinking">Pensamiento</span>
                              )}
                              {step.type === 'TOOL_CALL' && (
                                <span className="step-badge tool">Herramienta</span>
                              )}
                              {step.type === 'GUARDRAIL_CHECK' && (
                                <span className="step-badge guardrail">Guardrail</span>
                              )}
                              {step.type === 'ACTION_CREATED' && (
                                <span className="step-badge action">Firma Requerida</span>
                              )}
                              <span className="step-time">{step.timestamp}</span>
                            </div>
                            <p className="step-msg">{step.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="message-text">
                  {msg.text.split('\n').map((line, i) => (
                    <p key={i} className={line.trim() === '' ? 'h-2' : 'mb-1'}>
                      {line}
                    </p>
                  ))}
                </div>

                <span className="message-time">{msg.timestamp}</span>
              </div>
            </div>
          );
        })}

        {isProcessing && (
          <div className="chat-bubble-wrapper agent">
            <div className="avatar" aria-hidden="true">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="bubble-content">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <Cpu className="w-3.5 h-3.5 animate-spin text-sky-400" />
                <span>Ejecutando guardrails y procesando consulta...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Structured quick actions */}
      <div className="quick-prompts">
        {QUICK_ACTIONS.map((action, idx) => {
          const Icon = action.icon;
          return (
            <button
              key={idx}
              disabled={isProcessing}
              onClick={() => handleSend(action.prompt)}
              className="chip-prompt"
              title={action.prompt}
            >
              <Icon className="w-3.5 h-3.5 chip-icon" />
              <span>{action.label}</span>
            </button>
          );
        })}
      </div>

      <div className="chat-input-area">
        <input
          type="text"
          value={input}
          disabled={isProcessing}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Escribe una instrucción (ej. 'Resume los correos urgentes')..."
          className="chat-input"
          aria-label="Mensaje para el agente"
        />
        <button
          onClick={() => handleSend()}
          disabled={isProcessing || !input.trim()}
          className="send-button"
          title="Enviar instrucción (Enter)"
          aria-label="Enviar"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
