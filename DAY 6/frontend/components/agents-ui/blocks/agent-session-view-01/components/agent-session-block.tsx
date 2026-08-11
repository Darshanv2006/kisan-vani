'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, type MotionProps, motion } from 'motion/react';
import { useAgent, useSessionContext, useSessionMessages } from '@livekit/components-react';
import { AgentChatTranscript } from '@/components/agents-ui/agent-chat-transcript';
import {
  AgentControlBar,
  type AgentControlBarControls,
} from '@/components/agents-ui/agent-control-bar';
import { Shimmer } from '@/components/ai-elements/shimmer';
import { cn } from '@/lib/shadcn/utils';
import { TileLayout } from './tile-view';

const MotionMessage = motion.create(Shimmer);

const BOTTOM_VIEW_MOTION_PROPS: MotionProps = {
  variants: {
    visible: {
      opacity: 1,
      translateY: '0%',
    },
    hidden: {
      opacity: 0,
      translateY: '100%',
    },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
  transition: {
    duration: 0.3,
    delay: 0.5,
    ease: 'easeOut',
  },
};

const CHAT_MOTION_PROPS: MotionProps = {
  variants: {
    hidden: {
      opacity: 0,
      transition: {
        ease: 'easeOut',
        duration: 0.3,
      },
    },
    visible: {
      opacity: 1,
      transition: {
        delay: 0.2,
        ease: 'easeOut',
        duration: 0.3,
      },
    },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
};

const SHIMMER_MOTION_PROPS: MotionProps = {
  variants: {
    visible: {
      opacity: 1,
      transition: {
        ease: 'easeIn',
        duration: 0.5,
        delay: 0.8,
      },
    },
    hidden: {
      opacity: 0,
      transition: {
        ease: 'easeIn',
        duration: 0.5,
        delay: 0,
      },
    },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
};

interface FadeProps {
  top?: boolean;
  bottom?: boolean;
  className?: string;
}

export function Fade({ top = false, bottom = false, className }: FadeProps) {
  return (
    <div
      className={cn(
        'from-background pointer-events-none h-4 bg-linear-to-b to-transparent',
        top && 'bg-linear-to-b',
        bottom && 'bg-linear-to-t',
        className
      )}
    />
  );
}

function AgentStatusHeader({ agentState, isConnected }: { agentState?: string; isConnected: boolean }) {
  let badgeColor = 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-300 shadow-amber-500/10';
  let pulseDot = 'bg-amber-500';
  let stateText = 'Connecting ⏳';
  let speakerText = 'Joining LiveKit call with Kisan Vani...';

  if (!isConnected) {
    badgeColor = 'bg-red-500/15 border-red-500/40 text-red-600 dark:text-red-300 shadow-red-500/10';
    pulseDot = 'bg-red-500';
    stateText = 'Call Ended 🔴';
    speakerText = 'Call finished. Click Start Call to reconnect.';
  } else if (agentState === 'listening') {
    badgeColor = 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-300 shadow-emerald-500/10';
    pulseDot = 'bg-emerald-500';
    stateText = 'Listening 🎧';
    speakerText = 'Farmer Speaking — Kisan Vani is listening...';
  } else if (agentState === 'speaking') {
    badgeColor = 'bg-teal-500/15 border-teal-500/40 text-teal-600 dark:text-teal-300 shadow-teal-500/10';
    pulseDot = 'bg-teal-400';
    stateText = 'Speaking 🔊';
    speakerText = 'Kisan Vani Responding (Murf Falcon Voice)';
  } else if (agentState === 'thinking') {
    badgeColor = 'bg-purple-500/15 border-purple-500/40 text-purple-600 dark:text-purple-300 shadow-purple-500/10';
    pulseDot = 'bg-purple-400';
    stateText = 'Processing 💭';
    speakerText = 'Kisan Vani AI is analyzing your query...';
  }

  return (
    <div className="absolute top-4 left-1/2 z-50 w-full max-w-lg -translate-x-1/2 px-4">
      <div className={cn('flex flex-col items-center justify-center gap-1.5 rounded-2xl border px-5 py-3 shadow-xl backdrop-blur-xl transition-all duration-300', badgeColor)}>
        <div className="flex items-center gap-2.5 text-xs font-black uppercase tracking-widest">
          <span className="relative flex h-3 w-3">
            <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-75', pulseDot)}></span>
            <span className={cn('relative inline-flex h-3 w-3 rounded-full', pulseDot)}></span>
          </span>
          <span>{stateText}</span>
        </div>
        <div className="text-center text-xs font-semibold opacity-90">{speakerText}</div>
      </div>
    </div>
  );
}

function MicPermissionBanner() {
  const [micDenied, setMicDenied] = useState(false);

  useEffect(() => {
    navigator.mediaDevices
      ?.getUserMedia({ audio: true })
      .then((stream) => {
        // mic allowed, clean tracks
        stream.getTracks().forEach((track) => track.stop());
      })
      .catch((err) => {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setMicDenied(true);
        }
      });
  }, []);

  if (!micDenied) return null;

  return (
    <div className="absolute top-24 left-1/2 z-50 w-11/12 max-w-md -translate-x-1/2 rounded-xl border border-red-500/40 bg-red-950/90 p-4 text-center text-xs text-red-200 shadow-2xl backdrop-blur-md">
      <div className="mb-1 text-sm font-bold text-red-400">🚨 Microphone Access Blocked</div>
      <p>Microphone permission was denied by your browser. Please click the lock icon in your address bar and select &quot;Allow Microphone&quot; to speak with Kisan Vani.</p>
      <button onClick={() => setMicDenied(false)} className="mt-2.5 rounded bg-red-800 px-3 py-1 font-medium text-white hover:bg-red-700">Dismiss</button>
    </div>
  );
}

export interface AgentSessionView_01Props {
  /**
   * Message shown above the controls before the first chat message is sent.
   *
   * @default 'Agent is listening, ask it a question'
   */
  preConnectMessage?: string;
  /**
   * Enables or disables the chat toggle and transcript input controls.
   *
   * @default true
   */
  supportsChatInput?: boolean;
  /**
   * Enables or disables camera controls in the bottom control bar.
   *
   * @default true
   */
  supportsVideoInput?: boolean;
  /**
   * Enables or disables screen sharing controls in the bottom control bar.
   *
   * @default true
   */
  supportsScreenShare?: boolean;
  /**
   * Shows a pre-connect buffer state with a shimmer message before messages appear.
   *
   * @default true
   */
  isPreConnectBufferEnabled?: boolean;

  /** Selects the visualizer style rendered in the main tile area. */
  audioVisualizerType?: 'bar' | 'wave' | 'grid' | 'radial' | 'aura';
  /** Primary hex color used by supported audio visualizer variants. */
  audioVisualizerColor?: `#${string}`;
  /** Hue shift intensity used by certain visualizers. */
  audioVisualizerColorShift?: number;
  /** Number of bars to render when `audioVisualizerType` is `bar`. */
  audioVisualizerBarCount?: number;
  /** Number of rows in the visualizer when `audioVisualizerType` is `grid`. */
  audioVisualizerGridRowCount?: number;
  /** Number of columns in the visualizer when `audioVisualizerType` is `grid`. */
  audioVisualizerGridColumnCount?: number;
  /** Number of radial bars when `audioVisualizerType` is `radial`. */
  audioVisualizerRadialBarCount?: number;
  /** Base radius of the radial visualizer when `audioVisualizerType` is `radial`. */
  audioVisualizerRadialRadius?: number;
  /** Stroke width of the wave path when `audioVisualizerType` is `wave`. */
  audioVisualizerWaveLineWidth?: number;
  /** Optional class name merged onto the outer `<section>` container. */
  className?: string;
}

export function AgentSessionView_01({
  preConnectMessage = 'Kisan Vani is ready! Ask your crop or farm question.',
  supportsChatInput = true,
  supportsVideoInput = true,
  supportsScreenShare = true,
  isPreConnectBufferEnabled = true,

  audioVisualizerType,
  audioVisualizerColor,
  audioVisualizerColorShift,
  audioVisualizerBarCount,
  audioVisualizerGridRowCount,
  audioVisualizerGridColumnCount,
  audioVisualizerRadialBarCount,
  audioVisualizerRadialRadius,
  audioVisualizerWaveLineWidth,
  ref,
  className,
  ...props
}: React.ComponentProps<'section'> & AgentSessionView_01Props) {
  const session = useSessionContext();
  const { messages } = useSessionMessages(session);
  const [chatOpen, setChatOpen] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { state: agentState } = useAgent();

  const controls: AgentControlBarControls = {
    leave: true,
    microphone: true,
    chat: supportsChatInput,
    camera: supportsVideoInput,
    screenShare: supportsScreenShare,
  };

  useEffect(() => {
    const lastMessage = messages.at(-1);
    const lastMessageIsLocal = lastMessage?.from?.isLocal === true;

    if (scrollAreaRef.current && lastMessageIsLocal) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <section
      ref={ref}
      className={cn('bg-background relative z-10 h-full w-full overflow-hidden', className)}
      {...props}
    >
      {/* State Banner Header */}
      <AgentStatusHeader agentState={agentState} isConnected={session.isConnected} />

      {/* Mic Permission Banner */}
      <MicPermissionBanner />

      <Fade top className="absolute inset-x-4 top-0 z-10 h-40" />
      {/* transcript */}

      <div className="absolute top-0 bottom-[135px] flex w-full flex-col md:bottom-[170px]">
        <AnimatePresence>
          {chatOpen && (
            <motion.div
              {...CHAT_MOTION_PROPS}
              className="flex h-full w-full flex-col gap-4 space-y-3 transition-opacity duration-300 ease-out"
            >
              <AgentChatTranscript
                agentState={agentState}
                messages={messages}
                className="mx-auto w-full max-w-2xl [&_.is-user>div]:rounded-[22px] [&>div>div]:px-4 [&>div>div]:pt-40 md:[&>div>div]:px-6"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* Tile layout */}
      <TileLayout
        chatOpen={chatOpen}
        audioVisualizerType={audioVisualizerType}
        audioVisualizerColor={audioVisualizerColor}
        audioVisualizerColorShift={audioVisualizerColorShift}
        audioVisualizerBarCount={audioVisualizerBarCount}
        audioVisualizerRadialBarCount={audioVisualizerRadialBarCount}
        audioVisualizerRadialRadius={audioVisualizerRadialRadius}
        audioVisualizerGridRowCount={audioVisualizerGridRowCount}
        audioVisualizerGridColumnCount={audioVisualizerGridColumnCount}
        audioVisualizerWaveLineWidth={audioVisualizerWaveLineWidth}
      />
      {/* Bottom */}
      <motion.div
        {...BOTTOM_VIEW_MOTION_PROPS}
        className="absolute inset-x-3 bottom-0 z-50 md:inset-x-12"
      >
        {/* Pre-connect message */}
        {isPreConnectBufferEnabled && (
          <AnimatePresence>
            {messages.length === 0 && (
              <MotionMessage
                key="pre-connect-message"
                duration={2}
                aria-hidden={messages.length > 0}
                {...SHIMMER_MOTION_PROPS}
                className="pointer-events-none mx-auto block w-full max-w-2xl pb-4 text-center text-sm font-semibold"
              >
                {preConnectMessage}
              </MotionMessage>
            )}
          </AnimatePresence>
        )}
        <div className="bg-background relative mx-auto max-w-2xl pb-3 md:pb-12">
          <Fade bottom className="absolute inset-x-0 top-0 h-4 -translate-y-full" />
          <AgentControlBar
            variant="livekit"
            controls={controls}
            isChatOpen={chatOpen}
            isConnected={session.isConnected}
            onDisconnect={session.end}
            onIsChatOpenChange={setChatOpen}
          />
        </div>
      </motion.div>
    </section>
  );
}
