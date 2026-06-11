import { useState, type ReactNode } from "react";

import { CaretDownIcon, WrenchIcon } from "@/components/app/icons";
import { Button, Surface } from "@/components/app/ui";
import { AgentSettingsPanel } from "@/features/agent-identity/agent-settings-panel";
import type { AuthSession } from "@/features/auth/auth-context";
import { ThemeToggle } from "@/features/theme/theme-toggle";
import {
  glassNavigationSurfaceClassName,
  solidSurfaceClassName
} from "@teampitch/ui/lib/surface-tokens";
import { cn } from "@teampitch/ui/lib/utils";

type SettingsView = "security-access" | "create-agent-key";

const viewCopy: Record<SettingsView, { title: string; description: string }> = {
  "security-access": {
    title: "Security & access",
    description: "Review sessions, agent keys, and account access boundaries."
  },
  "create-agent-key": {
    title: "Create agent key",
    description:
      "Create a sponsor-bound agent identity. Agent actions stay attributed to both the sponsor and the agent."
  }
};

export function SettingsRoute({
  auth,
  onNavigateChat,
  onSignOut
}: {
  auth: AuthSession;
  onNavigateChat: () => void;
  onSignOut: () => void;
}) {
  const [activeView, setActiveView] = useState<SettingsView>("security-access");
  const activeCopy = viewCopy[activeView];
  const showingCreateAgentKey = activeView === "create-agent-key";

  return (
    <main className="h-screen overflow-hidden bg-[#f2f2ef] p-[3px] text-foreground">
      <div className="flex h-full min-h-0 overflow-hidden">
        <SettingsSidebar
          auth={auth}
          onNavigateChat={onNavigateChat}
          onNavigateSecurity={() => setActiveView("security-access")}
          onSignOut={onSignOut}
        />

        <section className="min-w-0 flex-1 overflow-y-auto bg-transparent">
          <div className="mx-auto w-full max-w-[var(--settings-panel-max-width)] px-[var(--settings-panel-padding-inline)] py-[var(--settings-panel-padding-block)] lg:px-[var(--settings-panel-padding-inline-lg)] lg:py-[var(--settings-panel-padding-block-lg)]">
            {showingCreateAgentKey && (
              <button
                type="button"
                className="mb-8 flex h-8 items-center gap-2 rounded-md text-sm font-medium text-neutral-600 transition-[color,scale] hover:text-neutral-950 active:scale-[0.98]"
                onClick={() => setActiveView("security-access")}
              >
                <CaretDownIcon size={15} className="rotate-90" />
                <span>Security settings</span>
              </button>
            )}
            <SettingsSectionHeader title={activeCopy.title} description={activeCopy.description} />

            {showingCreateAgentKey ? (
              <AgentSettingsPanel
                auth={auth}
                embedded
                mode="create"
                onCancelCreate={() => setActiveView("security-access")}
                onCreated={() => setActiveView("security-access")}
              />
            ) : (
              <SecurityAccessSettingsPanel
                auth={auth}
                onCreateAgentKey={() => setActiveView("create-agent-key")}
                onSignOut={onSignOut}
              />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function SettingsSidebar({
  auth,
  onNavigateChat,
  onNavigateSecurity,
  onSignOut
}: {
  auth: AuthSession;
  onNavigateChat: () => void;
  onNavigateSecurity: () => void;
  onSignOut: () => void;
}) {
  return (
    <aside
      data-navigation-shell="settings"
      className="relative z-30 hidden h-full w-[19rem] shrink-0 text-white md:flex"
    >
      <span
        aria-hidden
        className={cn(
          "app-navigation-shell-transition pointer-events-none absolute inset-0",
          glassNavigationSurfaceClassName
        )}
      />
      <div
        data-navigation-content="settings"
        className="app-navigation-content-transition relative z-10 flex h-full w-full flex-col p-3"
      >
        <button
          type="button"
          className="mb-5 flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm font-medium text-white/70 transition-[background-color,color,scale] hover:bg-white/[0.08] hover:text-white active:scale-[0.98]"
          onClick={onNavigateChat}
        >
          <CaretDownIcon size={16} className="rotate-90" />
          <span className="min-w-0 truncate">Back</span>
        </button>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
          <SettingsNavSection title="Account">
            <SettingsNavItem
              active
              icon={<WrenchIcon size={16} />}
              label="Security & access"
              onClick={onNavigateSecurity}
            />
          </SettingsNavSection>
        </div>

        <SettingsUserMenu auth={auth} onSignOut={onSignOut} />
      </div>
    </aside>
  );
}

function SettingsSectionHeader({ description, title }: { description: string; title: string }) {
  return (
    <header className="mb-5">
      <h1 className="text-[1.375rem] leading-7 font-semibold text-neutral-950">{title}</h1>
      <p className="mt-1.5 max-w-2xl text-[13px] leading-5 text-neutral-500">{description}</p>
    </header>
  );
}

function SecurityAccessSettingsPanel({
  auth,
  onCreateAgentKey,
  onSignOut
}: {
  auth: AuthSession;
  onCreateAgentKey: () => void;
  onSignOut: () => void;
}) {
  const accountLabel = getAccountLabel(auth);
  const accountDetail = getAccountDetail(auth);
  const signInMethod = getSignInMethodLabel(auth);

  return (
    <div className="space-y-12">
      <SettingsOverviewSection
        title="Current session"
        description="This browser session is active for the current account."
      >
        <SettingsActionRow
          title="Current browser session"
          description={`Signed in as ${accountLabel}. Sign out ends this browser session.`}
          detail="Active"
          action={
            <Button variant="outline" size="sm" onClick={onSignOut}>
              Sign out
            </Button>
          }
        />
      </SettingsOverviewSection>

      <SettingsOverviewSection
        title="Workspace access"
        description="How this account is authenticated and scoped in the workspace."
      >
        <SettingsActionRow
          title="Sign-in method"
          description="Access is managed by the workspace sign-in flow configured for this environment."
          detail={signInMethod}
        />
        <SettingsActionRow
          title="Role"
          description={`${accountLabel} is currently using ${formatWorkspaceRole(accountDetail)} in this workspace.`}
          detail={accountDetail}
        />
      </SettingsOverviewSection>

      <AgentSettingsPanel auth={auth} embedded mode="summary" onCreateRequest={onCreateAgentKey} />
    </div>
  );
}

function SettingsOverviewSection({
  children,
  description,
  title
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section>
      <div className="mb-4">
        <h2 className="text-xl leading-7 font-semibold text-neutral-950">{title}</h2>
        <p className="mt-1 text-sm leading-5 text-neutral-500">{description}</p>
      </div>
      <Surface className="p-0">{children}</Surface>
    </section>
  );
}

function SettingsActionRow({
  action,
  description,
  detail,
  title
}: {
  action?: ReactNode;
  description: string;
  detail?: ReactNode;
  title: string;
}) {
  return (
    <div className="flex min-h-[72px] flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-5">
      <div className="min-w-0">
        <h3 className="text-[13px] leading-5 font-semibold text-neutral-950">{title}</h3>
        <p className="mt-1 max-w-xl text-[13px] leading-5 text-neutral-500">{description}</p>
      </div>
      {(detail || action) && (
        <div className="flex shrink-0 items-center gap-3 self-start sm:self-center">
          {detail && <span className="text-[13px] font-medium text-neutral-600">{detail}</span>}
          {action}
        </div>
      )}
    </div>
  );
}

function SettingsUserMenu({ auth, onSignOut }: { auth: AuthSession; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const label = getAccountLabel(auth);
  const detail = getAccountDetail(auth);
  const initials = getAccountInitials(label);

  return (
    <div className="relative mt-4 border-t border-white/10 pt-3">
      <button
        type="button"
        aria-controls="settings-user-menu"
        aria-expanded={open}
        aria-label="Toggle user menu"
        className="flex h-11 w-full items-center gap-3 rounded-lg px-2 text-left transition-[background-color,scale] hover:bg-white/[0.08] active:scale-[0.98]"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/[0.12] text-[11px] font-semibold text-white">
          {initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-white">{label}</span>
          <span className="block truncate text-xs text-white/45">{detail}</span>
        </span>
      </button>

      <div
        id="settings-user-menu"
        aria-hidden={!open}
        className={cn(
          "absolute bottom-0 left-[calc(100%+0.5rem)] z-50 w-72 p-3 text-neutral-950 transition-[opacity,transform] duration-150",
          solidSurfaceClassName,
          open
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-1 opacity-0"
        )}
      >
        <div className="flex items-center gap-2">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-neutral-950 text-xs font-semibold text-white">
            {initials}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{label}</span>
            <span className="block truncate text-xs text-muted-foreground">{detail}</span>
          </span>
        </div>

        <div className="mt-3 space-y-2 border-t border-border/70 pt-3">
          <div className="flex min-h-9 items-center justify-between gap-3 rounded-lg px-2 text-sm">
            <span className="text-muted-foreground">Theme</span>
            <div className="[&>button]:size-8">
              <ThemeToggle />
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9 w-full justify-center"
            onClick={onSignOut}
          >
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}

function SettingsNavSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 px-2 text-xs font-medium text-white/45">{title}</h3>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function SettingsNavItem({
  active,
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
      className={cn(
        "flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition-[background-color,color,scale] active:scale-[0.98]",
        active
          ? "bg-white/[0.12] text-white"
          : "text-white/60 hover:bg-white/[0.08] hover:text-white"
      )}
      onClick={onClick}
    >
      <span className="grid size-4 place-items-center">{icon}</span>
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

function getAccountLabel(auth: AuthSession): string {
  return (
    [auth.user?.name, auth.user?.email, auth.identity?.displayName, auth.identity?.subjectId].find(
      isNonEmptyString
    ) ?? "Signed in"
  );
}

function getAccountDetail(auth: AuthSession): string {
  return auth.identity?.role ?? "Workspace member";
}

function getSignInMethodLabel(auth: AuthSession): string {
  if (auth.provider === "workos") return "Workspace SSO";
  if (auth.provider === "local") return "Local development";
  if (auth.provider === "anonymous") return "Anonymous fallback";
  if (auth.provider === "authkit") return "AuthKit";
  return titleizeProvider(auth.provider);
}

function getAccountInitials(label: string): string {
  const words = label
    .replace(/@.*$/, "")
    .split(/\s+|[._-]/)
    .filter(Boolean);

  const initials = words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");

  return initials || "TP";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function titleizeProvider(provider: string): string {
  return provider
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function formatWorkspaceRole(role: string): string {
  const normalizedRole = role.trim().toLowerCase();
  if (!normalizedRole) return "workspace access";
  if (normalizedRole.includes("access") || normalizedRole.includes("member")) return normalizedRole;
  return `${normalizedRole} access`;
}
