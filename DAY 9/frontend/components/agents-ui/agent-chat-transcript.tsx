'use client';

import { type ComponentProps } from 'react';
import { AnimatePresence } from 'motion/react';
import { type AgentState, type ReceivedMessage } from '@livekit/components-react';
import { AgentChatIndicator } from '@/components/agents-ui/agent-chat-indicator';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message';

/**
 * Props for the AgentChatTranscript component.
 */
export interface AgentChatTranscriptProps extends ComponentProps<'div'> {
  /**
   * The current state of the agent. When 'thinking', displays a loading indicator.
   */
  agentState?: AgentState;
  /**
   * Array of messages to display in the transcript.
   * @defaultValue []
   */
  messages?: ReceivedMessage[];
  /**
   * Additional CSS class names to apply to the conversation container.
   */
  className?: string;
}

/**
 * A chat transcript component that displays a conversation between the user and agent.
 * Shows messages with timestamps and origin indicators, plus a thinking indicator
 * when the agent is processing.
 *
 * @extends ComponentProps<'div'>
 *
 * @example
 * ```tsx
 * <AgentChatTranscript
 *   agentState={agentState}
 *   messages={chatMessages}
 * />
 * ```
 */
function cleanMessageText(text: string): string {
  if (!text) return '';
  let cleaned = text;

  // 1. Erase explicit tool function names with or without brackets
  const toolNames = [
    'hand_off_to_crop_specialist',
    'hand_back_to_main_agent',
    'create_escalation',
    'end_call',
    'get_weather_forecast',
    'get_mandi_market_prices',
    'forget_farmer_memory',
  ];

  toolNames.forEach((tool) => {
    const pattern = new RegExp(`<?/?${tool}>?\\s*(?:\\{[^}]*\\})?`, 'gi');
    cleaned = cleaned.replace(pattern, '');
  });

  // 2. Remove ANY function call tags like <function=...>, <function:...>, </function=...>, or ,function=...
  cleaned = cleaned.replace(/,?\s*\/?<?function=[^>]*>?(?:\s*\{[\s\S]*?\})?/gi, '');

  // 3. Strip any generic XML/HTML or pseudo-tags like <tag> or </tag>
  cleaned = cleaned.replace(/<[^>\n]+>/g, '');

  // 4. Remove raw JSON parameter blobs like {"issue_summary": ...} or {"crop_name": ...}
  cleaned = cleaned.replace(/\{"[a-zA-Z0-9_]+"\s*:[\s\S]*/g, '');

  // 5. Remove stray leftover brackets, angle brackets, or symbols
  cleaned = cleaned.replace(/^[<>{},;:]+/g, '').replace(/[<>{},;:]+$/g, '');

  // 6. Trim whitespace and return empty string if only stray artifacts remain
  cleaned = cleaned.trim();
  if (cleaned.length <= 1) return '';

  return cleaned;
}

export function AgentChatTranscript({
  agentState,
  messages = [],
  className,
  ...props
}: AgentChatTranscriptProps) {
  return (
    <Conversation className={className} {...props}>
      <ConversationContent>
        {messages.map((receivedMessage) => {
          const { id, timestamp, from, message } = receivedMessage;
          const locale = navigator?.language ?? 'en-US';
          const messageOrigin = from?.isLocal ? 'user' : 'assistant';
          const time = new Date(timestamp);
          const title = time.toLocaleTimeString(locale, { timeStyle: 'full' });

          const cleanedText = cleanMessageText(message);
          if (!cleanedText) return null;

          return (
            <Message key={id} title={title} from={messageOrigin}>
              <MessageContent>
                <MessageResponse>{cleanedText}</MessageResponse>
              </MessageContent>
            </Message>
          );
        })}
        <AnimatePresence>
          {agentState === 'thinking' && <AgentChatIndicator size="sm" />}
        </AnimatePresence>
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}
