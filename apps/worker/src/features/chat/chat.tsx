import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent
} from "react";
import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import type { MCPServersState } from "agents";
import type { ThinkAgent } from "@/server";
import {
  BrainIcon,
  BugIcon,
  CircleIcon,
  ImageIcon,
  PlugsConnectedIcon,
  TrashIcon,
  WrenchIcon
} from "@/components/app/icons";
import { Badge, Button, Switch, Text } from "@/components/app/ui";
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

  return (
    <div
      className="flex flex-col h-screen bg-background relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && <ImageDropOverlay />}

      <header className="px-5 py-4 bg-card border-b border-border">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-foreground">
              <span className="mr-2">⛅</span>Teampitch
            </h1>
            <Badge variant="secondary">
              <BrainIcon size={12} className="mr-1" />
              Think
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <ConnectionStatus connected={connected} />
            <AccountControls session={auth} onSignOut={onSignOut} />
            <div className="flex items-center gap-1.5">
              <BugIcon size={14} className="text-muted-foreground" />
              <Switch
                checked={showDebugDrawer}
                onCheckedChange={setShowDebugDrawer}
                size="sm"
                aria-label="Toggle debugger"
              />
            </div>
            <ThemeToggle />
            <div className="relative" ref={mcpPanelRef}>
              <Button
                variant="secondary"
                icon={<PlugsConnectedIcon size={16} />}
                onClick={() => setShowMcpPanel(!showMcpPanel)}
              >
                MCP
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
            <Button
              variant="secondary"
              icon={<TrashIcon size={16} />}
              onClick={clearHistory}
            >
              Clear
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-5 py-6 space-y-5">
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
      </div>

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
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm border-2 border-dashed border-primary rounded-xl m-2 pointer-events-none">
      <div className="flex flex-col items-center gap-2 text-primary">
        <ImageIcon size={40} />
        <Text variant="heading3" as="span">
          Drop images here
        </Text>
      </div>
    </div>
  );
}

function ConnectionStatus({ connected }: { connected: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <CircleIcon
        size={8}
        className={connected ? "text-success" : "text-destructive"}
      />
      <Text size="xs" variant="secondary">
        {connected ? "Connected" : "Disconnected"}
      </Text>
    </div>
  );
}
