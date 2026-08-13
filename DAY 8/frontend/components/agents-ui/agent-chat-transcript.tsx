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
  // 1. Remove function call tags like ,function=name>{...} or /function=name>{...} (including multiline JSON)
  cleaned = cleaned.replace(/,?\s*\/?<?function=\w+>?(?:\s*\{[\s\S]*?\})?/gi, '');
  // 2. Remove raw JSON parameter blobs like {"crop_name": "wheat", ...}
  cleaned = cleaned.replace(/\{"[a-zA-Z0-9_]+"\s*:[\s\S]*?\}/g, '');
  // 3. Remove leftover lines starting with function= or ,function=
  cleaned = cleaned.replace(/,?\s*function=\w+>?[^\n]*/gi, '');
  // 4. Remove leading/trailing stray symbols, commas, or empty lines
  cleaned = cleaned.replace(/^[\s,;{}]+/g, '');
  return cleaned.trim();
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
