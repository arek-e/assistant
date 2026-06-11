import { useAgentChat } from "@cloudflare/ai-chat/react";
import type { MCPServersState } from "agents";
import { useAgent } from "agents/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type ReactNode
} from "react";

import { BrainIcon, ImageIcon, PlugsConnectedIcon, WrenchIcon } from "@/components/app/icons";
import { Badge, Button, Surface, Text } from "@/components/app/ui";
import {
  clipboardFiles,
  createAttachment,
  fileToDataUri,
  imageFiles,
  releaseAttachmentPreviews,
  type Attachment
} from "@/features/attachments/attachments";
import type { AuthSession } from "@/features/auth/auth-context";
import { AccountControls } from "@/features/auth/auth-shell";
import { MemoryDebugDrawer } from "@/features/debug/memory-debug-drawer";
import { McpPanel } from "@/features/mcp/mcp-panel";
import { ThemeToggle } from "@/features/theme/theme-toggle";
import type { ThinkAgent } from "@/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@teampitch/ui/components/tabs";
import { toastManager } from "@teampitch/ui/components/toast";
import { cn } from "@teampitch/ui/lib/utils";

import { ChatComposer } from "./chat-composer";
import { MessageList } from "./message-list";
import { AssistantAppShell, type PrimaryAppView } from "./ui/assistant-app-shell";

type OutgoingMessagePart =
  | { type: "text"; text: string }
  | { type: "file"; mediaType: string; url: string };

export function Chat({
  activeView,
  auth,
  onNavigateView,
  onOpenSettings,
  onSignOut
}: {
  activeView: PrimaryAppView;
  auth: AuthSession;
  onNavigateView: (view: PrimaryAppView) => void;
  onOpenSettings: () => void;
  onSignOut: () => void;
}) {
  const [connected, setConnected] = useState(false);
  const [input, setInput] = useState("");
  const [showDebugDrawer, setShowDebugDrawer] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mcpState, setMcpState] = useState<MCPServersState>({
    prompts: [],
    resources: [],
    servers: {},
    tools: []
  });
  const [showMcpPanel, setShowMcpPanel] = useState(false);
  const [mcpName, setMcpName] = useState("");
  const [mcpUrl, setMcpUrl] = useState("");
  const [isAddingServer, setIsAddingServer] = useState(false);
  const [activeChatStartedAt, setActiveChatStartedAt] = useState(() => new Date());
  const activeChatTimestampCapturedRef = useRef(false);
  const mcpPanelRef = useRef<HTMLDivElement>(null);

  const agent = useAgent<ThinkAgent>({
    agent: "ThinkAgent",
    onOpen: useCallback(() => setConnected(true), []),
    onClose: useCallback(() => setConnected(false), []),
    onError: useCallback((error: Event) => console.error("WebSocket error:", error), []),
    onMcpUpdate: useCallback((state: MCPServersState) => {
      setMcpState(state);
    }, []),
    onMessage: useCallback((message: MessageEvent) => {
      try {
        const data = JSON.parse(String(message.data));
        if (data.type === "scheduled-task") {
          toastManager.add({
            title: "Scheduled task completed",
            description: data.description
          });
        }
      } catch {
        // Ignore non-application websocket messages.
      }
    }, [])
  });

  const { messages, sendMessage, clearHistory, addToolApprovalResponse, stop, status } =
    useAgentChat({
      agent,
      onToolCall: async (event) => {
        if ("addToolOutput" in event && event.toolCall.toolName === "getUserTimezone") {
          event.addToolOutput({
            toolCallId: event.toolCall.toolCallId,
            output: {
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              localTime: new Date().toLocaleTimeString()
            }
          });
        }
      }
    });

  const isStreaming = status === "streaming" || status === "submitted";
  const mcpToolCount = mcpState.tools.length;
  const mcpServerCount = Object.keys(mcpState.servers).length;

  useEffect(() => {
    if (messages.length === 0) {
      activeChatTimestampCapturedRef.current = false;
      return;
    }

    if (!activeChatTimestampCapturedRef.current) {
      activeChatTimestampCapturedRef.current = true;
      setActiveChatStartedAt(new Date());
    }
  }, [messages.length]);

  useEffect(() => {
    if (!showMcpPanel) return;

    function handleClickOutside(event: MouseEvent) {
      if (mcpPanelRef.current && !mcpPanelRef.current.contains(event.target as Node)) {
        setShowMcpPanel(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMcpPanel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!isStreaming && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isStreaming]);

  const handleAddServer = useCallback(async () => {
    if (!mcpName.trim() || !mcpUrl.trim()) return;
    setIsAddingServer(true);
    try {
      await agent.stub.addServer(mcpName.trim(), mcpUrl.trim());
      setMcpName("");
      setMcpUrl("");
    } catch (error) {
      console.error("Failed to add MCP server:", error);
    } finally {
      setIsAddingServer(false);
    }
  }, [agent.stub, mcpName, mcpUrl]);

  const handleRemoveServer = useCallback(
    async (serverId: string) => {
      try {
        await agent.stub.removeServer(serverId);
      } catch (error) {
        console.error("Failed to remove MCP server:", error);
      }
    },
    [agent.stub]
  );

  const addFiles = useCallback((files: FileList | File[]) => {
    const images = imageFiles(files);
    if (images.length === 0) return;
    setAttachments((prev) => [...prev, ...images.map(createAttachment)]);
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const attachment = prev.find((item) => item.id === id);
      if (attachment) URL.revokeObjectURL(attachment.preview);
      return prev.filter((item) => item.id !== id);
    });
  }, []);

  const handleDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer.types.includes("Files")) setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget === event.target) setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(false);
      if (event.dataTransfer.files.length > 0) addFiles(event.dataTransfer.files);
    },
    [addFiles]
  );

  const handlePaste = useCallback(
    (event: ClipboardEvent) => {
      const files = clipboardFiles(event);
      if (files.length === 0) return;
      event.preventDefault();
      addFiles(files);
    },
    [addFiles]
  );

  const send = useCallback(async () => {
    const text = input.trim();
    if (!canSendMessage(text, attachments.length, isStreaming)) return;
    setInput("");

    const parts = await createOutgoingMessageParts(text, attachments);
    releaseAttachmentPreviews(attachments);
    setAttachments([]);

    await sendMessage({ role: "user", parts });
    resetTextAreaHeight(textareaRef.current);
  }, [input, attachments, isStreaming, sendMessage]);

  const sendStarterPrompt = useCallback(
    (prompt: string) => {
      void sendMessage({
        role: "user",
        parts: [{ type: "text", text: prompt }]
      });
    },
    [sendMessage]
  );

  const addMcpServer = useCallback(() => {
    void handleAddServer();
  }, [handleAddServer]);

  const removeMcpServer = useCallback(
    (serverId: string) => {
      void handleRemoveServer(serverId);
    },
    [handleRemoveServer]
  );

  const stopStreaming = useCallback(() => {
    void stop();
  }, [stop]);

  const navigateView = useCallback(
    (view: PrimaryAppView) => {
      if (view !== "chats") {
        setShowDebugDrawer(false);
      }
      onNavigateView(view);
    },
    [onNavigateView]
  );

  const startNewChat = useCallback(() => {
    clearHistory();
    activeChatTimestampCapturedRef.current = false;
    setActiveChatStartedAt(new Date());
  }, [clearHistory]);

  const respondToToolApproval = useCallback(
    (response: Parameters<typeof addToolApprovalResponse>[0]) => {
      void addToolApprovalResponse(response);
    },
    [addToolApprovalResponse]
  );

  const integrationControls = useMemo(
    () => (
      <div className="relative" ref={mcpPanelRef}>
        <Button
          variant="secondary"
          size="sm"
          icon={<PlugsConnectedIcon size={15} />}
          onClick={() => setShowMcpPanel(!showMcpPanel)}
        >
          MCP servers
          {mcpToolCount > 0 && (
            <Badge variant="primary" className="ml-1.5">
              <WrenchIcon size={10} className="mr-0.5" />
              {mcpToolCount}
            </Badge>
          )}
        </Button>
        {showMcpPanel && (
          <McpPanel
            mcpState={mcpState}
            name={mcpName}
            url={mcpUrl}
            isAddingServer={isAddingServer}
            onNameChange={setMcpName}
            onUrlChange={setMcpUrl}
            onAddServer={addMcpServer}
            onClose={() => setShowMcpPanel(false)}
            onRemoveServer={removeMcpServer}
          />
        )}
      </div>
    ),
    [
      addMcpServer,
      isAddingServer,
      mcpName,
      mcpState,
      mcpToolCount,
      mcpUrl,
      removeMcpServer,
      showMcpPanel
    ]
  );
  const themeToggleSlot = useMemo(() => <ThemeToggle />, []);
  const accountControlsSlot = useMemo(
    () => <AccountControls session={auth} onSignOut={onSignOut} />,
    [auth, onSignOut]
  );
  const workspacePreviewSlot = useMemo(() => <WorkspacePreviewDocument />, []);
  const routeContent = useMemo(() => {
    if (activeView === "home") {
      return (
        <WorkspaceRoutePage
          title="Home"
          description="A workspace overview for the assistant shell, active work surfaces, and the main control areas."
        >
          <Surface className="h-[min(640px,calc(100vh-14rem))] overflow-hidden p-0">
            <WorkspacePreviewDocument />
          </Surface>
        </WorkspaceRoutePage>
      );
    }

    if (activeView === "integrations") {
      return (
        <IntegrationsRoute
          mcpState={mcpState}
          name={mcpName}
          url={mcpUrl}
          isAddingServer={isAddingServer}
          onNameChange={setMcpName}
          onUrlChange={setMcpUrl}
          onAddServer={addMcpServer}
          onRemoveServer={removeMcpServer}
        />
      );
    }

    return null;
  }, [activeView, addMcpServer, isAddingServer, mcpName, mcpState, mcpUrl, removeMcpServer]);
  const composerSlot = useMemo(
    () => (
      <ChatComposer
        input={input}
        attachments={attachments}
        connected={connected}
        isStreaming={isStreaming}
        textareaRef={textareaRef}
        fileInputRef={fileInputRef}
        onInputChange={setInput}
        onSend={() => void send()}
        onStop={stopStreaming}
        onAddFiles={addFiles}
        onPaste={handlePaste}
        onRemoveAttachment={removeAttachment}
      />
    ),
    [
      addFiles,
      attachments,
      connected,
      handlePaste,
      input,
      isStreaming,
      removeAttachment,
      send,
      stopStreaming
    ]
  );

  return (
    <div
      className="relative h-screen"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && <ImageDropOverlay />}
      <AssistantAppShell
        activeView={activeView}
        connected={connected}
        isStreaming={isStreaming}
        showDebug={showDebugDrawer}
        toolCount={mcpToolCount}
        serverCount={mcpServerCount}
        messageCount={messages.length}
        integrationControls={integrationControls}
        themeToggle={themeToggleSlot}
        accountControls={accountControlsSlot}
        activeChatStartedAt={activeChatStartedAt}
        routeContent={routeContent}
        workspacePreview={workspacePreviewSlot}
        onNavigateView={navigateView}
        onOpenSettings={onOpenSettings}
        onShowDebugChange={setShowDebugDrawer}
        onNewChat={startNewChat}
        composer={composerSlot}
      >
        <div className="space-y-5">
          <MessageList
            messages={messages}
            isStreaming={isStreaming}
            onStarterPrompt={sendStarterPrompt}
            addToolApprovalResponse={respondToToolApproval}
          />
          <div ref={messagesEndRef} />
        </div>
      </AssistantAppShell>
      <MemoryDebugDrawer
        open={activeView === "chats" && showDebugDrawer}
        messages={messages}
        onOpenChange={setShowDebugDrawer}
        loadSnapshot={() => agent.stub.getMemoryDebugSnapshot()}
      />
    </div>
  );
}

function WorkspaceRoutePage({
  children,
  description,
  title
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[1.375rem] leading-7 font-semibold text-neutral-950">{title}</h1>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-5 text-neutral-500">{description}</p>
      </header>
      {children}
    </div>
  );
}

interface IntegrationConnectionProps {
  mcpState: MCPServersState;
  name: string;
  url: string;
  isAddingServer: boolean;
  onNameChange: (value: string) => void;
  onUrlChange: (value: string) => void;
  onAddServer: () => void;
  onRemoveServer: (serverId: string) => void;
}

function IntegrationsRoute(props: IntegrationConnectionProps) {
  const { mcpState } = props;
  const serverCount = Object.keys(mcpState.servers).length;
  const toolCount = mcpState.tools.length;

  return (
    <WorkspaceRoutePage
      title="Integrations"
      description="Connect MCP servers and review the tools they make available to the assistant."
    >
      <Tabs defaultValue="connections" className="gap-7">
        <TabsList
          variant="underline"
          className="w-fit gap-2 bg-transparent p-0 text-neutral-600 [&_[data-slot=tab-indicator]]:hidden"
        >
          <TabsTrigger className={integrationTabClassName} value="connections">
            Connections
            <TabCount>{serverCount}</TabCount>
          </TabsTrigger>
          <TabsTrigger className={integrationTabClassName} value="tools">
            Tools
            <TabCount>{toolCount}</TabCount>
          </TabsTrigger>
          <TabsTrigger className={integrationTabClassName} value="skills">
            Skills
          </TabsTrigger>
        </TabsList>

        <TabsContent className="pt-1" value="connections">
          <ConnectionsSection {...props} />
        </TabsContent>

        <TabsContent className="pt-1" value="tools">
          <ToolsSection mcpState={mcpState} />
        </TabsContent>

        <TabsContent className="pt-1" value="skills">
          <SkillsSection />
        </TabsContent>
      </Tabs>
    </WorkspaceRoutePage>
  );
}

function ConnectionsSection({
  mcpState,
  name,
  url,
  isAddingServer,
  onNameChange,
  onUrlChange,
  onAddServer,
  onRemoveServer
}: IntegrationConnectionProps) {
  return (
    <section className="space-y-4">
      <SectionIntro
        title="Connections"
        description="Add or remove Model Context Protocol servers for this workspace."
      />
      <McpPanel
        embedded
        mcpState={mcpState}
        name={name}
        url={url}
        isAddingServer={isAddingServer}
        onNameChange={onNameChange}
        onUrlChange={onUrlChange}
        onAddServer={onAddServer}
        onClose={() => undefined}
        onRemoveServer={onRemoveServer}
      />
    </section>
  );
}

function ToolsSection({ mcpState }: { mcpState: MCPServersState }) {
  const tools = mcpState.tools;

  return (
    <section className="space-y-4">
      <SectionIntro
        title="Tools"
        description="Tools available to the assistant from connected MCP servers."
      />
      <div className="grid gap-3">
        <Surface className="flex min-h-[72px] items-center justify-between gap-4 p-5">
          <div className="min-w-0">
            <Text className="block" bold>
              MCP tools
            </Text>
            <Text className="mt-1 block" size="xs" variant="secondary">
              {tools.length
                ? `${tools.length} tool${tools.length === 1 ? "" : "s"} available`
                : "No tools are available from connected servers."}
            </Text>
          </div>
          <Badge variant="secondary">{tools.length}</Badge>
        </Surface>

        {tools.length > 0 && (
          <div className="grid gap-2">
            {tools.map((tool) => (
              <Surface key={getMcpToolKey(tool)} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <WrenchIcon size={14} className="text-muted-foreground" />
                  <Text bold>{getMcpToolName(tool)}</Text>
                  {getMcpToolServerName(tool) && (
                    <Badge variant="secondary">{getMcpToolServerName(tool)}</Badge>
                  )}
                </div>
                {getMcpToolDescription(tool) && (
                  <Text className="mt-2 block" size="xs" variant="secondary">
                    {getMcpToolDescription(tool)}
                  </Text>
                )}
              </Surface>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function SkillsSection() {
  return (
    <section className="space-y-4">
      <SectionIntro
        title="Skills"
        description="Workspace-level skills will appear here when they are available for this app."
      />
      <Surface className="flex min-h-[132px] items-center gap-4 p-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-black/[0.04] text-neutral-500">
          <BrainIcon size={18} />
        </span>
        <div className="min-w-0">
          <Text className="block" bold>
            No skills connected yet
          </Text>
          <Text className="mt-1 block max-w-xl" size="xs" variant="secondary">
            This workspace does not currently have configurable skills, so there is nothing to
            manage from this page yet.
          </Text>
        </div>
      </Surface>
    </section>
  );
}

function SectionIntro({ description, title }: { description: string; title: string }) {
  return (
    <div>
      <h2 className="text-xl leading-7 font-semibold text-neutral-950">{title}</h2>
      <p className="mt-1 text-sm leading-5 text-neutral-500">{description}</p>
    </div>
  );
}

function TabCount({ children }: { children: number }) {
  return (
    <span className="ml-1 grid min-w-4 place-items-center rounded-full bg-black/[0.06] px-1.5 text-[11px] leading-4 text-neutral-500 group-data-active:bg-white/15 group-data-active:text-white/75">
      {children}
    </span>
  );
}

const integrationTabClassName =
  "group h-8 rounded-full border border-black/10 bg-white/45 px-3 text-sm font-medium text-neutral-600 shadow-[0_10px_28px_rgba(16,16,15,0.05),inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-md transition-[background-color,border-color,color,box-shadow,scale] hover:border-black/15 hover:bg-white/70 hover:text-neutral-950 data-active:border-neutral-950 data-active:bg-neutral-950 data-active:text-white data-active:shadow-[0_12px_30px_rgba(16,16,15,0.16)] active:scale-[0.98]";

function ImageDropOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 z-50 m-2 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-2 text-primary">
        <ImageIcon size={40} />
        <span className="text-lg font-semibold text-foreground">Drop images here</span>
      </div>
    </div>
  );
}

function getMcpToolName(tool: unknown): string {
  const record = asRecord(tool);
  return stringValue(record.name) ?? stringValue(record.toolName) ?? "Unnamed tool";
}

function getMcpToolServerName(tool: unknown): string | null {
  const record = asRecord(tool);
  return (
    stringValue(record.serverName) ?? stringValue(record.server_id) ?? stringValue(record.serverId)
  );
}

function getMcpToolDescription(tool: unknown): string | null {
  const record = asRecord(tool);
  return stringValue(record.description);
}

function getMcpToolKey(tool: unknown): string {
  return [
    getMcpToolServerName(tool) ?? "unknown-server",
    getMcpToolName(tool),
    getMcpToolDescription(tool) ?? "no-description"
  ].join(":");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function canSendMessage(text: string, attachmentCount: number, isStreaming: boolean) {
  return (text.length > 0 || attachmentCount > 0) && !isStreaming;
}

async function createOutgoingMessageParts(
  text: string,
  attachments: Attachment[]
): Promise<OutgoingMessagePart[]> {
  const textParts = createTextMessageParts(text);
  const fileParts = await Promise.all(attachments.map(createFileMessagePart));
  return [...textParts, ...fileParts];
}

function createTextMessageParts(text: string): OutgoingMessagePart[] {
  return text ? [{ type: "text", text }] : [];
}

async function createFileMessagePart(attachment: Attachment): Promise<OutgoingMessagePart> {
  return {
    type: "file",
    mediaType: attachment.mediaType,
    url: await fileToDataUri(attachment.file)
  };
}

function resetTextAreaHeight(textarea: HTMLTextAreaElement | null) {
  if (!textarea) return;
  textarea.style.height = "auto";
}

interface WorkspacePreviewPage {
  id: string;
  tabLabel: string;
  eyebrow: string;
  title: string;
  description: string;
  sections: Array<{
    title: string;
    body: string;
    items?: string[];
  }>;
}

const workspacePreviewPages = [
  {
    id: "shell-slots",
    tabLabel: "Shell slots",
    eyebrow: "Product structure note",
    title: "Assistant Shell Slots",
    description:
      "Durable shell regions for the assistant workspace. These terms should stay consistent in product discussion, component naming, and implementation reviews.",
    sections: [
      {
        title: "Primary Rail",
        body: "Stable workspace modes and persistent account controls.",
        items: [
          "Assistant / chat",
          "Work queue / tasks",
          "Integrations / tools",
          "Memory / knowledge",
          "Settings",
          "Bottom: theme + user profile"
        ]
      },
      {
        title: "Workspace Preview",
        body: "Optional center preview surface for documents, task artifacts, plans, uploaded files, or other work objects."
      },
      {
        title: "Right Details",
        body: "Accountability and control inspector for runtime state, approvals, recovery, and selected object metadata."
      }
    ]
  },
  {
    id: "preview-surfaces",
    tabLabel: "Preview surfaces",
    eyebrow: "Workspace objects",
    title: "Preview Surfaces",
    description:
      "The preview slot should feel like a focused page inside the workspace, not a separate split screen or modal.",
    sections: [
      {
        title: "Document pages",
        body: "Use the slot for generated plans, notes, uploaded files, transcripts, and editable work objects.",
        items: [
          "document preview",
          "task artifact preview",
          "generated plan preview",
          "uploaded file preview"
        ]
      },
      {
        title: "Chat position",
        body: "When a preview is open, chat becomes the right-side work companion for the selected document."
      }
    ]
  },
  {
    id: "control-inspector",
    tabLabel: "Inspector",
    eyebrow: "Accountability layer",
    title: "Control Inspector",
    description:
      "The inspector stays separate from the preview and chat so runtime state, tools, and approvals do not compete with the working document.",
    sections: [
      {
        title: "Runtime status",
        body: "Show whether the agent is idle, responding, using tools, or waiting on approval."
      },
      {
        title: "Recovery",
        body: "Expose failed runs, approval decisions, tool state, and recovery actions in a predictable place."
      }
    ]
  }
] satisfies WorkspacePreviewPage[];

type WorkspacePreviewPageId = (typeof workspacePreviewPages)[number]["id"];

function WorkspacePreviewDocument() {
  const [activePageId, setActivePageId] = useState<WorkspacePreviewPageId>("shell-slots");
  const activePage =
    workspacePreviewPages.find((page) => page.id === activePageId) ?? workspacePreviewPages[0];

  return (
    <div className="flex h-full min-h-0 flex-col bg-transparent">
      <div
        role="tablist"
        aria-label="Preview pages"
        className="relative flex h-11 shrink-0 items-end gap-1 overflow-visible border-b border-black/10 bg-white/25 px-3 pt-2"
      >
        {workspacePreviewPages.map((page, index) => (
          <WorkspacePreviewTab
            key={page.id}
            active={page.id === activePage.id}
            page={page}
            position={getWorkspacePreviewTabPosition(index, workspacePreviewPages.length)}
            onSelect={setActivePageId}
          />
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <article className="mx-auto max-w-3xl space-y-5 text-neutral-900">
          <div className="space-y-2.5">
            <p className="text-xs font-medium tracking-wide text-neutral-400 uppercase">
              {activePage.eyebrow}
            </p>
            <h1 className="text-3xl font-medium tracking-normal text-neutral-950">
              {activePage.title}
            </h1>
            <p className="max-w-2xl text-base leading-7 text-neutral-600">
              {activePage.description}
            </p>
          </div>

          {activePage.sections.map((section) => (
            <PreviewSection key={section.title} title={section.title}>
              <p>{section.body}</p>
              {section.items && <PreviewList items={section.items} />}
            </PreviewSection>
          ))}
        </article>
      </div>
    </div>
  );
}

type WorkspacePreviewTabPosition = "first" | "middle" | "last";

const workspacePreviewTabCornerPaths = {
  left: {
    background: "M10 0 A10 10 0 0 1 0 10 L10 10 Z",
    border: "M10 0 A10 10 0 0 1 0 10 L0 9 A9 9 0 0 0 9 0 Z",
    cover: "M9 0 H10 V10 H9 Z",
    className: "-left-[10px]"
  },
  right: {
    background: "M0 0 A10 10 0 0 0 10 10 L0 10 Z",
    border: "M0 0 A10 10 0 0 0 10 10 L10 9 A9 9 0 0 1 1 0 Z",
    cover: "M0 0 H1 V10 H0 Z",
    className: "-right-[10px]"
  }
} satisfies Record<
  "left" | "right",
  {
    background: string;
    border: string;
    cover: string;
    className: string;
  }
>;

const workspacePreviewTabCornerVisibility = {
  left: {
    first: false,
    middle: true,
    last: true
  },
  right: {
    first: true,
    middle: true,
    last: false
  }
} satisfies Record<"left" | "right", Record<WorkspacePreviewTabPosition, boolean>>;

function WorkspacePreviewTab({
  active,
  page,
  position,
  onSelect
}: {
  active: boolean;
  page: WorkspacePreviewPage;
  position: WorkspacePreviewTabPosition;
  onSelect: (pageId: WorkspacePreviewPageId) => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={getWorkspacePreviewTabClassName(active)}
      onClick={() => onSelect(page.id)}
    >
      <WorkspacePreviewTabCornerSlot active={active} position={position} side="left" />
      <span className="relative z-10">{page.tabLabel}</span>
      <WorkspacePreviewTabCornerSlot active={active} position={position} side="right" />
    </button>
  );
}

function getWorkspacePreviewTabClassName(active: boolean) {
  return cn(
    "relative h-9 shrink-0 px-3 text-sm transition-[background-color,color] outline-none",
    active
      ? "z-10 -mb-px rounded-t-xl border border-b-0 border-black/10 bg-white/70 pb-px text-neutral-950 focus-visible:border-black/20 focus-visible:underline focus-visible:underline-offset-4"
      : "mb-px rounded-t-lg text-neutral-500 hover:bg-white/45 hover:text-neutral-800 focus-visible:bg-white/45 focus-visible:text-neutral-950 focus-visible:underline focus-visible:underline-offset-4"
  );
}

function WorkspacePreviewTabCornerSlot({
  active,
  position,
  side
}: {
  active: boolean;
  position: WorkspacePreviewTabPosition;
  side: "left" | "right";
}) {
  if (!shouldShowWorkspacePreviewTabCorner(active, position, side)) return null;
  return <WorkspacePreviewTabCorner side={side} />;
}

function WorkspacePreviewTabCorner({ side }: { side: "left" | "right" }) {
  const paths = workspacePreviewTabCornerPaths[side];

  return (
    <svg
      aria-hidden
      className={cn("pointer-events-none absolute bottom-0 size-[10px]", paths.className)}
      focusable="false"
      shapeRendering="geometricPrecision"
      viewBox="0 0 10 10"
    >
      <path d={paths.background} fill="rgba(255,255,255,0.7)" />
      <path d={paths.cover} fill="rgba(255,255,255,0.7)" />
      <path d={paths.border} fill="rgba(0,0,0,0.1)" />
    </svg>
  );
}

function shouldShowWorkspacePreviewTabCorner(
  active: boolean,
  position: WorkspacePreviewTabPosition,
  side: "left" | "right"
) {
  return active && workspacePreviewTabCornerVisibility[side][position];
}

function getWorkspacePreviewTabPosition(index: number, count: number): WorkspacePreviewTabPosition {
  if (index === 0) return "first";
  if (index === count - 1) return "last";
  return "middle";
}

function PreviewSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="space-y-2.5 border-t border-black/10 pt-4 text-sm leading-6 text-neutral-600">
      <h2 className="text-xl font-medium text-neutral-950">{title}</h2>
      {children}
    </section>
  );
}

function PreviewList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span className="mt-2 size-1.5 rounded-full bg-neutral-300" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
