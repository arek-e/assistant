import { getToolName, isToolUIPart, type UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useState } from "react";

import { BrainIcon, BugIcon, GearIcon, WrenchIcon } from "@/components/app/icons";
import { Badge, Button, Surface, Text } from "@/components/app/ui";
import type { ThinkAgent } from "@/server";
import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle
} from "@teampitch/ui/components/drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@teampitch/ui/components/tabs";

type MemoryDebugSnapshot = Awaited<ReturnType<ThinkAgent["getMemoryDebugSnapshot"]>>;

interface ToolTrace {
  id: string;
  name: string;
  state: string;
  input: unknown;
  output: unknown;
}

interface SnapshotSummaryData {
  records: number;
  routes: number;
  kinds: Record<string, number>;
  statuses: Record<string, number>;
  scopes: Record<string, number>;
}

const memoryToolNames = new Set([
  "recordMemory",
  "recordDecision",
  "searchMemory",
  "promoteRecord"
]);

export function MemoryDebugDrawer({
  open,
  messages,
  onOpenChange,
  loadSnapshot
}: {
  open: boolean;
  messages: UIMessage[];
  onOpenChange: (open: boolean) => void;
  loadSnapshot: () => Promise<MemoryDebugSnapshot>;
}) {
  const [snapshot, setSnapshot] = useState<MemoryDebugSnapshot | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toolTraces = useMemo(() => collectToolTraces(messages), [messages]);
  const memoryTraces = toolTraces.filter((trace) => memoryToolNames.has(trace.name));
  const routingTraces = toolTraces.filter((trace) => trace.name === "routeTask");

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      setSnapshot(await loadSnapshot());
    } catch (refreshError) {
      setError(
        refreshError instanceof Error ? refreshError.message : "Failed to load debug snapshot"
      );
    } finally {
      setIsRefreshing(false);
    }
  }, [loadSnapshot]);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange} position="right">
      <DrawerPopup className="max-w-2xl" position="right" showCloseButton variant="straight">
        <DrawerHeader>
          <div className="flex items-start justify-between gap-4 pe-8">
            <div className="space-y-2">
              <DrawerTitle className="flex items-center gap-2">
                <BugIcon size={18} />
                Debugger
              </DrawerTitle>
              <DrawerDescription>
                Memory records, retrieval evidence, and Effort Router traces.
              </DrawerDescription>
            </div>
            <Button
              size="sm"
              variant="secondary"
              icon={<GearIcon size={14} />}
              onClick={() => void refresh()}
              disabled={isRefreshing}
            >
              {isRefreshing ? "Refreshing" : "Refresh"}
            </Button>
          </div>
        </DrawerHeader>

        <DrawerPanel className="pt-0">
          <Tabs defaultValue="memory" className="min-h-0">
            <TabsList className="mb-4">
              <TabsTrigger value="memory">
                <BrainIcon size={14} />
                Memory
              </TabsTrigger>
              <TabsTrigger value="routing">
                <WrenchIcon size={14} />
                Routing
              </TabsTrigger>
              <TabsTrigger value="raw">
                <BugIcon size={14} />
                Raw
              </TabsTrigger>
            </TabsList>

            {error && (
              <Surface className="mb-4 border-destructive/40 p-3">
                <Text size="xs" variant="secondary">
                  {error}
                </Text>
              </Surface>
            )}

            <TabsContent value="memory">
              <MemoryPanel snapshot={snapshot} traces={memoryTraces} />
            </TabsContent>
            <TabsContent value="routing">
              <RoutingPanel snapshot={snapshot} traces={routingTraces} />
            </TabsContent>
            <TabsContent value="raw">
              <RawPanel snapshot={snapshot} traces={toolTraces} />
            </TabsContent>
          </Tabs>
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  );
}

function MemoryPanel({
  snapshot,
  traces
}: {
  snapshot: MemoryDebugSnapshot | null;
  traces: ToolTrace[];
}) {
  return (
    <div className="space-y-4">
      <SnapshotSummary snapshot={snapshot} />
      <TraceList title="Memory Tool Calls" traces={traces} />
      <div className="space-y-2">
        <PanelHeading>Stored Records</PanelHeading>
        {snapshot?.records.length ? (
          snapshot.records.map((record) => (
            <Surface key={record.id} className="p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Text bold>{record.title}</Text>
                <Badge variant="secondary">{record.kind}</Badge>
                <Badge variant="secondary">{record.scope}</Badge>
                <Badge variant="secondary">{record.scopeId}</Badge>
                <Badge variant="secondary">{record.status}</Badge>
              </div>
              <Text className="mt-1 block font-mono break-all" size="xs" variant="secondary">
                {record.id}
              </Text>
              <RecordHashLine contentHash={record.contentHash} recordHash={record.recordHash} />
              <Text className="mt-2 block" size="xs" variant="secondary">
                {record.body}
              </Text>
            </Surface>
          ))
        ) : (
          <EmptyDebugState label="No memory records in this Agent yet." />
        )}
      </div>
    </div>
  );
}

function RoutingPanel({
  snapshot,
  traces
}: {
  snapshot: MemoryDebugSnapshot | null;
  traces: ToolTrace[];
}) {
  return (
    <div className="space-y-4">
      <TraceList title="Route Tool Calls" traces={traces} />
      <div className="space-y-2">
        <PanelHeading>Recent Route Records</PanelHeading>
        {snapshot?.recentRoutes.length ? (
          snapshot.recentRoutes.map((record) => (
            <Surface key={record.id} className="p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Text bold>{record.title}</Text>
                <Badge variant="secondary">{record.scope}</Badge>
                <Badge variant="secondary">{record.scopeId}</Badge>
                <Badge variant="secondary">{record.status}</Badge>
              </div>
              <RecordHashLine contentHash={record.contentHash} recordHash={record.recordHash} />
              <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-muted p-2 text-xs">
                {record.body}
              </pre>
            </Surface>
          ))
        ) : (
          <EmptyDebugState label="No route records have been written yet." />
        )}
      </div>
    </div>
  );
}

function RawPanel({
  snapshot,
  traces
}: {
  snapshot: MemoryDebugSnapshot | null;
  traces: ToolTrace[];
}) {
  return (
    <div className="space-y-3">
      <PanelHeading>Snapshot</PanelHeading>
      <JsonBlock value={snapshot ?? { status: "not loaded" }} />
      <PanelHeading>Tool Trace</PanelHeading>
      <JsonBlock value={traces} />
    </div>
  );
}

function SnapshotSummary({ snapshot }: { snapshot: MemoryDebugSnapshot | null }) {
  const summary = toSnapshotSummary(snapshot);

  return (
    <div className="grid grid-cols-2 gap-2">
      <SummaryTile label="Records" value={summary.records} />
      <SummaryTile label="Routes" value={summary.routes} />
      <SummaryMap title="Kinds" values={summary.kinds} />
      <SummaryMap title="Statuses" values={summary.statuses} />
      <SummaryMap title="Scopes" values={summary.scopes} />
    </div>
  );
}

function toSnapshotSummary(snapshot: MemoryDebugSnapshot | null): SnapshotSummaryData {
  if (!snapshot) {
    return {
      records: 0,
      routes: 0,
      kinds: {},
      statuses: {},
      scopes: {}
    };
  }

  return {
    records: snapshot.recordCount,
    routes: snapshot.recentRoutes.length,
    kinds: snapshot.countsByKind,
    statuses: snapshot.countsByStatus,
    scopes: snapshot.countsByScope
  };
}

function RecordHashLine({ contentHash, recordHash }: { contentHash: string; recordHash: string }) {
  return (
    <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
      <span className="font-mono break-all">content: {contentHash}</span>
      <span className="font-mono break-all">record: {recordHash}</span>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <Surface className="p-3">
      <Text className="block" size="xs" variant="secondary">
        {label}
      </Text>
      <span className="mt-1 block text-2xl font-semibold text-foreground">{value}</span>
    </Surface>
  );
}

function SummaryMap({ title, values }: { title: string; values: Record<string, number> }) {
  const entries = Object.entries(values);

  return (
    <Surface className="p-3">
      <Text className="block" size="xs" variant="secondary">
        {title}
      </Text>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {entries.length ? (
          entries.map(([key, value]) => (
            <Badge key={key} variant="secondary">
              {key}: {value}
            </Badge>
          ))
        ) : (
          <Text size="xs" variant="secondary">
            none
          </Text>
        )}
      </div>
    </Surface>
  );
}

function TraceList({ title, traces }: { title: string; traces: ToolTrace[] }) {
  return (
    <div className="space-y-2">
      <PanelHeading>{title}</PanelHeading>
      {traces.length ? (
        traces.map((trace) => (
          <Surface key={trace.id} className="p-3">
            <div className="flex items-center gap-2">
              <GearIcon size={14} className="text-muted-foreground" />
              <Text bold>{trace.name}</Text>
              <Badge variant="secondary">{trace.state}</Badge>
            </div>
            {trace.input !== undefined && <JsonBlock compact label="input" value={trace.input} />}
            {trace.output !== undefined && (
              <JsonBlock compact label="output" value={trace.output} />
            )}
          </Surface>
        ))
      ) : (
        <EmptyDebugState label="No matching tool calls in the visible chat." />
      )}
    </div>
  );
}

function JsonBlock({
  value,
  label,
  compact = false
}: {
  value: unknown;
  label?: string;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "mt-2" : undefined}>
      {label && (
        <Text className="mb-1 block" size="xs" variant="secondary">
          {label}
        </Text>
      )}
      <pre className="max-h-72 overflow-auto rounded-md bg-muted p-2 text-xs text-foreground">
        {stringify(value)}
      </pre>
    </div>
  );
}

function PanelHeading({ children }: { children: string }) {
  return (
    <Text className="block uppercase" size="xs" variant="secondary" bold>
      {children}
    </Text>
  );
}

function EmptyDebugState({ label }: { label: string }) {
  return (
    <Surface className="p-3">
      <Text size="xs" variant="secondary">
        {label}
      </Text>
    </Surface>
  );
}

function collectToolTraces(messages: UIMessage[]): ToolTrace[] {
  return messages.flatMap((message) =>
    message.parts.flatMap((part) =>
      isToolUIPart(part)
        ? [
            {
              id: part.toolCallId,
              name: getToolName(part),
              state: part.state,
              input: "input" in part ? part.input : undefined,
              output: "output" in part ? part.output : undefined
            }
          ]
        : []
    )
  );
}

function stringify(value: unknown) {
  return JSON.stringify(value, null, 2);
}
