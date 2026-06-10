import { useAgentChat } from "@cloudflare/ai-chat/react";
import type { MCPServersState } from "agents";
import { useAgent } from "agents/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent
} from "react";

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
import {
  clipboardFiles,
  createAttachment,
  fileToDataUri,
  imageFiles,
  releaseAttachmentPreviews,
  type Attachment
} from "@/features/attachments/attachments";
import { MemoryDebugDrawer } from "@/features/debug/memory-debug-drawer";
import { McpPanel } from "@/features/mcp/mcp-panel";
import { ThemeToggle } from "@/features/theme/theme-toggle";
import type { ThinkAgent } from "@/server";
import { toastManager } from "@teampitch/ui/components/toast";

import { ChatComposer } from "./chat-composer";
import { MessageList } from "./message-list";

export function Chat() {
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
    if ((!text && attachments.length === 0) || isStreaming) return;
    setInput("");

    const parts: Array<
      { type: "text"; text: string } | { type: "file"; mediaType: string; url: string }
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

    await sendMessage({ role: "user", parts });
    if (textareaRef.current) textareaRef.current.style.height = "auto";
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

  const clearChatHistory = useCallback(() => {
    clearHistory();
  }, [clearHistory]);

  const stopStreaming = useCallback(() => {
    void stop();
  }, [stop]);

  const addMcpServer = useCallback(() => {
    void handleAddServer();
  }, [handleAddServer]);

  const removeMcpServer = useCallback(
    (serverId: string) => {
      void handleRemoveServer(serverId);
    },
    [handleRemoveServer]
  );

  const respondToToolApproval = useCallback(
    (response: Parameters<typeof addToolApprovalResponse>[0]) => {
      void addToolApprovalResponse(response);
    },
    [addToolApprovalResponse]
  );

  return (
    <div
      className="relative flex h-screen flex-col bg-background"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && <ImageDropOverlay />}

      <header className="border-b border-border bg-card px-5 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
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
                  onAddServer={addMcpServer}
                  onClose={() => setShowMcpPanel(false)}
                  onRemoveServer={removeMcpServer}
                />
              )}
            </div>
            <Button variant="secondary" icon={<TrashIcon size={16} />} onClick={clearChatHistory}>
              Clear
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-5 px-5 py-6">
          <MessageList
            messages={messages}
            isStreaming={isStreaming}
            onStarterPrompt={sendStarterPrompt}
            addToolApprovalResponse={respondToToolApproval}
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
        onSend={() => void send()}
        onStop={stopStreaming}
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
    <div className="pointer-events-none absolute inset-0 z-50 m-2 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-background/80 backdrop-blur-sm">
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
      <CircleIcon size={8} className={connected ? "text-success" : "text-destructive"} />
      <Text size="xs" variant="secondary">
        {connected ? "Connected" : "Disconnected"}
      </Text>
    </div>
  );
}
