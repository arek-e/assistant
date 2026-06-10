import type { ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@teampitch/ui/lib/utils";
import {
  BriefcaseIcon,
  CalendarIcon,
  ChatCircleDotsIcon,
  ChatSearch,
  CheckListIcon,
  ClockIcon,
  ContactIcon,
  HomeIcon,
  LinkIcon,
  MoreHorizontalIcon,
  NoteIcon,
  PanelLeftClose,
  PanelRight,
  PlusIcon,
  SearchIcon,
  WrenchIcon
} from "@/components/app/icons";
import { Badge, Button, Switch } from "@/components/app/ui";
import { AgentAvatar } from "@/features/avatar/agent-avatar";

const workspaces = [
  { label: "All work", count: "12", active: true },
  { label: "In progress", count: "4" },
  { label: "Waiting", count: "3" },
  { label: "Archived", count: "0" }
];

const resources = [
  { label: "Tasks", icon: <CheckListIcon size={16} />, count: "5" },
  { label: "Meetings", icon: <CalendarIcon size={16} />, count: "2" },
  { label: "Notes", icon: <NoteIcon size={16} />, count: "8" },
  { label: "Integrations", icon: <WrenchIcon size={16} />, count: "3" }
];

const recentChats = [
  { label: "Summarize my active opportunities", active: true },
  { label: "Draft notes from design review" },
  { label: "Schedule follow-up with Alex" }
];

export function AssistantAppShell({
  children,
  composer,
  connected,
  isStreaming,
  showDebug,
  toolCount,
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
  integrationControls: ReactNode;
  themeToggle: ReactNode;
  onShowDebugChange: (checked: boolean) => void;
  onNewChat: () => void;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f5f3] text-foreground">
      <PrimaryRail connected={connected} />
      <SecondaryNav onNewChat={onNewChat} />
      <main className="flex min-w-0 flex-1 flex-col border-x border-border/70 bg-background">
        <ChatTopbar
          isStreaming={isStreaming}
          onNewChat={onNewChat}
          themeToggle={themeToggle}
        />
        <motion.div
          className="min-h-0 flex-1 overflow-y-auto"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="mx-auto w-full max-w-3xl px-5 pb-10 pt-10 sm:px-8 lg:pt-16">
            {children}
          </div>
        </motion.div>
        <div className="shrink-0 bg-gradient-to-t from-background via-background to-background/0 px-4 pb-5 pt-3 sm:px-8">
          {composer}
        </div>
      </main>
      <ContextPanel
        connected={connected}
        showDebug={showDebug}
        toolCount={toolCount}
        integrationControls={integrationControls}
        onShowDebugChange={onShowDebugChange}
      />
    </div>
  );
}

function PrimaryRail({ connected }: { connected: boolean }) {
  const railItems = [
    { label: "Home", icon: <HomeIcon size={18} /> },
    { label: "Chats", icon: <ChatCircleDotsIcon size={18} />, active: true },
    { label: "Meetings", icon: <CalendarIcon size={18} /> },
    { label: "Notes", icon: <NoteIcon size={18} /> },
    { label: "Integrations", icon: <WrenchIcon size={18} /> }
  ];

  return (
    <aside className="hidden h-full w-[4.25rem] shrink-0 flex-col items-center bg-[#0f0f0e] py-4 text-white md:flex">
      <div className="grid size-10 place-items-center rounded-xl border border-white/10 bg-white text-sm font-semibold text-[#0f0f0e] shadow-sm">
        TP
      </div>
      <nav className="mt-9 flex flex-1 flex-col items-center gap-2">
        {railItems.map((item) => (
          <button
            key={item.label}
            type="button"
            aria-label={item.label}
            title={item.label}
            className={cn(
              "grid size-9 place-items-center rounded-lg text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white",
              item.active && "bg-white/[0.13] text-white"
            )}
          >
            {item.icon}
          </button>
        ))}
      </nav>
      <div
        className={cn(
          "mb-3 size-2 rounded-full",
          connected ? "bg-success" : "bg-destructive"
        )}
        title={connected ? "Connected" : "Disconnected"}
      />
      <button
        type="button"
        aria-label="Help"
        className="grid size-8 place-items-center rounded-full border border-white/10 text-xs text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"
      >
        ?
      </button>
    </aside>
  );
}

function SecondaryNav({ onNewChat }: { onNewChat: () => void }) {
  return (
    <aside className="hidden h-full w-[17.5rem] shrink-0 flex-col border-r border-border/80 bg-[#f3f3f1] p-3 lg:flex">
      <div className="mb-3 flex h-8 items-center justify-between px-1">
        <div className="flex min-w-0 items-center gap-2">
          <div className="grid size-6 place-items-center rounded-full bg-neutral-300 text-[0.68rem] font-medium text-neutral-700">
            AT
          </div>
          <span className="truncate text-sm font-medium text-neutral-800">
            Assistant
          </span>
        </div>
        <button
          type="button"
          aria-label="Collapse sidebar"
          className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground"
        >
          <PanelLeftClose size={16} />
        </button>
      </div>
      <label className="mb-3 flex h-10 items-center gap-2 rounded-lg border border-border/80 bg-background px-3 text-sm text-muted-foreground shadow-[0_1px_0_rgba(0,0,0,0.03)]">
        <SearchIcon size={16} />
        <input
          aria-label="Search workspace"
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          placeholder="Search"
          type="search"
        />
      </label>
      <div className="space-y-5 overflow-y-auto pr-1">
        <NavSection title="Workspace">
          {workspaces.map((item) => (
            <SidebarRow
              key={item.label}
              label={item.label}
              count={item.count}
              icon={<BriefcaseIcon size={16} />}
              active={item.active}
            />
          ))}
        </NavSection>
        <NavSection title="Resources">
          {resources.map((item) => (
            <SidebarRow
              key={item.label}
              label={item.label}
              count={item.count}
              icon={item.icon}
            />
          ))}
        </NavSection>
        <NavSection title="Chats">
          <button
            type="button"
            onClick={onNewChat}
            className="mb-1 flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-neutral-700 transition-colors hover:bg-black/5"
          >
            <PlusIcon size={16} />
            New chat
          </button>
          {recentChats.map((item) => (
            <SidebarRow
              key={item.label}
              label={item.label}
              icon={<ChatSearch size={16} />}
              active={item.active}
            />
          ))}
        </NavSection>
      </div>
    </aside>
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

function SidebarRow({
  label,
  icon,
  count,
  active = false
}: {
  label: string;
  icon: ReactNode;
  count?: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-neutral-700 transition-colors hover:bg-black/5",
        active && "bg-black/[0.07] text-neutral-950"
      )}
    >
      <span className="shrink-0 text-neutral-500">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count && <span className="text-xs text-muted-foreground">{count}</span>}
    </button>
  );
}

function ChatTopbar({
  isStreaming,
  themeToggle,
  onNewChat
}: {
  isStreaming: boolean;
  themeToggle: ReactNode;
  onNewChat: () => void;
}) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border/70 px-4 sm:px-5">
      <div className="flex min-w-0 items-center gap-2">
        <ChatCircleDotsIcon size={18} className="shrink-0 text-neutral-700" />
        <h1 className="truncate text-sm font-medium text-neutral-900">
          Summarize my active work
        </h1>
        <button
          type="button"
          aria-label="More chat actions"
          className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground"
        >
          <MoreHorizontalIcon size={16} />
        </button>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          aria-label="Copy chat link"
          className="hidden size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground sm:grid"
        >
          <LinkIcon size={16} />
        </button>
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

function ContextPanel({
  connected,
  showDebug,
  toolCount,
  integrationControls,
  onShowDebugChange
}: {
  connected: boolean;
  showDebug: boolean;
  toolCount: number;
  integrationControls: ReactNode;
  onShowDebugChange: (checked: boolean) => void;
}) {
  return (
    <aside className="hidden h-full w-[22rem] shrink-0 flex-col bg-background xl:flex">
      <div className="flex h-12 items-center justify-between border-b border-border/70 px-5">
        <h2 className="text-sm font-medium text-neutral-900">
          Assistant details
        </h2>
        <button
          type="button"
          aria-label="Toggle details"
          className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground"
        >
          <PanelRight size={16} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <section className="border-b border-border/70 p-5">
          <div className="flex items-center gap-3">
            <AgentAvatar state={connected ? "idle" : "error"} size="sm" />
            <div className="min-w-0">
              <div className="text-sm font-medium text-neutral-900">
                Teampitch assistant
              </div>
              <div className="text-xs text-muted-foreground">
                {connected ? "Connected" : "Disconnected"}
              </div>
            </div>
          </div>
          <dl className="mt-5 space-y-3 text-sm">
            <DetailRow
              icon={<ClockIcon size={16} />}
              label="Next check-in"
              value="Today, 11:30"
            />
            <DetailRow
              icon={<CalendarIcon size={16} />}
              label="Schedule"
              value="2 meetings"
            />
            <DetailRow
              icon={<NoteIcon size={16} />}
              label="Notes"
              value="8 saved"
            />
            <DetailRow
              icon={<WrenchIcon size={16} />}
              label="Tools"
              value={`${toolCount} available`}
            />
          </dl>
        </section>
        <section className="border-b border-border/70 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium text-neutral-900">
              Integrations
            </h3>
            {toolCount > 0 && <Badge variant="secondary">{toolCount}</Badge>}
          </div>
          <div className="space-y-2 text-sm">
            <IntegrationRow label="Calendar" status="Ready" />
            <IntegrationRow label="Transcriptions" status="Idle" />
            <IntegrationRow label="Memory" status="Ready" />
          </div>
          <div className="mt-4">{integrationControls}</div>
        </section>
        <section className="border-b border-border/70 p-5">
          <h3 className="mb-4 text-sm font-medium text-neutral-900">
            Controls
          </h3>
          <div className="flex items-center justify-between gap-3 text-sm text-neutral-700">
            <span>Memory debugger</span>
            <Switch
              checked={showDebug}
              onCheckedChange={onShowDebugChange}
              size="sm"
              aria-label="Toggle debug mode"
            />
          </div>
        </section>
        <section className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium text-neutral-900">Today</h3>
            <span className="text-xs text-muted-foreground">See all</span>
          </div>
          <div className="space-y-3">
            <ContextNote
              icon={<CalendarIcon size={16} />}
              title="Design review"
              meta="10:00 - 10:45"
            />
            <ContextNote
              icon={<ContactIcon size={16} />}
              title="Follow up with Alex"
              meta="Waiting on notes"
            />
          </div>
        </section>
      </div>
    </aside>
  );
}

function DetailRow({
  icon,
  label,
  value
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[1rem_7rem_minmax(0,1fr)] items-center gap-2">
      <dt className="text-muted-foreground">{icon}</dt>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate text-neutral-900">{value}</dd>
    </div>
  );
}

function IntegrationRow({ label, status }: { label: string; status: string }) {
  return (
    <div className="flex h-8 items-center justify-between rounded-md bg-black/[0.03] px-2.5">
      <span className="text-neutral-800">{label}</span>
      <span className="text-xs text-muted-foreground">{status}</span>
    </div>
  );
}

function ContextNote({
  icon,
  title,
  meta
}: {
  icon: ReactNode;
  title: string;
  meta: string;
}) {
  return (
    <div className="flex gap-3 text-sm">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div className="min-w-0">
        <div className="truncate text-neutral-900">{title}</div>
        <div className="truncate text-xs text-muted-foreground">{meta}</div>
      </div>
    </div>
  );
}
