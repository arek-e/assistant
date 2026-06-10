import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from "react";
import { motion } from "motion/react";
import { cn } from "@teampitch/ui/lib/utils";
import {
  BrainIcon,
  ChatCircleDotsIcon,
  GearIcon,
  PlugsConnectedIcon,
  PlusIcon,
  WrenchIcon
} from "@/components/app/icons";
import { Button, Switch } from "@/components/app/ui";
import {
  AgentAvatar,
  type AgentVisualState
} from "@/features/avatar/agent-avatar";

const expandedPanelWidth = 304;
const collapsedPanelWidth = 0;
const panelDragOpenThreshold = 80;
const panelDragCloseThreshold = 96;
const panelDragVelocityThreshold = 1600;
const panelDragDeadzone = 4;

export function AssistantAppShell({
  children,
  composer,
  connected,
  isStreaming,
  showDebug,
  toolCount,
  serverCount,
  messageCount,
  integrationControls,
  themeToggle,
  onShowDebugChange,
  onNewChat
}: {
  children: ReactNode;
  composer: ReactNode;
  connected: boolean;
  isStreaming: boolean;
  showDebug: boolean;
  toolCount: number;
  serverCount: number;
  messageCount: number;
  integrationControls: ReactNode;
  themeToggle: ReactNode;
  onShowDebugChange: (checked: boolean) => void;
  onNewChat: () => void;
}) {
  const [panelOpen, setPanelOpen] = useState(true);
  const statusLabel = getStatusLabel(isStreaming, connected);

  return (
    <div className="h-screen overflow-hidden bg-[#f2f2ef] p-[3px] text-foreground">
      <div className="flex h-full min-h-0 overflow-visible">
        <DesktopAssistantNav
          connected={connected}
          messageCount={messageCount}
          panelOpen={panelOpen}
          showDebug={showDebug}
          onNewChat={onNewChat}
          onPanelOpenChange={setPanelOpen}
          onShowDebugChange={onShowDebugChange}
        />
        <main className="relative z-10 flex min-w-0 flex-1 overflow-hidden rounded-[1.125rem] border border-white/80 bg-background shadow-[0_0_0_1px_rgba(16,16,15,0.1),0_1px_2px_-1px_rgba(16,16,15,0.1),0_2px_4px_rgba(16,16,15,0.05)] md:ml-[3px]">
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <section className="flex min-w-0 flex-1 flex-col bg-background">
              <ChatTopbar
                isStreaming={isStreaming}
                messageCount={messageCount}
                onNewChat={onNewChat}
                themeToggle={themeToggle}
              />
              <motion.div
                className="min-h-0 flex-1 overflow-y-auto"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="mx-auto w-full max-w-3xl px-5 pb-10 pt-10 sm:px-8 lg:pt-16">
                  {children}
                </div>
              </motion.div>
              <div className="shrink-0 bg-gradient-to-t from-background via-background to-background/0 px-4 pb-5 pt-3 sm:px-8">
                {composer}
              </div>
            </section>
            <AssistantDetailsPanel
              connected={connected}
              isStreaming={isStreaming}
              messageCount={messageCount}
              serverCount={serverCount}
              showDebug={showDebug}
              statusLabel={statusLabel}
              toolCount={toolCount}
              integrationControls={integrationControls}
              onShowDebugChange={onShowDebugChange}
            />
          </div>
        </main>
      </div>
    </div>
  );
}

function AssistantDetailsPanel({
  connected,
  isStreaming,
  messageCount,
  serverCount,
  showDebug,
  statusLabel,
  toolCount,
  integrationControls,
  onShowDebugChange
}: {
  connected: boolean;
  isStreaming: boolean;
  messageCount: number;
  serverCount: number;
  showDebug: boolean;
  statusLabel: string;
  toolCount: number;
  integrationControls: ReactNode;
  onShowDebugChange: (checked: boolean) => void;
}) {
  return (
    <aside className="hidden w-80 shrink-0 flex-col bg-background shadow-[-1px_0_0_rgba(16,16,15,0.08)] lg:flex">
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 px-5">
        <h2 className="truncate text-sm font-medium text-neutral-950">
          Agent details
        </h2>
        <span className="shrink-0 text-sm text-neutral-500">{statusLabel}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <DetailsSection title="Runtime">
          <DetailsRow
            icon={<ChatCircleDotsIcon size={15} />}
            label="Status"
            value={statusLabel}
          />
          <DetailsRow
            label="Connection"
            value={getConnectionLabel(connected)}
            dotClassName={getConnectionDotClass(connected)}
          />
          <DetailsRow
            label="Agent"
            value={getAgentLabel(isStreaming)}
            dotClassName={getAgentDotClass(isStreaming)}
          />
          <DetailsRow
            icon={<ChatCircleDotsIcon size={15} />}
            label="Messages"
            value={`${messageCount}`}
          />
        </DetailsSection>

        <DetailsSection title="Integrations">
          <DetailsRow
            icon={<WrenchIcon size={15} />}
            label="MCP tools"
            value={`${toolCount}`}
          />
          <DetailsRow
            icon={<PlugsConnectedIcon size={15} />}
            label="MCP servers"
            value={`${serverCount}`}
          />
          <div className="mt-2 px-5">{integrationControls}</div>
        </DetailsSection>

        <DetailsSection title="Memory">
          <DetailsSwitchRow
            checked={showDebug}
            icon={<BrainIcon size={15} />}
            label="Debugger"
            onCheckedChange={onShowDebugChange}
          />
        </DetailsSection>
      </div>
    </aside>
  );
}

function DetailsSection({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="px-5 py-5 shadow-[0_-1px_0_rgba(16,16,15,0.08)] first:shadow-none">
      <h2 className="mb-3 text-sm font-medium text-neutral-950">{title}</h2>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}

function DetailsRow({
  icon,
  label,
  value,
  dotClassName
}: {
  icon?: ReactNode;
  label: string;
  value: string;
  dotClassName?: string;
}) {
  return (
    <div className="grid min-h-9 grid-cols-[1rem_minmax(5.25rem,1fr)_minmax(4.5rem,auto)] items-center gap-x-2 text-sm">
      <span className="grid size-4 shrink-0 place-items-center text-neutral-400">
        {icon ??
          (dotClassName && (
            <span className={cn("size-2 rounded-full", dotClassName)} />
          ))}
      </span>
      <span className="min-w-0 truncate text-neutral-500">{label}</span>
      <span className="min-w-0 truncate text-right text-neutral-950 tabular-nums">
        {value}
      </span>
    </div>
  );
}

function DetailsSwitchRow({
  checked,
  icon,
  label,
  onCheckedChange
}: {
  checked: boolean;
  icon: ReactNode;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="grid min-h-9 grid-cols-[1rem_minmax(5.25rem,1fr)_auto] items-center gap-x-2 text-sm">
      <span className="grid size-4 shrink-0 place-items-center text-neutral-400">
        {icon}
      </span>
      <span className="min-w-0 truncate text-neutral-500">{label}</span>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        size="sm"
        aria-label="Toggle debug mode"
      />
    </div>
  );
}

function DesktopAssistantNav({
  connected,
  messageCount,
  panelOpen,
  showDebug,
  onNewChat,
  onPanelOpenChange,
  onShowDebugChange
}: {
  connected: boolean;
  messageCount: number;
  panelOpen: boolean;
  showDebug: boolean;
  onNewChat: () => void;
  onPanelOpenChange: (open: boolean) => void;
  onShowDebugChange: (checked: boolean) => void;
}) {
  const avatarState = getAvatarState(connected);
  const [dragPanelWidth, setDragPanelWidth] = useState<number | null>(null);
  const dragStartPanelWidthRef = useRef(getPanelWidth(panelOpen));
  const renderedPanelWidth = dragPanelWidth ?? getPanelWidth(panelOpen);
  const isPanelDragging = dragPanelWidth !== null;

  return (
    <div className="relative z-20 hidden h-full shrink-0 md:flex">
      <PrimaryRail
        connected={connected}
        panelOpen={panelOpen}
        onNewChat={onNewChat}
        onPanelOpenChange={onPanelOpenChange}
      />
      <motion.aside
        aria-hidden={!panelOpen}
        className="h-full overflow-hidden bg-transparent"
        animate={{ width: renderedPanelWidth }}
        transition={
          isPanelDragging
            ? { duration: 0 }
            : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }
        }
      >
        <motion.div
          className="flex h-full w-[19rem] flex-col p-3"
          animate={{ opacity: getPanelContentOpacity(renderedPanelWidth) }}
          transition={isPanelDragging ? { duration: 0 } : { duration: 0.12 }}
        >
          <div className="mb-4 flex h-9 items-center px-1">
            <div className="flex min-w-0 items-center gap-2">
              <AgentAvatar state={avatarState} size="sm" />
              <div className="min-w-0 truncate text-sm font-medium text-neutral-900">
                Teampitch
              </div>
            </div>
          </div>

          <div className="space-y-5 overflow-y-auto pr-1">
            <NavSection title="Chats">
              <PanelNavLabel
                active
                icon={<ChatCircleDotsIcon size={16} />}
                label="Current chat"
                value={formatMessageCount(messageCount)}
              />
              <PanelAction
                icon={<PlusIcon size={16} />}
                label="New chat"
                onClick={onNewChat}
              />
            </NavSection>

            <NavSection title="Workspace">
              <PanelNavLabel
                icon={<PlugsConnectedIcon size={16} />}
                label="Integrations"
              />
              <PanelNavLabel icon={<WrenchIcon size={16} />} label="Tools" />
              <PanelNavButton
                active={showDebug}
                icon={<BrainIcon size={16} />}
                label="Memory"
                onClick={() => onShowDebugChange(!showDebug)}
              />
            </NavSection>

            <NavSection title="System">
              <PanelNavLabel icon={<GearIcon size={16} />} label="Settings" />
            </NavSection>
          </div>
        </motion.div>
      </motion.aside>

      <PanelBoundary
        panelOpen={panelOpen}
        onPanelOpenChange={onPanelOpenChange}
        onPanelDrag={(offsetX) => {
          setDragPanelWidth(
            clampPanelWidth(dragStartPanelWidthRef.current + offsetX)
          );
        }}
        onPanelDragEnd={(offsetX, velocityX) => {
          const nextPanelOpen = getNextPanelOpenState(
            panelOpen,
            offsetX,
            velocityX
          );
          setDragPanelWidth(null);
          onPanelOpenChange(nextPanelOpen);
        }}
        onPanelDragStart={() => {
          dragStartPanelWidthRef.current = getPanelWidth(panelOpen);
          setDragPanelWidth(getPanelWidth(panelOpen));
        }}
      />
    </div>
  );
}

function PrimaryRail({
  connected,
  panelOpen,
  onNewChat,
  onPanelOpenChange
}: {
  connected: boolean;
  panelOpen: boolean;
  onNewChat: () => void;
  onPanelOpenChange: (open: boolean) => void;
}) {
  const connectionDotClass = getConnectionDotClass(connected);

  return (
    <aside className="flex h-full w-16 shrink-0 flex-col items-center rounded-[1.125rem] bg-[#10100f] py-3 text-white shadow-[0_10px_28px_rgba(16,16,15,0.18)]">
      <button
        type="button"
        aria-label="Open assistant panel"
        className="grid size-9 place-items-center rounded-lg text-white transition-colors hover:bg-white/[0.08] active:scale-95"
        onClick={() => onPanelOpenChange(true)}
      >
        <RailMark />
      </button>

      <nav className="mt-7 flex flex-1 flex-col items-center gap-1.5">
        <RailButton
          active={panelOpen}
          label="Current chat"
          icon={<ChatCircleDotsIcon size={17} />}
          onClick={() => onPanelOpenChange(true)}
        />
        <RailButton
          label="New chat"
          icon={<PlusIcon size={17} />}
          onClick={onNewChat}
        />
        <RailButton
          label="Assistant tools"
          icon={<WrenchIcon size={17} />}
          onClick={() => onPanelOpenChange(true)}
        />
      </nav>

      <div
        className={cn("mb-3 size-2 rounded-full", connectionDotClass)}
        title={connected ? "Connected" : "Disconnected"}
      />
    </aside>
  );
}

function RailMark() {
  return (
    <span aria-hidden className="grid size-5 grid-cols-2 grid-rows-2 gap-0.5">
      <span className="bg-white" />
      <span className="bg-white" />
      <span className="bg-white" />
      <span className="bg-white" />
    </span>
  );
}

function PanelBoundary({
  panelOpen,
  onPanelDrag,
  onPanelDragEnd,
  onPanelDragStart,
  onPanelOpenChange
}: {
  panelOpen: boolean;
  onPanelDrag: (offsetX: number) => void;
  onPanelDragEnd: (offsetX: number, velocityX: number) => void;
  onPanelDragStart: () => void;
  onPanelOpenChange: (open: boolean) => void;
}) {
  const toggleLabel = getPanelToggleLabel(panelOpen);
  const draggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragMovedRef = useRef(false);
  const lastDragSampleRef = useRef({ time: 0, x: 0 });
  const dragVelocityXRef = useRef(0);
  const dragCleanupRef = useRef<null | (() => void)>(null);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
    };
  }, []);

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;

    event.preventDefault();
    const target = event.currentTarget;
    const pointerId = event.pointerId;

    beginPanelDrag(event.clientX);
    safelySetPointerCapture(target, pointerId);

    const handleWindowPointerMove = (windowEvent: PointerEvent) => {
      if (windowEvent.pointerId !== pointerId) return;
      updatePointerDrag(windowEvent.clientX);
    };

    const handleWindowPointerEnd = (windowEvent: PointerEvent) => {
      if (windowEvent.pointerId !== pointerId) return;
      finishPointerDrag(windowEvent.clientX, target, pointerId);
    };

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerEnd);
    window.addEventListener("pointercancel", handleWindowPointerEnd);

    dragCleanupRef.current = () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerEnd);
      window.removeEventListener("pointercancel", handleWindowPointerEnd);
      dragCleanupRef.current = null;
    };
  }

  function handleMouseDown(event: ReactMouseEvent<HTMLButtonElement>) {
    if (event.button !== 0 || draggingRef.current) return;

    event.preventDefault();
    const target = event.currentTarget;

    beginPanelDrag(event.clientX);

    const handleWindowMouseMove = (windowEvent: MouseEvent) => {
      updatePointerDrag(windowEvent.clientX);
    };

    const handleWindowMouseEnd = (windowEvent: MouseEvent) => {
      finishPointerDrag(windowEvent.clientX, target);
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseEnd);

    dragCleanupRef.current = () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseEnd);
      dragCleanupRef.current = null;
    };
  }

  function beginPanelDrag(clientX: number) {
    const now = performance.now();

    dragCleanupRef.current?.();
    draggingRef.current = true;
    dragMovedRef.current = false;
    dragStartXRef.current = clientX;
    lastDragSampleRef.current = { time: now, x: clientX };
    dragVelocityXRef.current = 0;
    onPanelDragStart();
  }

  function updatePointerDrag(clientX: number) {
    if (!draggingRef.current) return;

    const offsetX = clientX - dragStartXRef.current;
    const now = performance.now();
    const lastSample = lastDragSampleRef.current;
    const elapsedSeconds = Math.max((now - lastSample.time) / 1000, 0.001);

    dragVelocityXRef.current = (clientX - lastSample.x) / elapsedSeconds;
    lastDragSampleRef.current = { time: now, x: clientX };

    if (Math.abs(offsetX) > panelDragDeadzone) {
      dragMovedRef.current = true;
    }

    onPanelDrag(offsetX);
  }

  function finishPointerDrag(
    clientX: number,
    target: HTMLButtonElement,
    pointerId?: number
  ) {
    if (!draggingRef.current) return;

    const offsetX = clientX - dragStartXRef.current;

    draggingRef.current = false;
    dragCleanupRef.current?.();
    onPanelDragEnd(offsetX, dragVelocityXRef.current);
    if (pointerId !== undefined) {
      safelyReleasePointerCapture(target, pointerId);
    }
  }

  function handleClick(event: ReactMouseEvent<HTMLButtonElement>) {
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      event.preventDefault();
      return;
    }

    onPanelOpenChange(!panelOpen);
  }

  return (
    <div className="relative z-30 h-full w-0 shrink-0">
      <button
        type="button"
        aria-label={toggleLabel}
        className="group absolute left-0 top-0 h-full w-8 -translate-x-1/2 cursor-col-resize touch-none select-none outline-none"
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onPointerDown={handlePointerDown}
      >
        <span
          aria-hidden
          className="absolute left-[calc(50%+0.25rem)] top-1/2 h-7 w-1 -translate-y-1/2 rounded-full bg-neutral-400/70 opacity-0 shadow-[0_1px_3px_rgba(16,16,15,0.16)] transition-[height,background-color,opacity,box-shadow] duration-150 group-hover:h-8 group-hover:bg-neutral-500/75 group-hover:opacity-100 group-hover:shadow-[0_1px_5px_rgba(16,16,15,0.18)] group-focus-visible:opacity-100 group-focus-visible:ring-2 group-focus-visible:ring-ring/35"
        />
      </button>
    </div>
  );
}

function getStatusLabel(isStreaming: boolean, connected: boolean) {
  if (isStreaming) return "Responding";
  return connected ? "Ready" : "Offline";
}

function getPanelWidth(panelOpen: boolean) {
  return panelOpen ? expandedPanelWidth : collapsedPanelWidth;
}

function clampPanelWidth(width: number) {
  return Math.min(expandedPanelWidth, Math.max(collapsedPanelWidth, width));
}

function getPanelContentOpacity(width: number) {
  return Math.min(1, Math.max(0, (width - 64) / 96));
}

function getNextPanelOpenState(
  panelOpen: boolean,
  offsetX: number,
  velocityX: number
) {
  if (panelOpen) {
    return !(
      offsetX <= -panelDragCloseThreshold ||
      velocityX <= -panelDragVelocityThreshold
    );
  }

  return (
    offsetX >= panelDragOpenThreshold || velocityX >= panelDragVelocityThreshold
  );
}

function getAvatarState(connected: boolean): AgentVisualState {
  return connected ? "idle" : "error";
}

function formatMessageCount(messageCount: number) {
  return `${messageCount} message${messageCount === 1 ? "" : "s"}`;
}

function getConnectionLabel(connected: boolean) {
  return connected ? "Connected" : "Disconnected";
}

function getConnectionDotClass(connected: boolean) {
  return connected ? "bg-success" : "bg-destructive";
}

function getAgentLabel(isStreaming: boolean) {
  return isStreaming ? "Responding" : "Idle";
}

function getAgentDotClass(isStreaming: boolean) {
  return isStreaming ? "bg-warning" : "bg-neutral-300";
}

function getPanelToggleLabel(panelOpen: boolean) {
  return panelOpen ? "Collapse assistant panel" : "Open assistant panel";
}

function safelySetPointerCapture(target: HTMLButtonElement, pointerId: number) {
  try {
    target.setPointerCapture(pointerId);
  } catch {
    // Synthetic and cancelled pointers might not be capturable.
  }
}

function safelyReleasePointerCapture(
  target: HTMLButtonElement,
  pointerId: number
) {
  try {
    if (target.hasPointerCapture(pointerId)) {
      target.releasePointerCapture(pointerId);
    }
  } catch {
    // The pointer may already have been released by the browser.
  }
}

function RailButton({
  active = false,
  icon,
  label,
  onClick
}: {
  active?: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "grid size-8 place-items-center rounded-md text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white",
        active && "bg-white/[0.13] text-white"
      )}
      onClick={onClick}
    >
      {icon}
    </button>
  );
}

function NavSection({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-1 px-2 text-xs font-medium text-muted-foreground">
        {title}
      </h2>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}

function PanelAction({
  icon,
  label,
  onClick
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-neutral-700 transition-colors hover:bg-black/5"
      onClick={onClick}
    >
      <span className="shrink-0 text-neutral-500">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  );
}

function PanelNavLabel({
  active = false,
  icon,
  label,
  value
}: {
  active?: boolean;
  icon: ReactNode;
  label: string;
  value?: string;
}) {
  return (
    <div className={getPanelNavClassName(active)}>
      <PanelNavContent icon={icon} label={label} value={value} />
    </div>
  );
}

function PanelNavButton({
  active = false,
  icon,
  label,
  onClick
}: {
  active?: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={getPanelNavClassName(active, true)}
      onClick={onClick}
    >
      <PanelNavContent icon={icon} label={label} />
    </button>
  );
}

function PanelNavContent({
  icon,
  label,
  value
}: {
  icon: ReactNode;
  label: string;
  value?: string;
}) {
  return (
    <>
      <span className="grid size-4 shrink-0 place-items-center text-neutral-500">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {value ? (
        <span className="text-xs text-muted-foreground">{value}</span>
      ) : null}
    </>
  );
}

function getPanelNavClassName(active: boolean, interactive = false) {
  return cn(
    "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-neutral-700",
    active ? "bg-black/5 text-neutral-950" : "",
    interactive ? "transition-colors hover:bg-black/5" : ""
  );
}

function ChatTopbar({
  isStreaming,
  messageCount,
  themeToggle,
  onNewChat
}: {
  isStreaming: boolean;
  messageCount: number;
  themeToggle: ReactNode;
  onNewChat: () => void;
}) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between px-4 sm:px-5">
      <div className="flex min-w-0 items-center gap-2">
        <ChatCircleDotsIcon size={17} className="shrink-0 text-neutral-700" />
        <h1 className="min-w-0 truncate text-sm font-medium text-neutral-900">
          {messageCount > 0 ? "Current chat" : "New chat"}
        </h1>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {themeToggle}
        <Button
          variant="secondary"
          size="sm"
          icon={<PlusIcon size={15} />}
          onClick={onNewChat}
          disabled={isStreaming}
        >
          New chat
        </Button>
      </div>
    </header>
  );
}
