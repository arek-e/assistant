import * as m from "motion/react-m";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from "react";

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
  glassNavigationSurfaceClassName,
  glassPanelSurfaceClassName,
  solidSurfaceClassName
} from "@teampitch/ui/lib/surface-tokens";
import { cn } from "@teampitch/ui/lib/utils";

const expandedPanelWidth = 304;
const collapsedPanelWidth = 0;
const detailsPanelWidth = 320;
const panelDragOpenThreshold = 80;
const panelDragCloseThreshold = 96;
const panelDragVelocityThreshold = 1600;
const panelDragDeadzone = 4;
const secondaryNavExitDurationMs = 200;
const defaultPreviewChatColumnWidth = 432;
const minPreviewChatColumnWidth = 360;
const maxPreviewChatColumnWidth = 520;

export type PrimaryAppView = "home" | "chats" | "integrations";

interface AssistantShellSlots {
  primaryAndSecondaryNavigation: ReactNode;
  mainContent: ReactNode;
  rightDetails: ReactNode;
}

interface DesktopNavigationSlots {
  primaryRail: ReactNode;
  secondaryNav?: ReactNode;
  resizeBoundary?: ReactNode;
}

export function AssistantAppShell({
  children,
  composer,
  connected,
  activeView,
  routeContent,
  routeDetails,
  workspacePreview,
  isStreaming,
  showDebug,
  toolCount,
  serverCount,
  messageCount,
  integrationControls,
  themeToggle,
  accountControls,
  activeChatStartedAt,
  onOpenSettings,
  onNavigateView,
  onShowDebugChange,
  onNewChat
}: {
  children: ReactNode;
  composer: ReactNode;
  connected: boolean;
  activeView: PrimaryAppView;
  routeContent?: ReactNode;
  routeDetails?: ReactNode;
  workspacePreview?: ReactNode;
  isStreaming: boolean;
  showDebug: boolean;
  toolCount: number;
  serverCount: number;
  messageCount: number;
  integrationControls: ReactNode;
  themeToggle: ReactNode;
  accountControls: ReactNode;
  activeChatStartedAt: Date;
  onOpenSettings?: () => void;
  onNavigateView: (view: PrimaryAppView) => void;
  onShowDebugChange: (checked: boolean) => void;
  onNewChat: () => void;
}) {
  const [panelOpen, setPanelOpen] = useState(true);
  const showingChat = activeView === "chats";
  const hasWorkspacePreview = showingChat && Boolean(workspacePreview);
  const [detailsPanelOpen, setDetailsPanelOpen] = useState(() => !hasWorkspacePreview);
  const statusLabel = getStatusLabel(isStreaming, connected);
  const handleOpenSettings = useCallback(() => {
    onOpenSettings?.();
  }, [onOpenSettings]);
  const secondaryNavigation = showingChat ? (
    <ChatSecondaryNavigationContent
      activeChatStartedAt={activeChatStartedAt}
      messageCount={messageCount}
      onNewChat={onNewChat}
    />
  ) : null;
  const shellSlots: AssistantShellSlots = {
    primaryAndSecondaryNavigation: (
      <DesktopAssistantNav
        activeView={activeView}
        panelOpen={panelOpen}
        secondaryNavigation={secondaryNavigation}
        onNavigateView={onNavigateView}
        onPanelOpenChange={setPanelOpen}
        onOpenSettings={handleOpenSettings}
        themeToggle={themeToggle}
        accountControls={accountControls}
      />
    ),
    mainContent: showingChat ? (
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
    ) : (
      <AssistantRouteContentSlot>{routeContent}</AssistantRouteContentSlot>
    ),
    rightDetails: showingChat ? (
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
    ) : (
      <AssistantRouteDetailsPanel open={Boolean(routeDetails)}>
        {routeDetails}
      </AssistantRouteDetailsPanel>
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
        <main
          className={cn(
            "relative z-10 flex min-w-0 flex-1 rounded-[1.125rem] md:ml-[3px]",
            glassPanelSurfaceClassName
          )}
        >
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
    <section data-shell-slot="main-content" className={getMainContentSlotClassName()}>
      <ChatTopbar
        detailsPanelOpen={detailsPanelOpen}
        isStreaming={isStreaming}
        messageCount={messageCount}
        onDetailsPanelOpenChange={onDetailsPanelOpenChange}
        onNewChat={onNewChat}
      />
      <div className={getMainContentBodyClassName(hasWorkspacePreview)}>
        {hasWorkspacePreview && (
          <WorkspacePreviewSlot open={hasWorkspacePreview}>{workspacePreview}</WorkspacePreviewSlot>
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
                clampPreviewChatColumnWidth(previewChatDragStartWidthRef.current - offsetX)
              );
            }}
            onResizeEnd={() => setIsPreviewChatResizing(false)}
          />
        )}
        <div
          className={getChatColumnClassName(hasWorkspacePreview, isPreviewChatResizing)}
          style={getChatColumnStyle(hasWorkspacePreview, previewChatColumnWidth)}
        >
          <m.div
            className="min-h-0 flex-1 overflow-y-auto"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className={getChatStreamClassName(hasWorkspacePreview)}>{children}</div>
          </m.div>
          <div className={getComposerDockClassName(hasWorkspacePreview)}>{composer}</div>
        </div>
      </div>
    </section>
  );
}

function AssistantRouteContentSlot({ children }: { children: ReactNode }) {
  return (
    <section data-shell-slot="main-route" className="min-h-0 flex-1 overflow-y-auto bg-transparent">
      <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 lg:py-12">{children}</div>
    </section>
  );
}

function AssistantRouteDetailsPanel({ children, open }: { children?: ReactNode; open: boolean }) {
  return (
    <DetailsPanelSurface dataSlot="route-details" open={open}>
      {children}
    </DetailsPanelSurface>
  );
}

function DetailsPanelSurface({
  children,
  dataSlot,
  open
}: {
  children?: ReactNode;
  dataSlot: "right-details" | "route-details";
  open: boolean;
}) {
  return (
    <m.aside
      data-shell-slot={dataSlot}
      aria-hidden={!open}
      className={cn(
        "absolute inset-y-0 right-0 z-40 h-full rounded-none border-y-0 border-r-0 transition-[width,box-shadow] duration-200 ease-out lg:relative lg:z-auto lg:block lg:shrink-0",
        glassPanelSurfaceClassName,
        open ? "border-l" : "border-l-0",
        !open && "pointer-events-none"
      )}
      initial={false}
      style={{
        width: getDetailsPanelWidth(open),
        boxShadow: getDetailsPanelShadow(open)
      }}
    >
      <m.div
        inert={getDetailsPanelInert(open)}
        className="flex h-full w-80 flex-col transition-opacity duration-150"
        initial={false}
        style={{ opacity: getDetailsPanelContentOpacity(open) }}
      >
        {children}
      </m.div>
    </m.aside>
  );
}

function WorkspacePreviewSlot({ children, open }: { children: ReactNode; open: boolean }) {
  return (
    <m.section
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
    </m.section>
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
  const cleanupResizeDrag = useCallback(() => {
    dragCleanupRef.current?.();
  }, []);

  useEffect(() => {
    return cleanupResizeDrag;
  }, [cleanupResizeDrag]);

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

  function finishResizeDrag(clientX: number, target: HTMLButtonElement, pointerId?: number) {
    if (!draggingRef.current) return;

    updateResizeDrag(clientX);
    const offsetX = clientX - dragStartXRef.current;
    const moved = dragMovedRef.current;

    draggingRef.current = false;
    dragCleanupRef.current?.();
    if (pointerId !== undefined) {
      safelyReleasePointerCapture(target, pointerId);
    }
    if (!moved && onClick) {
      onDragEnd(0, 0);
      dragMovedRef.current = true;
      onClick();
      return;
    }

    onDragEnd(offsetX, dragVelocityXRef.current);
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
        title={ariaLabel}
        className="group absolute top-0 left-0 h-full w-8 -translate-x-1/2 cursor-col-resize touch-none outline-none select-none"
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
    <DetailsPanelSurface dataSlot="right-details" open={open}>
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 px-5">
        <h2 className="truncate text-sm font-medium text-neutral-950">Agent details</h2>
        <button
          type="button"
          aria-label="Collapse details panel"
          title="Collapse details panel"
          className="relative grid size-8 shrink-0 place-items-center rounded-md text-neutral-700 transition-[background-color,scale] before:absolute before:-inset-1 before:content-[''] hover:bg-black/5 active:scale-[0.96]"
          onClick={() => onOpenChange(false)}
        >
          <PanelLeftClose size={15} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <DetailsSection title="Runtime">
          <DetailsRow icon={<ChatCircleDotsIcon size={15} />} label="Status" value={statusLabel} />
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
          <DetailsRow icon={<WrenchIcon size={15} />} label="MCP tools" value={`${toolCount}`} />
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
    </DetailsPanelSurface>
  );
}

function DetailsSection({ title, children }: { title: string; children: ReactNode }) {
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
        {icon ?? (dotClassName && <span className={cn("size-2 rounded-full", dotClassName)} />)}
      </span>
      <span className="min-w-0 truncate text-neutral-500">{label}</span>
      <span className="min-w-0 truncate text-right text-neutral-950 tabular-nums">{value}</span>
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
      <span className="grid size-4 shrink-0 place-items-center text-neutral-400">{icon}</span>
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
  activeView,
  panelOpen,
  secondaryNavigation,
  themeToggle,
  accountControls,
  onNavigateView,
  onOpenSettings,
  onPanelOpenChange
}: {
  activeView: PrimaryAppView;
  panelOpen: boolean;
  secondaryNavigation?: ReactNode;
  themeToggle: ReactNode;
  accountControls: ReactNode;
  onNavigateView: (view: PrimaryAppView) => void;
  onOpenSettings: () => void;
  onPanelOpenChange: (open: boolean) => void;
}) {
  const [dragPanelWidth, setDragPanelWidth] = useState<number | null>(null);
  const dragStartPanelWidthRef = useRef(0);
  const hasSecondaryNavigation = Boolean(secondaryNavigation);
  const [secondaryNavigationMounted, setSecondaryNavigationMounted] =
    useState(hasSecondaryNavigation);
  const lastSecondaryNavigationRef = useRef<ReactNode>(secondaryNavigation);
  const secondaryNavigationExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldRenderSecondaryNavigation = hasSecondaryNavigation || secondaryNavigationMounted;
  const secondaryPanelOpen = hasSecondaryNavigation && panelOpen;
  const renderedPanelWidth = dragPanelWidth ?? getPanelWidth(secondaryPanelOpen);
  const isPanelDragging = dragPanelWidth !== null;

  if (hasSecondaryNavigation) {
    lastSecondaryNavigationRef.current = secondaryNavigation;
  }

  useEffect(() => {
    if (secondaryNavigationExitTimerRef.current) {
      clearTimeout(secondaryNavigationExitTimerRef.current);
      secondaryNavigationExitTimerRef.current = null;
    }

    if (hasSecondaryNavigation) {
      setSecondaryNavigationMounted(true);
      return;
    }

    if (!lastSecondaryNavigationRef.current || !secondaryNavigationMounted) return;

    secondaryNavigationExitTimerRef.current = setTimeout(() => {
      setSecondaryNavigationMounted(false);
      lastSecondaryNavigationRef.current = null;
      secondaryNavigationExitTimerRef.current = null;
    }, secondaryNavExitDurationMs);

    return () => {
      if (secondaryNavigationExitTimerRef.current) {
        clearTimeout(secondaryNavigationExitTimerRef.current);
        secondaryNavigationExitTimerRef.current = null;
      }
    };
  }, [hasSecondaryNavigation, secondaryNavigationMounted]);

  const navigationSlots: DesktopNavigationSlots = {
    primaryRail: (
      <PrimaryRail
        activeView={activeView}
        hasSecondaryNavigation={hasSecondaryNavigation}
        themeToggle={themeToggle}
        accountControls={accountControls}
        onNavigateView={onNavigateView}
        onOpenSettings={onOpenSettings}
        onPanelOpenChange={onPanelOpenChange}
      />
    ),
    secondaryNav: shouldRenderSecondaryNavigation ? (
      <SecondaryNavigationSlot
        closing={!hasSecondaryNavigation}
        isPanelDragging={isPanelDragging}
        renderedPanelWidth={renderedPanelWidth}
      >
        {hasSecondaryNavigation ? secondaryNavigation : lastSecondaryNavigationRef.current}
      </SecondaryNavigationSlot>
    ) : null,
    resizeBoundary: hasSecondaryNavigation ? (
      <PanelBoundary
        panelOpen={secondaryPanelOpen}
        onPanelOpenChange={onPanelOpenChange}
        onPanelDrag={(offsetX) => {
          setDragPanelWidth(clampPanelWidth(dragStartPanelWidthRef.current + offsetX));
        }}
        onPanelDragEnd={(offsetX, velocityX) => {
          const nextPanelOpen = getNextPanelOpenState(secondaryPanelOpen, offsetX, velocityX);
          setDragPanelWidth(null);
          onPanelOpenChange(nextPanelOpen);
        }}
        onPanelDragStart={() => {
          dragStartPanelWidthRef.current = getPanelWidth(secondaryPanelOpen);
          setDragPanelWidth(getPanelWidth(secondaryPanelOpen));
        }}
      />
    ) : null
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
  children,
  closing,
  isPanelDragging,
  renderedPanelWidth
}: {
  children: ReactNode;
  closing: boolean;
  isPanelDragging: boolean;
  renderedPanelWidth: number;
}) {
  return (
    <m.aside
      data-shell-slot="secondary-nav"
      aria-hidden={renderedPanelWidth === collapsedPanelWidth}
      className={cn(
        "h-full overflow-hidden bg-transparent",
        !isPanelDragging &&
          "transition-[width] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
      )}
      style={{ width: renderedPanelWidth }}
    >
      <m.div
        inert={renderedPanelWidth === collapsedPanelWidth || closing}
        className={cn(
          "flex h-full w-[19rem] flex-col p-3",
          !isPanelDragging &&
            "transition-opacity duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
        )}
        style={{ opacity: getPanelContentOpacity(renderedPanelWidth) }}
      >
        {children}
      </m.div>
    </m.aside>
  );
}

function ChatSecondaryNavigationContent({
  activeChatStartedAt,
  messageCount,
  onNewChat
}: {
  activeChatStartedAt: Date;
  messageCount: number;
  onNewChat: () => void;
}) {
  return (
    <>
      <div className="mb-4 flex h-9 items-center justify-between px-1">
        <h2 className="min-w-0 truncate text-sm font-medium text-neutral-900">Chats</h2>
        <Button
          variant="ghost"
          size="sm"
          shape="square"
          icon={<PlusIcon size={15} />}
          aria-label="New chat"
          title="New chat"
          onClick={onNewChat}
        />
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
        <NavSection title="Active chats">
          <PanelNavLabel
            active
            icon={<ChatCircleDotsIcon size={16} />}
            label={messageCount > 0 ? "Current chat" : "New chat"}
            value={formatChatTimestamp(activeChatStartedAt)}
          />
        </NavSection>
      </div>
    </>
  );
}

function PrimaryRail({
  activeView,
  hasSecondaryNavigation,
  themeToggle,
  accountControls,
  onNavigateView,
  onOpenSettings,
  onPanelOpenChange
}: {
  activeView: PrimaryAppView;
  hasSecondaryNavigation: boolean;
  themeToggle: ReactNode;
  accountControls: ReactNode;
  onNavigateView: (view: PrimaryAppView) => void;
  onOpenSettings: () => void;
  onPanelOpenChange: (open: boolean) => void;
}) {
  return (
    <aside
      data-shell-slot="primary-rail"
      data-navigation-shell="primary"
      className="relative flex h-full w-16 shrink-0 text-white"
    >
      <span
        aria-hidden
        className={cn(
          "app-navigation-shell-transition pointer-events-none absolute inset-0",
          glassNavigationSurfaceClassName
        )}
      />
      <div
        data-navigation-content="primary"
        className="app-navigation-content-transition relative z-10 flex h-full w-full flex-col items-center py-3"
      >
        <button
          type="button"
          aria-label={hasSecondaryNavigation ? "Open secondary navigation" : "Home"}
          className="grid size-9 place-items-center rounded-lg text-white transition-colors hover:bg-white/[0.08] active:scale-95"
          onClick={() => {
            if (hasSecondaryNavigation) {
              onPanelOpenChange(true);
              return;
            }

            onNavigateView("home");
          }}
        >
          <RailMark />
        </button>

        <nav className="mt-7 flex flex-1 flex-col items-center gap-1.5">
          <RailButton
            active={activeView === "home"}
            label="Home"
            icon={<RailMark compact />}
            onClick={() => {
              onNavigateView("home");
              onPanelOpenChange(true);
            }}
          />
          <RailButton
            active={activeView === "chats"}
            label="Chats"
            icon={<ChatCircleDotsIcon size={17} />}
            onClick={() => {
              onNavigateView("chats");
              onPanelOpenChange(true);
            }}
          />
          <RailButton
            active={activeView === "integrations"}
            label="Integrations"
            icon={<PlugsConnectedIcon size={17} />}
            onClick={() => {
              onNavigateView("integrations");
              onPanelOpenChange(true);
            }}
          />
        </nav>

        <PrimaryRailBottomActions
          themeToggle={themeToggle}
          accountControls={accountControls}
          onOpenSettings={onOpenSettings}
        />
      </div>
    </aside>
  );
}

function PrimaryRailBottomActions({
  themeToggle,
  accountControls,
  onOpenSettings
}: {
  themeToggle: ReactNode;
  accountControls: ReactNode;
  onOpenSettings: () => void;
}) {
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <>
      <div className="mb-2 flex shrink-0 flex-col items-center">
        <button
          type="button"
          aria-controls="primary-rail-profile-panel"
          aria-expanded={profileOpen}
          aria-label="Toggle user profile"
          className="relative grid size-8 place-items-center rounded-full bg-white/[0.12] text-[11px] font-medium text-white transition-colors hover:bg-white/[0.18] active:scale-95"
          onClick={() => setProfileOpen(!profileOpen)}
        >
          TP
        </button>
      </div>

      <div
        id="primary-rail-profile-panel"
        aria-hidden={getProfilePanelHidden(profileOpen)}
        className={getProfilePanelClassName(profileOpen)}
        style={getProfilePanelStyle(profileOpen)}
      >
        <div className="space-y-2">
          <div className="flex min-h-9 items-center justify-between gap-3 rounded-lg px-2 text-sm">
            <span className="text-muted-foreground">Theme</span>
            <div className="[&>button]:size-8">{themeToggle}</div>
          </div>
          <button
            type="button"
            className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-sm text-neutral-700 transition-colors hover:bg-black/5 hover:text-neutral-950"
            onClick={() => {
              onOpenSettings();
              setProfileOpen(false);
            }}
          >
            <GearIcon size={15} className="shrink-0 text-neutral-500" />
            <span className="min-w-0 flex-1 truncate">Settings</span>
          </button>
        </div>
        <div className="mt-3 border-t border-border/70 pt-3 [&>div]:w-full [&>div]:justify-between">
          {accountControls}
        </div>
      </div>
    </>
  );
}

function RailMark({ compact = false }: { compact?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn("grid grid-cols-2 grid-rows-2 gap-0.5", compact ? "size-4" : "size-5")}
    >
      <span className="bg-current" />
      <span className="bg-current" />
      <span className="bg-current" />
      <span className="bg-current" />
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

function getDetailsPanelInert(open: boolean) {
  return !open;
}

function getMainContentSlotClassName() {
  return "relative flex min-w-0 flex-1 flex-col bg-transparent";
}

function getMainContentBodyClassName(hasWorkspacePreview: boolean) {
  return cn(
    "min-h-0 flex-1 overflow-hidden",
    hasWorkspacePreview
      ? "flex flex-col p-0 xl:flex-row xl:gap-0 xl:overflow-visible xl:p-3"
      : "flex flex-col"
  );
}

function getChatColumnClassName(hasWorkspacePreview: boolean, isResizing = false) {
  return cn(
    "flex min-h-0 flex-col bg-transparent",
    hasWorkspacePreview
      ? [
          "min-w-0 flex-1 overflow-hidden xl:w-[var(--preview-chat-width)] xl:min-w-[22.5rem] xl:flex-none xl:overflow-visible xl:pl-3",
          isResizing ? "xl:transition-none" : "xl:transition-[width] xl:duration-200 xl:ease-out"
        ]
      : "min-w-0 flex-1"
  );
}

function getChatColumnStyle(hasWorkspacePreview: boolean, previewChatColumnWidth: number) {
  if (!hasWorkspacePreview) return undefined;

  return {
    "--preview-chat-width": `${previewChatColumnWidth}px`
  } as CSSProperties;
}

function getChatStreamClassName(hasWorkspacePreview: boolean) {
  return cn(
    "mx-auto w-full",
    hasWorkspacePreview
      ? "max-w-3xl px-5 pt-10 pb-10 sm:px-8 lg:pt-16 xl:max-w-none xl:px-1 xl:pt-3 xl:pb-4"
      : "max-w-3xl px-5 pt-10 pb-10 sm:px-8 lg:pt-16"
  );
}

function getComposerDockClassName(hasWorkspacePreview: boolean) {
  return cn(
    "shrink-0 bg-gradient-to-t from-background via-background to-background/0",
    hasWorkspacePreview
      ? "px-4 pt-3 pb-5 sm:px-8 xl:-mx-1 xl:px-1 xl:pt-2 xl:pb-3"
      : "px-4 pt-3 pb-5 sm:px-8"
  );
}

function getWorkspacePreviewSlotClassName(open: boolean) {
  return cn(
    "relative hidden min-w-0 flex-1 flex-col rounded-lg",
    glassPanelSurfaceClassName,
    open && "xl:flex"
  );
}

function getPreviewChatResizeHandleClassName(resizing: boolean) {
  return cn(
    "absolute top-1/2 left-1/2 h-7 w-1 -translate-y-1/2 rounded-full bg-neutral-400/70 opacity-0 shadow-[0_1px_3px_rgba(16,16,15,0.16)] transition-[height,background-color,opacity,box-shadow] duration-150 group-hover:h-8 group-hover:bg-neutral-500/75 group-hover:opacity-100 group-hover:shadow-[0_1px_5px_rgba(16,16,15,0.18)] group-focus-visible:opacity-100 group-focus-visible:ring-2 group-focus-visible:ring-ring/35",
    resizing && "h-8 bg-neutral-500/75 opacity-100 shadow-[0_1px_5px_rgba(16,16,15,0.18)]"
  );
}

function clampPanelWidth(width: number) {
  return Math.min(expandedPanelWidth, Math.max(collapsedPanelWidth, width));
}

function clampPreviewChatColumnWidth(width: number) {
  return Math.min(maxPreviewChatColumnWidth, Math.max(minPreviewChatColumnWidth, width));
}

function getPanelContentOpacity(width: number) {
  return Math.min(1, Math.max(0, (width - 64) / 96));
}

function getNextPanelOpenState(panelOpen: boolean, offsetX: number, velocityX: number) {
  if (panelOpen) {
    return !(offsetX <= -panelDragCloseThreshold || velocityX <= -panelDragVelocityThreshold);
  }

  return offsetX >= panelDragOpenThreshold || velocityX >= panelDragVelocityThreshold;
}

const chatTimestampFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit"
});

function formatChatTimestamp(value: Date) {
  return chatTimestampFormatter.format(value);
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
  return panelOpen ? "Resize or collapse navigation" : "Resize or open navigation";
}

function getProfilePanelHidden(profileOpen: boolean) {
  return !profileOpen;
}

function getProfilePanelClassName(profileOpen: boolean) {
  return cn(
    "absolute bottom-2 left-[4.5rem] z-50 w-56 p-3 text-neutral-950 transition-[opacity,transform] duration-150 ease-out",
    solidSurfaceClassName,
    !profileOpen && "pointer-events-none"
  );
}

function getProfilePanelStyle(profileOpen: boolean): CSSProperties {
  return {
    opacity: profileOpen ? 1 : 0,
    transform: profileOpen ? "translateY(0) scale(1)" : "translateY(4px) scale(0.98)"
  };
}

function safelySetPointerCapture(target: HTMLButtonElement, pointerId: number) {
  try {
    target.setPointerCapture(pointerId);
  } catch {
    // Synthetic and cancelled pointers might not be capturable.
  }
}

function safelyReleasePointerCapture(target: HTMLButtonElement, pointerId: number) {
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

function NavSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-1 px-2 text-xs font-medium text-muted-foreground">{title}</h2>
      <div className="space-y-0.5">{children}</div>
    </section>
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
      <span className="grid size-4 shrink-0 place-items-center text-neutral-500">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {value ? <span className="text-xs text-muted-foreground">{value}</span> : null}
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
          <Button
            variant="secondary"
            size="sm"
            title="Open details panel"
            icon={<PanelLeftClose size={15} className="scale-x-[-1]" />}
            onClick={() => onDetailsPanelOpenChange(true)}
          >
            Details
          </Button>
        )}
      </div>
    </header>
  );
}
