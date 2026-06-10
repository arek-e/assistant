import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type ReactNode
} from "react";
import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import type { MCPServersState } from "agents";
import { cn } from "@teampitch/ui/lib/utils";
import type { ThinkAgent } from "@/server";
import {
  ImageIcon,
  PlugsConnectedIcon,
  WrenchIcon
} from "@/components/app/icons";
import { Badge, Button } from "@/components/app/ui";
import { toastManager } from "@teampitch/ui/components/toast";
import {
  clipboardFiles,
  createAttachment,
  fileToDataUri,
  imageFiles,
  releaseAttachmentPreviews,
  type Attachment
} from "@/features/attachments/attachments";
import { AccountControls } from "@/features/auth/auth-shell";
import type { AuthSession } from "@/features/auth/auth-context";
import { MemoryDebugDrawer } from "@/features/debug/memory-debug-drawer";
import { McpPanel } from "@/features/mcp/mcp-panel";
import { ThemeToggle } from "@/features/theme/theme-toggle";
import { ChatComposer } from "./chat-composer";
import { MessageList } from "./message-list";
import { AssistantAppShell } from "./ui/assistant-app-shell";

export function Chat({
  auth,
  onSignOut
}: {
  auth: AuthSession;
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
  const mcpPanelRef = useRef<HTMLDivElement>(null);

  const agent = useAgent<ThinkAgent>({
    agent: "ThinkAgent",
    onOpen: useCallback(() => setConnected(true), []),
    onClose: useCallback(() => setConnected(false), []),
    onError: useCallback(
      (error: Event) => console.error("WebSocket error:", error),
      []
    ),
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

  const {
    messages,
    sendMessage,
    clearHistory,
    addToolApprovalResponse,
    stop,
    status
  } = useAgentChat({
    agent,
    onToolCall: async (event) => {
      if (
        "addToolOutput" in event &&
        event.toolCall.toolName === "getUserTimezone"
      ) {
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
    if (!showMcpPanel) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        mcpPanelRef.current &&
        !mcpPanelRef.current.contains(event.target as Node)
      ) {
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

  const handleAddServer = async () => {
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
  };

  const handleRemoveServer = async (serverId: string) => {
    try {
      await agent.stub.removeServer(serverId);
    } catch (error) {
      console.error("Failed to remove MCP server:", error);
    }
  };

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
      if (event.dataTransfer.files.length > 0)
        addFiles(event.dataTransfer.files);
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
    if ((!text && attachments.length === 0) || isStreaming) return;
    setInput("");

    const parts: Array<
      | { type: "text"; text: string }
      | { type: "file"; mediaType: string; url: string }
    > = [];
    if (text) parts.push({ type: "text", text });

    for (const attachment of attachments) {
      const dataUri = await fileToDataUri(attachment.file);
      parts.push({
        type: "file",
        mediaType: attachment.mediaType,
        url: dataUri
      });
    }

    releaseAttachmentPreviews(attachments);
    setAttachments([]);

    sendMessage({ role: "user", parts });
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, [input, attachments, isStreaming, sendMessage]);

  const integrationControls = (
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
          onAddServer={handleAddServer}
          onClose={() => setShowMcpPanel(false)}
          onRemoveServer={handleRemoveServer}
        />
      )}
    </div>
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
        connected={connected}
        isStreaming={isStreaming}
        showDebug={showDebugDrawer}
        toolCount={mcpToolCount}
        serverCount={mcpServerCount}
        messageCount={messages.length}
        integrationControls={integrationControls}
        themeToggle={<ThemeToggle />}
        accountControls={
          <AccountControls session={auth} onSignOut={onSignOut} />
        }
        workspacePreview={<WorkspacePreviewDocument />}
        onShowDebugChange={setShowDebugDrawer}
        onNewChat={clearHistory}
        composer={
          <ChatComposer
            input={input}
            attachments={attachments}
            connected={connected}
            isStreaming={isStreaming}
            textareaRef={textareaRef}
            fileInputRef={fileInputRef}
            onInputChange={setInput}
            onSend={send}
            onStop={stop}
            onAddFiles={addFiles}
            onPaste={handlePaste}
            onRemoveAttachment={removeAttachment}
          />
        }
      >
        <div className="space-y-5">
          <MessageList
            messages={messages}
            isStreaming={isStreaming}
            onStarterPrompt={(prompt) =>
              sendMessage({
                role: "user",
                parts: [{ type: "text", text: prompt }]
              })
            }
            addToolApprovalResponse={addToolApprovalResponse}
          />
          <div ref={messagesEndRef} />
        </div>
      </AssistantAppShell>
      <MemoryDebugDrawer
        open={showDebugDrawer}
        messages={messages}
        onOpenChange={setShowDebugDrawer}
        loadSnapshot={() => agent.stub.getMemoryDebugSnapshot()}
      />
    </div>
  );
}

function ImageDropOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 z-50 m-2 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-2 text-primary">
        <ImageIcon size={40} />
        <span className="text-lg font-semibold text-foreground">
          Drop images here
        </span>
      </div>
    </div>
  );
}

type WorkspacePreviewPage = {
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
};

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
  const [activePageId, setActivePageId] =
    useState<WorkspacePreviewPageId>("shell-slots");
  const activePage =
    workspacePreviewPages.find((page) => page.id === activePageId) ??
    workspacePreviewPages[0];

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#fbfbfa]">
      <div
        role="tablist"
        aria-label="Preview pages"
        className="relative flex h-11 shrink-0 items-end gap-1 overflow-visible border-b border-black/10 bg-[#f1f1ee] px-3 pt-2"
      >
        {workspacePreviewPages.map((page, index) => {
          const active = page.id === activePage.id;
          const position = getWorkspacePreviewTabPosition(
            index,
            workspacePreviewPages.length
          );

          return (
            <button
              key={page.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={getWorkspacePreviewTabClassName(active)}
              onClick={() => setActivePageId(page.id)}
            >
              {active && position !== "first" && (
                <WorkspacePreviewTabCorner side="left" />
              )}
              <span className="relative z-10">{page.tabLabel}</span>
              {active && position !== "last" && (
                <WorkspacePreviewTabCorner side="right" />
              )}
            </button>
          );
        })}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <article className="mx-auto max-w-3xl space-y-5 text-neutral-900">
          <div className="space-y-2.5">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
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

function getWorkspacePreviewTabClassName(active: boolean) {
  return cn(
    "relative h-9 shrink-0 px-3 text-sm outline-none transition-[background-color,color]",
    active
      ? "z-10 -mb-px rounded-t-xl border border-b-0 border-black/10 bg-[#fbfbfa] pb-px text-neutral-950 focus-visible:border-black/20 focus-visible:underline focus-visible:underline-offset-4"
      : "mb-px rounded-t-lg text-neutral-500 hover:bg-[#fbfbfa]/70 hover:text-neutral-800 focus-visible:bg-[#fbfbfa]/70 focus-visible:text-neutral-950 focus-visible:underline focus-visible:underline-offset-4"
  );
}

function WorkspacePreviewTabCorner({ side }: { side: "left" | "right" }) {
  const path =
    side === "left"
      ? "M10 0 A10 10 0 0 1 0 10 L10 10 Z"
      : "M0 0 A10 10 0 0 0 10 10 L0 10 Z";
  const borderPath =
    side === "left"
      ? "M10 0 A10 10 0 0 1 0 10 L0 9 A9 9 0 0 0 9 0 Z"
      : "M0 0 A10 10 0 0 0 10 10 L10 9 A9 9 0 0 1 1 0 Z";
  const sideCoverPath =
    side === "left" ? "M9 0 H10 V10 H9 Z" : "M0 0 H1 V10 H0 Z";

  return (
    <svg
      aria-hidden
      className={cn(
        "pointer-events-none absolute bottom-0 size-[10px]",
        side === "left" ? "-left-[10px]" : "-right-[10px]"
      )}
      focusable="false"
      shapeRendering="geometricPrecision"
      viewBox="0 0 10 10"
    >
      <path d={path} fill="#fbfbfa" />
      <path d={sideCoverPath} fill="#fbfbfa" />
      <path d={borderPath} fill="rgba(0,0,0,0.1)" />
    </svg>
  );
}

function getWorkspacePreviewTabPosition(
  index: number,
  count: number
): WorkspacePreviewTabPosition {
  if (index === 0) return "first";
  if (index === count - 1) return "last";
  return "middle";
}

function PreviewSection({
  children,
  title
}: {
  children: ReactNode;
  title: string;
}) {
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
