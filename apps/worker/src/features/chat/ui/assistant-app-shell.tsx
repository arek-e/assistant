import { useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@teampitch/ui/lib/utils";
import {
  ChatCircleDotsIcon,
  PanelLeftClose,
  PanelRight,
  PlusIcon,
  WrenchIcon
} from "@/components/app/icons";
import { Button, Switch } from "@/components/app/ui";
import {
  AgentAvatar,
  type AgentVisualState
} from "@/features/avatar/agent-avatar";

const expandedPanelWidth = 286;
const collapsedPanelWidth = 0;

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
    <div className="flex h-screen overflow-hidden bg-[#f6f6f4] text-foreground">
      <DesktopAssistantNav
        connected={connected}
        isStreaming={isStreaming}
        messageCount={messageCount}
        panelOpen={panelOpen}
        serverCount={serverCount}
        showDebug={showDebug}
        statusLabel={statusLabel}
        toolCount={toolCount}
        integrationControls={integrationControls}
        onNewChat={onNewChat}
        onPanelOpenChange={setPanelOpen}
        onShowDebugChange={onShowDebugChange}
      />
      <main className="flex min-w-0 flex-1 flex-col bg-background">
        <ChatTopbar
          isStreaming={isStreaming}
          messageCount={messageCount}
          onNewChat={onNewChat}
          statusLabel={statusLabel}
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
      </main>
    </div>
  );
}

function DesktopAssistantNav({
  connected,
  isStreaming,
  messageCount,
  panelOpen,
  serverCount,
  showDebug,
  statusLabel,
  toolCount,
  integrationControls,
  onNewChat,
  onPanelOpenChange,
  onShowDebugChange
}: {
  connected: boolean;
  isStreaming: boolean;
  messageCount: number;
  panelOpen: boolean;
  serverCount: number;
  showDebug: boolean;
  statusLabel: string;
  toolCount: number;
  integrationControls: ReactNode;
  onNewChat: () => void;
  onPanelOpenChange: (open: boolean) => void;
  onShowDebugChange: (checked: boolean) => void;
}) {
  const panelWidth = getPanelWidth(panelOpen);
  const avatarState = getAvatarState(connected);

  return (
    <div className="hidden h-full shrink-0 md:flex">
      <motion.aside
        aria-hidden={!panelOpen}
        className="h-full overflow-hidden border-r border-border/80 bg-[#f2f2ef]"
        animate={{ width: panelWidth }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex h-full w-[17.875rem] flex-col p-3">
          <div className="mb-4 flex h-9 items-center justify-between px-1">
            <div className="flex min-w-0 items-center gap-2">
              <AgentAvatar state={avatarState} size="sm" />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-neutral-900">
                  Teampitch
                </div>
                <div className="text-xs text-muted-foreground">
                  {statusLabel}
                </div>
              </div>
            </div>
            <button
              type="button"
              aria-label="Collapse assistant panel"
              className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground"
              onClick={() => onPanelOpenChange(false)}
            >
              <PanelLeftClose size={16} />
            </button>
          </div>

          <div className="space-y-5 overflow-y-auto pr-1">
            <NavSection title="Chat">
              <PanelAction
                icon={<PlusIcon size={16} />}
                label="New chat"
                onClick={onNewChat}
              />
              <PanelMetric
                icon={<ChatCircleDotsIcon size={16} />}
                label="Current conversation"
                value={formatMessageCount(messageCount)}
              />
            </NavSection>

            <NavSection title="Runtime">
              <PanelMetric
                label="Connection"
                value={getConnectionLabel(connected)}
                dotClassName={getConnectionDotClass(connected)}
              />
              <PanelMetric
                label="Agent"
                value={getAgentLabel(isStreaming)}
                dotClassName={getAgentDotClass(isStreaming)}
              />
            </NavSection>

            <NavSection title="Tools">
              <PanelMetric
                icon={<WrenchIcon size={16} />}
                label="MCP tools"
                value={`${toolCount}`}
              />
              <PanelMetric label="MCP servers" value={`${serverCount}`} />
              <div className="pt-1">{integrationControls}</div>
            </NavSection>

            <NavSection title="Debug">
              <div className="flex h-8 items-center justify-between rounded-md px-2 text-sm text-neutral-700">
                <span>Memory debugger</span>
                <Switch
                  checked={showDebug}
                  onCheckedChange={onShowDebugChange}
                  size="sm"
                  aria-label="Toggle debug mode"
                />
              </div>
            </NavSection>
          </div>
        </div>
      </motion.aside>

      <BoundaryRail
        connected={connected}
        panelOpen={panelOpen}
        showDebug={showDebug}
        onNewChat={onNewChat}
        onPanelOpenChange={onPanelOpenChange}
        onShowDebugChange={onShowDebugChange}
      />
    </div>
  );
}

function BoundaryRail({
  connected,
  panelOpen,
  showDebug,
  onNewChat,
  onPanelOpenChange,
  onShowDebugChange
}: {
  connected: boolean;
  panelOpen: boolean;
  showDebug: boolean;
  onNewChat: () => void;
  onPanelOpenChange: (open: boolean) => void;
  onShowDebugChange: (checked: boolean) => void;
}) {
  const toggleLabel = getPanelToggleLabel(panelOpen);
  const toggleIcon = getPanelToggleIcon(panelOpen);
  const connectionDotClass = getConnectionDotClass(connected);

  return (
    <aside className="flex h-full w-[4.25rem] shrink-0 flex-col items-center border-r border-black/20 bg-[#10100f] py-4 text-white shadow-[8px_0_30px_rgba(0,0,0,0.08)]">
      <button
        type="button"
        aria-label={toggleLabel}
        className="grid size-10 place-items-center rounded-xl border border-white/10 bg-white text-sm font-semibold text-[#10100f] shadow-sm transition-transform active:scale-95"
        onClick={() => onPanelOpenChange(!panelOpen)}
      >
        {toggleIcon}
      </button>

      <nav className="mt-9 flex flex-1 flex-col items-center gap-2">
        <RailButton
          active
          label="Current chat"
          icon={<ChatCircleDotsIcon size={18} />}
          onClick={() => onPanelOpenChange(true)}
        />
        <RailButton
          label="New chat"
          icon={<PlusIcon size={18} />}
          onClick={onNewChat}
        />
        <RailButton
          active={showDebug}
          label="Memory debugger"
          icon={<WrenchIcon size={18} />}
          onClick={() => onShowDebugChange(!showDebug)}
        />
      </nav>

      <div
        className={cn("mb-3 size-2 rounded-full", connectionDotClass)}
        title={connected ? "Connected" : "Disconnected"}
      />
    </aside>
  );
}

function getStatusLabel(isStreaming: boolean, connected: boolean) {
  if (isStreaming) return "Responding";
  return connected ? "Ready" : "Offline";
}

function getPanelWidth(panelOpen: boolean) {
  return panelOpen ? expandedPanelWidth : collapsedPanelWidth;
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

function getPanelToggleIcon(panelOpen: boolean) {
  return panelOpen ? <PanelLeftClose size={18} /> : <PanelRight size={18} />;
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
        "grid size-9 place-items-center rounded-lg text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white",
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

function PanelMetric({
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
    <div className="flex h-8 items-center gap-2 rounded-md px-2 text-sm text-neutral-700">
      <span className="grid size-4 shrink-0 place-items-center text-neutral-500">
        {icon ??
          (dotClassName && (
            <span className={cn("size-2 rounded-full", dotClassName)} />
          ))}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="text-xs text-muted-foreground">{value}</span>
    </div>
  );
}

function ChatTopbar({
  isStreaming,
  messageCount,
  statusLabel,
  themeToggle,
  onNewChat
}: {
  isStreaming: boolean;
  messageCount: number;
  statusLabel: string;
  themeToggle: ReactNode;
  onNewChat: () => void;
}) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border/70 px-4 sm:px-5">
      <div className="flex min-w-0 items-center gap-2">
        <ChatCircleDotsIcon size={18} className="shrink-0 text-neutral-700" />
        <div className="min-w-0">
          <h1 className="truncate text-sm font-medium text-neutral-900">
            {messageCount > 0 ? "Current chat" : "New chat"}
          </h1>
          <div className="hidden text-xs text-muted-foreground sm:block">
            {statusLabel}
          </div>
        </div>
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
