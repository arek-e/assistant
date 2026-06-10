import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
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
  PanelLeftClose,
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
const detailsPanelWidth = 320;
const panelDragOpenThreshold = 80;
const panelDragCloseThreshold = 96;
const panelDragVelocityThreshold = 1600;
const panelDragDeadzone = 4;
const defaultPreviewChatColumnWidth = 432;
const minPreviewChatColumnWidth = 360;
const maxPreviewChatColumnWidth = 520;
const visibleProfilePanelMotion = { opacity: 1, scale: 1, y: 0 };
const hiddenProfilePanelMotion = { opacity: 0, scale: 0.98, y: 4 };

type AssistantShellSlots = {
  primaryAndSecondaryNavigation: ReactNode;
  mainContent: ReactNode;
  rightDetails: ReactNode;
};

type DesktopNavigationSlots = {
  primaryRail: ReactNode;
  secondaryNav: ReactNode;
  resizeBoundary: ReactNode;
};

export function AssistantAppShell({
  children,
  composer,
  connected,
  workspacePreview,
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
  workspacePreview?: ReactNode;
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
  const hasWorkspacePreview = Boolean(workspacePreview);
  const [detailsPanelOpen, setDetailsPanelOpen] = useState(
    () => !hasWorkspacePreview
  );
  const statusLabel = getStatusLabel(isStreaming, connected);
  const shellSlots: AssistantShellSlots = {
    primaryAndSecondaryNavigation: (
      <DesktopAssistantNav
        connected={connected}
        messageCount={messageCount}
        panelOpen={panelOpen}
        showDebug={showDebug}
        onNewChat={onNewChat}
        onPanelOpenChange={setPanelOpen}
        onShowDebugChange={onShowDebugChange}
        themeToggle={themeToggle}
      />
    ),
    mainContent: (
      <AssistantMainContentSlot
        composer={composer}
        detailsPanelOpen={detailsPanelOpen}
        hasWorkspacePreview={hasWorkspacePreview}
        isStreaming={isStreaming}
        messageCount={messageCount}
        onDetailsPanelOpenChange={setDetailsPanelOpen}
        onNewChat={onNewChat}
        workspacePreview={workspacePreview}
      >
        {children}
      </AssistantMainContentSlot>
    ),
    rightDetails: (
      <AssistantDetailsPanel
        connected={connected}
        open={detailsPanelOpen}
        isStreaming={isStreaming}
        messageCount={messageCount}
        serverCount={serverCount}
        showDebug={showDebug}
        statusLabel={statusLabel}
        toolCount={toolCount}
        integrationControls={integrationControls}
        onOpenChange={setDetailsPanelOpen}
        onShowDebugChange={onShowDebugChange}
      />
    )
  };

  return <AssistantShellFrame slots={shellSlots} />;
}

function AssistantShellFrame({ slots }: { slots: AssistantShellSlots }) {
  return (
    <div
      data-shell-slot="app-shell"
      className="h-screen overflow-hidden bg-[#f2f2ef] p-[3px] text-foreground"
    >
      <div className="flex h-full min-h-0 overflow-visible">
        {slots.primaryAndSecondaryNavigation}
        <main className="relative z-10 flex min-w-0 flex-1 overflow-hidden rounded-[1.125rem] border border-white/80 bg-background shadow-[0_0_0_1px_rgba(16,16,15,0.1),0_1px_2px_-1px_rgba(16,16,15,0.1),0_2px_4px_rgba(16,16,15,0.05)] md:ml-[3px]">
          <div className="flex min-h-0 flex-1 overflow-hidden">
            {slots.mainContent}
            {slots.rightDetails}
          </div>
        </main>
      </div>
    </div>
  );
}

function AssistantMainContentSlot({
  children,
  composer,
  detailsPanelOpen,
  hasWorkspacePreview,
  isStreaming,
  messageCount,
  onDetailsPanelOpenChange,
  onNewChat,
  workspacePreview
}: {
  children: ReactNode;
  composer: ReactNode;
  detailsPanelOpen: boolean;
  hasWorkspacePreview: boolean;
  isStreaming: boolean;
  messageCount: number;
  onDetailsPanelOpenChange: (open: boolean) => void;
  onNewChat: () => void;
  workspacePreview?: ReactNode;
}) {
  const [previewChatColumnWidth, setPreviewChatColumnWidth] = useState(
    defaultPreviewChatColumnWidth
  );
  const [isPreviewChatResizing, setIsPreviewChatResizing] = useState(false);
  const previewChatDragStartWidthRef = useRef(defaultPreviewChatColumnWidth);

  return (
    <section
      data-shell-slot="main-content"
      className={getMainContentSlotClassName()}
    >
      <ChatTopbar
        detailsPanelOpen={detailsPanelOpen}
        isStreaming={isStreaming}
        messageCount={messageCount}
        onDetailsPanelOpenChange={onDetailsPanelOpenChange}
        onNewChat={onNewChat}
      />
      <div className={getMainContentBodyClassName(hasWorkspacePreview)}>
        {hasWorkspacePreview && (
          <WorkspacePreviewSlot open={hasWorkspacePreview}>
            {workspacePreview}
          </WorkspacePreviewSlot>
        )}
        {hasWorkspacePreview && (
          <PreviewChatResizeHandle
            resizing={isPreviewChatResizing}
            onResizeStart={() => {
              previewChatDragStartWidthRef.current = previewChatColumnWidth;
              setIsPreviewChatResizing(true);
            }}
            onResize={(offsetX) => {
              setPreviewChatColumnWidth(
                clampPreviewChatColumnWidth(
                  previewChatDragStartWidthRef.current - offsetX
                )
              );
            }}
            onResizeEnd={() => setIsPreviewChatResizing(false)}
          />
        )}
        <div
          className={getChatColumnClassName(
            hasWorkspacePreview,
            isPreviewChatResizing
          )}
          style={getChatColumnStyle(
            hasWorkspacePreview,
            previewChatColumnWidth
          )}
        >
          <motion.div
            className="min-h-0 flex-1 overflow-y-auto"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className={getChatStreamClassName(hasWorkspacePreview)}>
              {children}
            </div>
          </motion.div>
          <div className={getComposerDockClassName(hasWorkspacePreview)}>
            {composer}
          </div>
        </div>
      </div>
    </section>
  );
}

function WorkspacePreviewSlot({
  children,
  open
}: {
  children: ReactNode;
  open: boolean;
}) {
  return (
    <motion.section
      data-shell-slot="workspace-preview"
      aria-hidden={!open}
      inert={!open}
      className={getWorkspacePreviewSlotClassName(open)}
      initial={{ opacity: 0, x: -8 }}
      animate={{
        opacity: open ? 1 : 0,
        x: open ? 0 : -8
      }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.section>
  );
}

function PreviewChatResizeHandle({
  onResize,
  onResizeEnd,
  onResizeStart,
  resizing
}: {
  onResize: (offsetX: number) => void;
  onResizeEnd: () => void;
  onResizeStart: () => void;
  resizing: boolean;
}) {
  return (
    <ResizeBoundaryHandle
      ariaLabel="Resize chat panel"
      containerClassName="relative z-30 hidden h-full w-0 shrink-0 xl:block"
      handleClassName={getPreviewChatResizeHandleClassName(resizing)}
      onDrag={onResize}
      onDragEnd={() => onResizeEnd()}
      onDragStart={onResizeStart}
    />
  );
}

function ResizeBoundaryHandle({
  ariaLabel,
  containerClassName = "relative z-30 h-full w-0 shrink-0",
  handleClassName,
  onClick,
  onDrag,
  onDragEnd,
  onDragStart
}: {
  ariaLabel: string;
  containerClassName?: string;
  handleClassName: string;
  onClick?: () => void;
  onDrag: (offsetX: number) => void;
  onDragEnd: (offsetX: number, velocityX: number) => void;
  onDragStart: () => void;
}) {
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

    beginResizeDrag(event.clientX);
    safelySetPointerCapture(target, pointerId);

    const handleWindowPointerMove = (windowEvent: PointerEvent) => {
      if (windowEvent.pointerId !== pointerId) return;
      updateResizeDrag(windowEvent.clientX);
    };

    const handleWindowPointerEnd = (windowEvent: PointerEvent) => {
      if (windowEvent.pointerId !== pointerId) return;
      finishResizeDrag(windowEvent.clientX, target, pointerId);
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

    beginResizeDrag(event.clientX);

    const handleWindowMouseMove = (windowEvent: MouseEvent) => {
      updateResizeDrag(windowEvent.clientX);
    };

    const handleWindowMouseEnd = (windowEvent: MouseEvent) => {
      finishResizeDrag(windowEvent.clientX, target);
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseEnd);

    dragCleanupRef.current = () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseEnd);
      dragCleanupRef.current = null;
    };
  }

  function beginResizeDrag(clientX: number) {
    dragCleanupRef.current?.();
    draggingRef.current = true;
    dragMovedRef.current = false;
    dragStartXRef.current = clientX;
    lastDragSampleRef.current = { time: performance.now(), x: clientX };
    dragVelocityXRef.current = 0;
    onDragStart();
  }

  function updateResizeDrag(clientX: number) {
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

    onDrag(offsetX);
  }

  function finishResizeDrag(
    clientX: number,
    target: HTMLButtonElement,
    pointerId?: number
  ) {
    if (!draggingRef.current) return;

    updateResizeDrag(clientX);
    const offsetX = clientX - dragStartXRef.current;

    draggingRef.current = false;
    dragCleanupRef.current?.();
    onDragEnd(offsetX, dragVelocityXRef.current);
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

    onClick?.();
  }

  return (
    <div className={containerClassName}>
      <button
        type="button"
        aria-label={ariaLabel}
        className="group absolute left-0 top-0 h-full w-8 -translate-x-1/2 cursor-col-resize touch-none select-none outline-none"
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onPointerDown={handlePointerDown}
      >
        <span aria-hidden className={handleClassName} />
      </button>
    </div>
  );
}

function AssistantDetailsPanel({
  connected,
  open,
  isStreaming,
  messageCount,
  serverCount,
  showDebug,
  statusLabel,
  toolCount,
  integrationControls,
  onOpenChange,
  onShowDebugChange
}: {
  connected: boolean;
  open: boolean;
  isStreaming: boolean;
  messageCount: number;
  serverCount: number;
  showDebug: boolean;
  statusLabel: string;
  toolCount: number;
  integrationControls: ReactNode;
  onOpenChange: (open: boolean) => void;
  onShowDebugChange: (checked: boolean) => void;
}) {
  return (
    <motion.aside
      data-shell-slot="right-details"
      aria-hidden={!open}
      className="hidden h-full shrink-0 overflow-hidden bg-background lg:block"
      initial={false}
      animate={{
        width: getDetailsPanelWidth(open),
        boxShadow: getDetailsPanelShadow(open)
      }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        inert={getDetailsPanelInert(open)}
        className="flex h-full w-80 flex-col"
        initial={false}
        animate={{ opacity: getDetailsPanelContentOpacity(open) }}
        transition={{ duration: getDetailsPanelContentFadeDuration(open) }}
      >
        <div className="flex h-12 shrink-0 items-center justify-between gap-3 px-5">
          <h2 className="truncate text-sm font-medium text-neutral-950">
            Agent details
          </h2>
          <button
            type="button"
            aria-label="Collapse details panel"
            className="relative grid size-8 shrink-0 place-items-center rounded-md text-neutral-700 transition-[background-color,scale] hover:bg-black/5 active:scale-[0.96] before:absolute before:-inset-1 before:content-['']"
            onClick={() => onOpenChange(false)}
          >
            <PanelLeftClose size={15} />
          </button>
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
      </motion.div>
    </motion.aside>
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
  themeToggle,
  onNewChat,
  onPanelOpenChange,
  onShowDebugChange
}: {
  connected: boolean;
  messageCount: number;
  panelOpen: boolean;
  showDebug: boolean;
  themeToggle: ReactNode;
  onNewChat: () => void;
  onPanelOpenChange: (open: boolean) => void;
  onShowDebugChange: (checked: boolean) => void;
}) {
  const avatarState = getAvatarState(connected);
  const [dragPanelWidth, setDragPanelWidth] = useState<number | null>(null);
  const dragStartPanelWidthRef = useRef(getPanelWidth(panelOpen));
  const renderedPanelWidth = dragPanelWidth ?? getPanelWidth(panelOpen);
  const isPanelDragging = dragPanelWidth !== null;
  const navigationSlots: DesktopNavigationSlots = {
    primaryRail: (
      <PrimaryRail
        connected={connected}
        panelOpen={panelOpen}
        themeToggle={themeToggle}
        onNewChat={onNewChat}
        onPanelOpenChange={onPanelOpenChange}
      />
    ),
    secondaryNav: (
      <SecondaryNavigationSlot
        avatarState={avatarState}
        isPanelDragging={isPanelDragging}
        messageCount={messageCount}
        renderedPanelWidth={renderedPanelWidth}
        showDebug={showDebug}
        onNewChat={onNewChat}
        onShowDebugChange={onShowDebugChange}
      />
    ),
    resizeBoundary: (
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
    )
  };

  return <DesktopNavigationFrame slots={navigationSlots} />;
}

function DesktopNavigationFrame({ slots }: { slots: DesktopNavigationSlots }) {
  return (
    <div className="relative z-20 hidden h-full shrink-0 md:flex">
      {slots.primaryRail}
      {slots.secondaryNav}
      {slots.resizeBoundary}
    </div>
  );
}

function SecondaryNavigationSlot({
  avatarState,
  isPanelDragging,
  messageCount,
  renderedPanelWidth,
  showDebug,
  onNewChat,
  onShowDebugChange
}: {
  avatarState: AgentVisualState;
  isPanelDragging: boolean;
  messageCount: number;
  renderedPanelWidth: number;
  showDebug: boolean;
  onNewChat: () => void;
  onShowDebugChange: (checked: boolean) => void;
}) {
  return (
    <motion.aside
      data-shell-slot="secondary-nav"
      aria-hidden={renderedPanelWidth === collapsedPanelWidth}
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

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
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
  );
}

function PrimaryRail({
  connected,
  panelOpen,
  themeToggle,
  onNewChat,
  onPanelOpenChange
}: {
  connected: boolean;
  panelOpen: boolean;
  themeToggle: ReactNode;
  onNewChat: () => void;
  onPanelOpenChange: (open: boolean) => void;
}) {
  const connectionDotClass = getConnectionDotClass(connected);

  return (
    <aside
      data-shell-slot="primary-rail"
      className="relative flex h-full w-16 shrink-0 flex-col items-center rounded-[1.125rem] bg-[#10100f] py-3 text-white shadow-[0_10px_28px_rgba(16,16,15,0.18)]"
    >
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

      <PrimaryRailBottomActions
        connected={connected}
        connectionDotClass={connectionDotClass}
        themeToggle={themeToggle}
      />
    </aside>
  );
}

function PrimaryRailBottomActions({
  connected,
  connectionDotClass,
  themeToggle
}: {
  connected: boolean;
  connectionDotClass: string;
  themeToggle: ReactNode;
}) {
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <>
      <div className="mb-2 flex shrink-0 flex-col items-center gap-2">
        <div className="[&>button]:size-8 [&>button]:border-white/10 [&>button]:bg-white/[0.10] [&>button]:text-white [&>button:hover]:bg-white/[0.16]">
          {themeToggle}
        </div>
        <button
          type="button"
          aria-controls="primary-rail-profile-panel"
          aria-expanded={profileOpen}
          aria-label="Toggle user profile"
          className="relative grid size-8 place-items-center rounded-full bg-white/[0.12] text-[11px] font-medium text-white transition-colors hover:bg-white/[0.18] active:scale-95"
          onClick={() => setProfileOpen(!profileOpen)}
        >
          TP
          <span
            className={cn(
              "absolute bottom-0 right-0 size-2.5 rounded-full ring-2 ring-[#10100f]",
              connectionDotClass
            )}
            title={getConnectionLabel(connected)}
          />
        </button>
      </div>

      <motion.div
        id="primary-rail-profile-panel"
        aria-hidden={getProfilePanelHidden(profileOpen)}
        className={getProfilePanelClassName(profileOpen)}
        initial={false}
        animate={getProfilePanelMotion(profileOpen)}
        transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center gap-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-neutral-950 text-xs font-medium text-white">
            TP
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">
              Teampitch
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              Local workspace
            </span>
          </span>
        </div>
      </motion.div>
    </>
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

  return (
    <ResizeBoundaryHandle
      ariaLabel={toggleLabel}
      handleClassName="absolute left-[calc(50%+0.25rem)] top-1/2 h-7 w-1 -translate-y-1/2 rounded-full bg-neutral-400/70 opacity-0 shadow-[0_1px_3px_rgba(16,16,15,0.16)] transition-[height,background-color,opacity,box-shadow] duration-150 group-hover:h-8 group-hover:bg-neutral-500/75 group-hover:opacity-100 group-hover:shadow-[0_1px_5px_rgba(16,16,15,0.18)] group-focus-visible:opacity-100 group-focus-visible:ring-2 group-focus-visible:ring-ring/35"
      onClick={() => onPanelOpenChange(!panelOpen)}
      onDrag={onPanelDrag}
      onDragEnd={onPanelDragEnd}
      onDragStart={onPanelDragStart}
    />
  );
}

function getStatusLabel(isStreaming: boolean, connected: boolean) {
  if (isStreaming) return "Responding";
  return connected ? "Ready" : "Offline";
}

function getPanelWidth(panelOpen: boolean) {
  return panelOpen ? expandedPanelWidth : collapsedPanelWidth;
}

function getDetailsPanelWidth(open: boolean) {
  return open ? detailsPanelWidth : collapsedPanelWidth;
}

function getDetailsPanelShadow(open: boolean) {
  return open ? "-1px 0 0 rgba(16,16,15,0.08)" : "0 0 0 rgba(16,16,15,0)";
}

function getDetailsPanelContentOpacity(open: boolean) {
  return open ? 1 : 0;
}

function getDetailsPanelContentFadeDuration(open: boolean) {
  return open ? 0.16 : 0.1;
}

function getDetailsPanelInert(open: boolean) {
  return !open;
}

function getMainContentSlotClassName() {
  return "relative flex min-w-0 flex-1 flex-col bg-background";
}

function getMainContentBodyClassName(hasWorkspacePreview: boolean) {
  return cn(
    "min-h-0 flex-1 overflow-hidden",
    hasWorkspacePreview
      ? "flex flex-col p-0 xl:flex-row xl:gap-0 xl:overflow-visible xl:p-3"
      : "flex flex-col"
  );
}

function getChatColumnClassName(
  hasWorkspacePreview: boolean,
  isResizing = false
) {
  return cn(
    "flex min-h-0 flex-col bg-background",
    hasWorkspacePreview
      ? [
          "min-w-0 flex-1 overflow-hidden xl:w-[var(--preview-chat-width)] xl:min-w-[22.5rem] xl:flex-none xl:overflow-visible xl:pl-3",
          isResizing
            ? "xl:transition-none"
            : "xl:transition-[width] xl:duration-200 xl:ease-out"
        ]
      : "min-w-0 flex-1"
  );
}

function getChatColumnStyle(
  hasWorkspacePreview: boolean,
  previewChatColumnWidth: number
) {
  if (!hasWorkspacePreview) return undefined;

  return {
    "--preview-chat-width": `${previewChatColumnWidth}px`
  } as CSSProperties;
}

function getChatStreamClassName(hasWorkspacePreview: boolean) {
  return cn(
    "mx-auto w-full",
    hasWorkspacePreview
      ? "max-w-3xl px-5 pb-10 pt-10 sm:px-8 lg:pt-16 xl:max-w-none xl:px-1 xl:pb-4 xl:pt-3"
      : "max-w-3xl px-5 pb-10 pt-10 sm:px-8 lg:pt-16"
  );
}

function getComposerDockClassName(hasWorkspacePreview: boolean) {
  return cn(
    "shrink-0 bg-gradient-to-t from-background via-background to-background/0",
    hasWorkspacePreview
      ? "px-4 pb-5 pt-3 sm:px-8 xl:-mx-1 xl:px-1 xl:pb-3 xl:pt-2"
      : "px-4 pb-5 pt-3 sm:px-8"
  );
}

function getWorkspacePreviewSlotClassName(open: boolean) {
  return cn(
    "hidden min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-black/10 bg-[#fbfbfa]",
    open && "xl:flex"
  );
}

function getPreviewChatResizeHandleClassName(resizing: boolean) {
  return cn(
    "absolute left-1/2 top-1/2 h-7 w-1 -translate-y-1/2 rounded-full bg-neutral-400/70 opacity-0 shadow-[0_1px_3px_rgba(16,16,15,0.16)] transition-[height,background-color,opacity,box-shadow] duration-150 group-hover:h-8 group-hover:bg-neutral-500/75 group-hover:opacity-100 group-hover:shadow-[0_1px_5px_rgba(16,16,15,0.18)] group-focus-visible:opacity-100 group-focus-visible:ring-2 group-focus-visible:ring-ring/35",
    resizing &&
      "h-8 bg-neutral-500/75 opacity-100 shadow-[0_1px_5px_rgba(16,16,15,0.18)]"
  );
}

function clampPanelWidth(width: number) {
  return Math.min(expandedPanelWidth, Math.max(collapsedPanelWidth, width));
}

function clampPreviewChatColumnWidth(width: number) {
  return Math.min(
    maxPreviewChatColumnWidth,
    Math.max(minPreviewChatColumnWidth, width)
  );
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

function getProfilePanelHidden(profileOpen: boolean) {
  return !profileOpen;
}

function getProfilePanelClassName(profileOpen: boolean) {
  return cn(
    "absolute bottom-2 left-[4.5rem] w-56 rounded-xl border border-black/10 bg-background p-3 text-neutral-950 shadow-[0_12px_32px_rgba(16,16,15,0.16)]",
    !profileOpen && "pointer-events-none"
  );
}

function getProfilePanelMotion(profileOpen: boolean) {
  return profileOpen ? visibleProfilePanelMotion : hiddenProfilePanelMotion;
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
  detailsPanelOpen,
  isStreaming,
  messageCount,
  onDetailsPanelOpenChange,
  onNewChat
}: {
  detailsPanelOpen: boolean;
  isStreaming: boolean;
  messageCount: number;
  onDetailsPanelOpenChange: (open: boolean) => void;
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
        <Button
          variant="secondary"
          size="sm"
          icon={<PlusIcon size={15} />}
          onClick={onNewChat}
          disabled={isStreaming}
        >
          New chat
        </Button>
        {!detailsPanelOpen && (
          <button
            type="button"
            aria-label="Open details panel"
            className="relative grid size-8 shrink-0 place-items-center rounded-md text-neutral-700 transition-[background-color,scale] hover:bg-black/5 active:scale-[0.96] before:absolute before:-inset-1 before:content-['']"
            onClick={() => onDetailsPanelOpenChange(true)}
          >
            <PanelLeftClose size={15} className="scale-x-[-1]" />
          </button>
        )}
      </div>
    </header>
  );
}
