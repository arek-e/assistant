import { useCallback, useEffect, useMemo, useState } from "react";

import { WrenchIcon } from "@/components/app/icons";
import {
  Badge,
  Button,
  Calendar,
  Checkbox,
  Input,
  Label,
  Radio,
  RadioGroup,
  Surface,
  Text
} from "@/components/app/ui";
import type { AuthSession } from "@/features/auth/auth-context";
import type { AgentCapability, AgentIdentity } from "@/server/agent-identity/types";

const capabilities = [
  "memory:read",
  "memory:write",
  "memory:lifecycle",
  "routing:write",
  "tools:schedule"
] as const satisfies readonly AgentCapability[];

type AgentSettingsPanelMode = "summary" | "create";

export function AgentSettingsPanel({
  auth,
  embedded = false,
  mode = "summary",
  onCancelCreate,
  onClose,
  onCreateRequest,
  onCreated
}: {
  auth: AuthSession;
  embedded?: boolean;
  mode?: AgentSettingsPanelMode;
  onCancelCreate?: () => void;
  onClose?: () => void;
  onCreateRequest?: () => void;
  onCreated?: () => void;
}) {
  const [agents, setAgents] = useState<AgentIdentity[]>([]);
  const [name, setName] = useState("Codex");
  const [expiresAt, setExpiresAt] = useState(() => futureIsoDate(30));
  const [selectedCapabilities, setSelectedCapabilities] = useState<AgentCapability[]>([
    "memory:read",
    "memory:write"
  ]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const admin = isAdminSession(auth);
  const expiresAtDate = useMemo(() => new Date(expiresAt), [expiresAt]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAgents(await requestJson<AgentIdentity[]>("/api/agent-identities"));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createAgent = useCallback(async () => {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await requestJson("/api/agent-identities", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          allowedCapabilities: selectedCapabilities,
          expiresAt
        })
      });
      await refresh();
      setName("Codex");
      setExpiresAt(futureIsoDate(30));
      onCreated?.();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }, [expiresAt, name, onCreated, refresh, selectedCapabilities]);

  const revokeAgent = useCallback(
    async (agent: AgentIdentity) => {
      setBusy(true);
      setError(null);
      try {
        await requestJson(`/api/agent-identities/${agent.id}/revoke`, {
          method: "POST",
          body: JSON.stringify({ reason: "sponsor revoked from settings" })
        });
        await refresh();
      } catch (caught) {
        setError(errorMessage(caught));
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );

  const renewAgent = useCallback(
    async (agent: AgentIdentity) => {
      setBusy(true);
      setError(null);
      try {
        await requestJson(`/api/agent-identities/${agent.id}/renew`, {
          method: "POST",
          body: JSON.stringify({ expiresAt: futureIsoDate(30) })
        });
        await refresh();
      } catch (caught) {
        setError(errorMessage(caught));
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );

  const disableAgent = useCallback(
    async (agent: AgentIdentity) => {
      setBusy(true);
      setError(null);
      try {
        await requestJson(`/api/agent-identities/${agent.id}/disable`, {
          method: "POST",
          body: JSON.stringify({ reason: "admin disabled from settings" })
        });
        await refresh();
      } catch (caught) {
        setError(errorMessage(caught));
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );

  const rootClassName = embedded
    ? "space-y-0"
    : "absolute top-full right-0 z-40 mt-2 w-[520px] p-4";

  const content = (
    <>
      {!embedded && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="space-y-1">
            <Text className="block" bold>
              Agent identities
            </Text>
            <Text size="xs" variant="secondary">
              Sponsor-bound agents with scoped access and lifecycle controls.
            </Text>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-background/70 p-3">
          <Text size="xs" variant="secondary">
            {error}
          </Text>
        </div>
      )}

      {mode === "create" ? (
        <AgentCreateForm
          busy={busy}
          expiresAt={expiresAtDate}
          name={name}
          selectedCapabilities={selectedCapabilities}
          onCancel={onCancelCreate}
          onCreate={createAgent}
          onExpiresAtChange={(date) => setExpiresAt(endOfDayIsoDate(date))}
          onNameChange={setName}
          onSelectedCapabilitiesChange={setSelectedCapabilities}
        />
      ) : (
        <AgentKeySummary
          agents={agents}
          busy={busy}
          loading={loading}
          showAdminActions={admin}
          onCreateRequest={onCreateRequest}
          onDisable={disableAgent}
          onRenew={renewAgent}
          onRevoke={revokeAgent}
        />
      )}
    </>
  );

  if (embedded) {
    return <div className={rootClassName}>{content}</div>;
  }

  return (
    <Surface variant="solid" className={rootClassName}>
      {content}
    </Surface>
  );
}

function AgentCreateForm({
  busy,
  expiresAt,
  name,
  selectedCapabilities,
  onCancel,
  onCreate,
  onExpiresAtChange,
  onNameChange,
  onSelectedCapabilitiesChange
}: {
  busy: boolean;
  expiresAt: Date;
  name: string;
  selectedCapabilities: AgentCapability[];
  onCancel?: () => void;
  onCreate: () => void;
  onExpiresAtChange: (date: Date) => void;
  onNameChange: (name: string) => void;
  onSelectedCapabilitiesChange: (capabilities: AgentCapability[]) => void;
}) {
  const minimumExpiryDate = startOfNextDay();

  return (
    <section className="mx-auto max-w-[52rem] p-5">
      <Surface className="p-5">
        <div className="grid gap-8">
          <Label className="grid gap-2">
            <span className="text-[13px] leading-5 font-semibold text-neutral-950">Key name</span>
            <Input
              aria-label="Agent key name"
              placeholder="A descriptive name for this agent key..."
              size="lg"
              value={name}
              onValueChange={onNameChange}
            />
          </Label>

          <CapabilityPermissionPicker
            selected={selectedCapabilities}
            onChange={onSelectedCapabilitiesChange}
          />

          <div className="grid gap-3">
            <div>
              <h2 className="text-[13px] leading-5 font-semibold text-neutral-950">Scope access</h2>
              <p className="mt-1 text-[13px] leading-5 text-neutral-500">
                Agent scopes are inherited from the sponsor and cannot exceed their access.
              </p>
            </div>
            <div className="rounded-md border border-black/[0.08] bg-white/40 px-3 py-2 text-sm text-neutral-950">
              All sponsor scopes available to this key
            </div>
          </div>

          <Label className="grid max-w-40 gap-2">
            <span className="text-[13px] leading-5 font-semibold text-neutral-950">Expires on</span>
            <span className="text-[13px] leading-5 font-normal text-neutral-500">
              {formatDate(expiresAt)}
            </span>
          </Label>
          <Calendar
            mode="single"
            selected={expiresAt}
            disabled={{ before: minimumExpiryDate }}
            onSelect={(date) => {
              if (date) onExpiresAtChange(date);
            }}
          />
        </div>

        <div className="mt-10 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" disabled={busy || !name.trim()} onClick={onCreate}>
            Create
          </Button>
        </div>
      </Surface>
    </section>
  );
}

function CapabilityPermissionPicker({
  selected,
  onChange
}: {
  selected: AgentCapability[];
  onChange: (capabilities: AgentCapability[]) => void;
}) {
  const fullAccess = selected.length === capabilities.length;

  return (
    <div className="grid gap-3">
      <div>
        <h2 className="text-[13px] leading-5 font-semibold text-neutral-950">Permissions</h2>
        <p className="mt-1 text-[13px] leading-5 text-neutral-500">
          Only enable the minimum capabilities required for this agent.
        </p>
      </div>
      <RadioGroup
        value={fullAccess ? "full" : "selected"}
        onValueChange={(value) =>
          onChange(value === "full" ? [...capabilities] : ["memory:read", "memory:write"])
        }
      >
        <Label className="flex items-center gap-3 text-sm font-normal text-neutral-950">
          <Radio value="full" />
          <span>Full agent capabilities</span>
        </Label>
        <Label className="flex items-center gap-3 text-sm font-normal text-neutral-950">
          <Radio value="selected" />
          <span>Only selected capabilities...</span>
        </Label>
      </RadioGroup>
      <div className="ml-7 grid gap-2">
        {capabilities.map((capability) => (
          <div
            key={capability}
            className="grid grid-cols-[10rem_minmax(0,1fr)] items-center gap-4 text-sm font-normal"
          >
            <Label className="flex items-center gap-3 text-sm font-normal text-neutral-950">
              <Checkbox
                checked={selected.includes(capability)}
                onCheckedChange={() => onChange(toggleCapability(selected, capability))}
              />
              <span>{capabilityLabel(capability)}</span>
            </Label>
            <span className="text-neutral-500">{capabilityDescription(capability)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgentKeySummary({
  agents,
  busy,
  loading,
  showAdminActions,
  onCreateRequest,
  onDisable,
  onRenew,
  onRevoke
}: {
  agents: AgentIdentity[];
  busy: boolean;
  loading: boolean;
  showAdminActions: boolean;
  onCreateRequest?: () => void;
  onDisable: (agent: AgentIdentity) => void;
  onRenew: (agent: AgentIdentity) => void;
  onRevoke: (agent: AgentIdentity) => void;
}) {
  return (
    <section>
      <div className="mb-4">
        <h2 className="text-xl leading-7 font-semibold text-neutral-950">
          {loading ? "Loading agent keys" : "Agent keys"}
        </h2>
        <p className="mt-1 text-sm leading-5 text-neutral-500">
          Sponsor-bound keys for agent OAuth access.
        </p>
      </div>
      <div className="space-y-3">
        <Surface className="flex min-h-[72px] items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-neutral-950">
              {agents.length
                ? `${agents.length} sponsor-bound ${agents.length === 1 ? "key" : "keys"}`
                : "No agent keys created"}
            </p>
            <p className="mt-1 text-[13px] leading-5 text-neutral-500">
              Keys identify agents during OAuth authorization and can be renewed or revoked.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onCreateRequest}>
            New agent key
          </Button>
        </Surface>

        {agents.length > 0 && (
          <div className="space-y-3">
            {agents.map((agent) => (
              <AgentRow
                key={agent.id}
                agent={agent}
                busy={busy}
                showAdminActions={showAdminActions}
                onDisable={onDisable}
                onRenew={onRenew}
                onRevoke={onRevoke}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function AgentRow({
  agent,
  busy,
  showAdminActions,
  onDisable,
  onRenew,
  onRevoke
}: {
  agent: AgentIdentity;
  busy: boolean;
  showAdminActions: boolean;
  onDisable: (agent: AgentIdentity) => void;
  onRenew: (agent: AgentIdentity) => void;
  onRevoke: (agent: AgentIdentity) => void;
}) {
  return (
    <Surface className="px-4 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <WrenchIcon size={14} className="text-muted-foreground" />
            <Text bold>{agent.name}</Text>
            <Badge variant={agent.status === "active" ? "primary" : "secondary"}>
              {agent.status}
            </Badge>
          </div>
          <Text className="block" size="xs" variant="secondary">
            {agent.sponsorDisplayName} · created {formatDate(agent.createdAt)} · expires{" "}
            {formatDate(agent.expiresAt)}
            {" · "}
            last used {agent.lastUsedAt ? formatDate(agent.lastUsedAt) : "never"}
          </Text>
        </div>
        <AgentRowActions
          agent={agent}
          busy={busy}
          showAdminActions={showAdminActions}
          onDisable={onDisable}
          onRenew={onRenew}
          onRevoke={onRevoke}
        />
      </div>
      <div className="mt-3 grid gap-2">
        <div className="flex flex-wrap gap-1.5">
          {agent.allowedCapabilities.map((capability) => (
            <Badge key={capability} variant="secondary">
              {capability}
            </Badge>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {agent.allowedScopes.map((scope) => (
            <Badge key={`${scope.scope}:${scope.scopeId}`} variant="secondary">
              {scope.scope}: {scope.scopeId}
            </Badge>
          ))}
        </div>
      </div>
    </Surface>
  );
}

function AgentRowActions({
  agent,
  busy,
  showAdminActions,
  onDisable,
  onRenew,
  onRevoke
}: {
  agent: AgentIdentity;
  busy: boolean;
  showAdminActions: boolean;
  onDisable: (agent: AgentIdentity) => void;
  onRenew: (agent: AgentIdentity) => void;
  onRevoke: (agent: AgentIdentity) => void;
}) {
  const canRenew = agent.status === "active" || agent.status === "expired";
  const canRevoke = agent.status === "active" || agent.status === "expired";
  const canDisable = showAdminActions && agent.status === "active";

  if (!canRenew && !canRevoke && !canDisable) return null;

  return (
    <div className="flex shrink-0 gap-1.5">
      {canRenew && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onRenew(agent)}>
          Renew
        </Button>
      )}
      {canRevoke && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onRevoke(agent)}>
          Revoke
        </Button>
      )}
      {canDisable && <AdminDisableButton agent={agent} busy={busy} onDisable={onDisable} />}
    </div>
  );
}

function AdminDisableButton({
  agent,
  busy,
  onDisable
}: {
  agent: AgentIdentity;
  busy: boolean;
  onDisable: (agent: AgentIdentity) => void;
}) {
  return (
    <Button size="sm" variant="outline" disabled={busy} onClick={() => onDisable(agent)}>
      Disable
    </Button>
  );
}

async function requestJson<ResponseBody>(
  path: string,
  init: RequestInit = {}
): Promise<ResponseBody> {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      ...init.headers
    },
    ...init
  });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return (await response.json()) as ResponseBody;
}

function toggleCapability(
  selected: readonly AgentCapability[],
  capability: AgentCapability
): AgentCapability[] {
  return selected.includes(capability)
    ? selected.filter((item) => item !== capability)
    : [...selected, capability];
}

function futureIsoDate(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function startOfNextDay(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDayIsoDate(value: Date): string {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date.toISOString();
}

function formatDate(value: string | Date): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium"
  }).format(new Date(value));
}

function isAdminSession(auth: AuthSession): boolean {
  const identity = auth.identity;
  if (!identity) return false;
  return (
    ["admin", "local-admin"].includes(identity.role) ||
    identity.permissions.some((permission) => ["agent:admin", "admin"].includes(permission))
  );
}

function capabilityLabel(capability: AgentCapability): string {
  const labels: Record<AgentCapability, string> = {
    "memory:read": "Read memory",
    "memory:write": "Write memory",
    "memory:lifecycle": "Manage memory lifecycle",
    "routing:write": "Route tasks",
    "tools:schedule": "Schedule tools"
  };
  return labels[capability];
}

function capabilityDescription(capability: AgentCapability): string {
  const descriptions: Record<AgentCapability, string> = {
    "memory:read": "Read records available to the sponsor.",
    "memory:write": "Create memory records within sponsor grants.",
    "memory:lifecycle": "Promote, reject, or update memory lifecycle state.",
    "routing:write": "Record task routing decisions and provenance.",
    "tools:schedule": "Create scheduled tool runs on behalf of the sponsor."
  };
  return descriptions[capability];
}

function errorMessage(caught: unknown): string {
  return caught instanceof Error ? caught.message : "Agent request failed";
}
