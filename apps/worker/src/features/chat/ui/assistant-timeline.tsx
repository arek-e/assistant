import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { useState, type ReactNode } from "react";

import { AgentAvatar, type AgentVisualState } from "@/features/avatar/agent-avatar";
import { cn } from "@teampitch/ui/lib/utils";

type TimelineVariant = "idle" | "thinking" | "speaking" | "tool" | "success" | "error";

const dotClassByVariant: Record<TimelineVariant, string> = {
  idle: "border-border bg-background",
  thinking: "border-foreground bg-background",
  speaking: "border-foreground bg-background",
  tool: "border-foreground bg-background",
  success: "border-success bg-success",
  error: "border-destructive bg-destructive"
};

export function AssistantTimeline({
  avatarState,
  children
}: {
  avatarState: AgentVisualState;
  children: ReactNode;
}) {
  return (
    <div className="relative grid max-w-[92%] grid-cols-[2.65rem_minmax(0,1fr)] gap-x-[0.85rem]">
      <div className="absolute top-12 bottom-[0.85rem] left-[1.325rem] w-px bg-gradient-to-b from-border to-border/45" />
      <div className="sticky top-3 z-1 grid min-h-[2.65rem] place-items-center self-start bg-background">
        <AgentAvatar state={avatarState} size="sm" />
      </div>
      <div className="flex min-w-0 flex-col gap-[0.55rem]">{children}</div>
    </div>
  );
}

export function TimelineNode({
  children,
  variant,
  showDot = true
}: {
  children: ReactNode;
  variant: TimelineVariant;
  showDot?: boolean;
}) {
  return (
    <m.div
      className="relative min-w-0"
      initial={{
        opacity: 0,
        transform: "translateY(4px)",
        filter: "blur(2px)"
      }}
      animate={{ opacity: 1, transform: "translateY(0)", filter: "blur(0px)" }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
    >
      {showDot && (
        <span
          aria-hidden
          className={cn(
            "absolute top-4 left-[-2.425rem] z-2 size-2 rounded-full border shadow-[0_0_0_3px_var(--background)]",
            dotClassByVariant[variant]
          )}
        />
      )}
      {children}
    </m.div>
  );
}

export function ActivityCard({
  children,
  approval = false
}: {
  children: ReactNode;
  approval?: boolean;
}) {
  return (
    <div
      className={cn(
        "w-full max-w-[34rem] overflow-hidden rounded-[0.4rem] border border-transparent bg-transparent shadow-none transition-transform duration-150 ease-out",
        approval && "border-warning/55"
      )}
    >
      {children}
    </div>
  );
}

export function ActivityDisclosure({
  defaultOpen,
  header,
  children
}: {
  defaultOpen: boolean;
  header: (open: boolean) => ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const shouldReduceMotion = useReducedMotion();

  return (
    <ActivityCard>
      <button
        className="flex min-h-9 w-fit max-w-full cursor-pointer appearance-none items-center justify-start gap-[0.55rem] border-0 bg-transparent px-0 py-[0.2rem] text-left text-xs text-foreground transition-transform duration-150 ease-out outline-none active:scale-[0.992] focus-visible:[&_.activity-title]:underline focus-visible:[&_.activity-title]:decoration-foreground/35 focus-visible:[&_.activity-title]:decoration-1 focus-visible:[&_.activity-title]:underline-offset-[0.22rem]"
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        {header(open)}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <m.div
            initial={
              shouldReduceMotion
                ? { height: "auto", opacity: 1 }
                : {
                    height: 0,
                    opacity: 0,
                    transform: "translateY(-4px)",
                    filter: "blur(2px)"
                  }
            }
            animate={{
              height: "auto",
              opacity: 1,
              transform: "translateY(0)",
              filter: "blur(0px)"
            }}
            exit={
              shouldReduceMotion
                ? { height: 0, opacity: 0 }
                : {
                    height: 0,
                    opacity: 0,
                    transform: "translateY(-3px)",
                    filter: "blur(1px)"
                  }
            }
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: "hidden" }}
          >
            {children}
          </m.div>
        )}
      </AnimatePresence>
    </ActivityCard>
  );
}

export function ActivityTitle({ children }: { children: ReactNode }) {
  return <span className="activity-title flex min-w-0 items-center gap-2">{children}</span>;
}

export function ActivityMeta({ children }: { children: ReactNode }) {
  return <span className="flex shrink-0 items-center gap-[0.45rem]">{children}</span>;
}

export function DisclosureCaret({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        "text-muted-foreground transition-transform duration-200 ease-out",
        open && "rotate-180"
      )}
    >
      {children}
    </span>
  );
}

export function ActivityTray({ children }: { children: ReactNode }) {
  return (
    <div className="my-[0.35rem] ml-5 border-l border-border py-[0.15rem] pl-3">{children}</div>
  );
}

export function ActivityCodeBlock({ children }: { children: ReactNode }) {
  return (
    <pre className="m-0 max-h-56 overflow-auto font-mono text-[0.72rem] leading-[1.45] whitespace-pre-wrap text-muted-foreground">
      {children}
    </pre>
  );
}

export function WorkSummary({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-[0.45rem]">{children}</div>;
}
