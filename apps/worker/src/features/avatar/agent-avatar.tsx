import { useEffect, type ReactNode } from "react";
import { useMachine } from "@xstate/react";
import { motion, type TargetAndTransition } from "motion/react";
import {
  BrainIcon,
  ChatCircleDotsIcon,
  CheckCircleIcon,
  WrenchIcon,
  XCircleIcon
} from "@/components/app/icons";
import { assign, setup } from "xstate";
import { cn } from "@teampitch/ui/lib/utils";
import { Button } from "@/components/app/ui";

export type AgentVisualState =
  | "idle"
  | "thinking"
  | "speaking"
  | "tool"
  | "success"
  | "error";

type AgentEvent =
  | { type: "IDLE" }
  | { type: "THINK" }
  | { type: "SPEAK" }
  | { type: "TOOL" }
  | { type: "SUCCESS" }
  | { type: "ERROR" };

const assetByState: Record<AgentVisualState, string> = {
  idle: "/agent-avatar/idle.png",
  thinking: "/agent-avatar/thinking.png",
  speaking: "/agent-avatar/speaking.png",
  tool: "/agent-avatar/tool.png",
  success: "/agent-avatar/success.png",
  error: "/agent-avatar/error.png"
};

const labelByState: Record<AgentVisualState, string> = {
  idle: "Idle",
  thinking: "Thinking",
  speaking: "Speaking",
  tool: "Tool",
  success: "Success",
  error: "Error"
};

const eventByState: Record<AgentVisualState, AgentEvent["type"]> = {
  idle: "IDLE",
  thinking: "THINK",
  speaking: "SPEAK",
  tool: "TOOL",
  success: "SUCCESS",
  error: "ERROR"
};

const avatarSizeClassBySize = {
  sm: "size-[2.65rem]",
  md: "size-16",
  lg: "size-[5.4rem]"
};

const imageAnimationByState: Record<AgentVisualState, TargetAndTransition> = {
  idle: { y: 0, rotate: 0, scale: 1 },
  thinking: {
    y: [0, -4, 0],
    rotate: [-2, 3, -2],
    transition: { duration: 1, repeat: Infinity, ease: "easeInOut" }
  },
  speaking: {
    y: [0, -1, 0],
    scaleY: [1, 1.08, 1],
    transition: { duration: 0.28, repeat: Infinity, ease: "linear" }
  },
  tool: {
    rotate: [-4, 5, -4],
    transition: { duration: 0.9, repeat: Infinity, ease: "easeInOut" }
  },
  success: {
    scale: [0.92, 1.1, 1],
    rotate: [-6, 4, 0],
    transition: { duration: 0.72, ease: [0.34, 1.56, 0.64, 1] }
  },
  error: {
    x: [0, -3, 3, 0],
    transition: { duration: 0.34, repeat: 1, ease: "easeInOut" }
  }
};

const agentAvatarMachine = setup({
  types: {
    context: {} as { visualState: AgentVisualState },
    events: {} as AgentEvent
  },
  actions: {
    setVisualState: assign(({ event }) => {
      const visualState = eventToVisualState(event.type);
      return visualState ? { visualState } : {};
    })
  }
}).createMachine({
  id: "agentAvatar",
  initial: "idle",
  context: {
    visualState: "idle"
  },
  on: {
    IDLE: { target: ".idle", actions: "setVisualState" },
    THINK: { target: ".thinking", actions: "setVisualState" },
    SPEAK: { target: ".speaking", actions: "setVisualState" },
    TOOL: { target: ".tool", actions: "setVisualState" },
    SUCCESS: { target: ".success", actions: "setVisualState" },
    ERROR: { target: ".error", actions: "setVisualState" }
  },
  states: {
    idle: {},
    thinking: {},
    speaking: {},
    tool: {},
    success: {
      after: {
        1500: { target: "idle", actions: assign({ visualState: "idle" }) }
      }
    },
    error: {
      after: {
        2200: { target: "idle", actions: assign({ visualState: "idle" }) }
      }
    }
  }
});

function eventToVisualState(type: AgentEvent["type"]): AgentVisualState {
  switch (type) {
    case "THINK":
      return "thinking";
    case "SPEAK":
      return "speaking";
    case "TOOL":
      return "tool";
    case "SUCCESS":
      return "success";
    case "ERROR":
      return "error";
    case "IDLE":
      return "idle";
  }
}

export function AgentAvatar({
  state,
  size = "md",
  className
}: {
  state: AgentVisualState;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative grid shrink-0 place-items-center overflow-visible bg-transparent shadow-none",
        avatarSizeClassBySize[size],
        className
      )}
    >
      <motion.img
        key={state}
        src={assetByState[state]}
        alt={`Agent ${labelByState[state].toLowerCase()}`}
        className="size-full select-none object-contain [transform-origin:50%_70%]"
        draggable={false}
        animate={imageAnimationByState[state]}
      />
    </div>
  );
}

export function AgentAvatarShowcase({
  liveState
}: {
  liveState: AgentVisualState;
}) {
  const [snapshot, send] = useMachine(agentAvatarMachine);
  const visualState = snapshot.context.visualState;

  useEffect(() => {
    send({ type: eventByState[liveState] });
  }, [liveState, send]);

  const controls: Array<{
    state: AgentVisualState;
    icon: ReactNode;
  }> = [
    { state: "idle", icon: <ChatCircleDotsIcon size={15} /> },
    { state: "thinking", icon: <BrainIcon size={15} /> },
    { state: "speaking", icon: <ChatCircleDotsIcon size={15} /> },
    { state: "tool", icon: <WrenchIcon size={15} /> },
    { state: "success", icon: <CheckCircleIcon size={15} /> },
    { state: "error", icon: <XCircleIcon size={15} /> }
  ];

  return (
    <section className="rounded-lg border border-border bg-card px-4 py-4">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <AgentAvatar state={visualState} size="lg" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">
              Ink face state
            </div>
            <div className="font-mono text-xs uppercase tracking-normal text-muted-foreground">
              {visualState}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-1.5 sm:flex">
            {controls.map((control) => (
              <Button
                key={control.state}
                size="sm"
                variant={
                  visualState === control.state ? "primary" : "secondary"
                }
                icon={control.icon}
                onClick={() => send({ type: eventByState[control.state] })}
                aria-pressed={visualState === control.state}
              >
                {labelByState[control.state]}
              </Button>
            ))}
          </div>
          <div
            className="grid max-w-[30rem] grid-cols-[repeat(6,minmax(2.8rem,1fr))] gap-[0.35rem] rounded-lg border border-border bg-background p-[0.45rem]"
            aria-label="Agent face state sheet"
          >
            {controls.map((control) => (
              <button
                key={`strip-${control.state}`}
                className={cn(
                  "grid aspect-square cursor-pointer place-items-center overflow-visible rounded-md border border-transparent bg-white/70 transition-[border-color,background,transform] duration-150 ease-out hover:-translate-y-px hover:border-ring",
                  visualState === control.state && "border-foreground bg-card"
                )}
                onClick={() => send({ type: eventByState[control.state] })}
                type="button"
              >
                <AgentAvatar state={control.state} size="sm" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
