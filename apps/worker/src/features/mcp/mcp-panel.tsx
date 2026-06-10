import type { MCPServersState } from "agents";

import {
  PlugsConnectedIcon,
  PlusIcon,
  SignInIcon,
  TrashIcon,
  WrenchIcon,
  XIcon
} from "@/components/app/icons";
import { Badge, Button, Surface, Text } from "@/components/app/ui";

export function McpPanel({
  mcpState,
  name,
  url,
  isAddingServer,
  onNameChange,
  onUrlChange,
  onAddServer,
  onClose,
  onRemoveServer
}: {
  mcpState: MCPServersState;
  name: string;
  url: string;
  isAddingServer: boolean;
  onNameChange: (value: string) => void;
  onUrlChange: (value: string) => void;
  onAddServer: () => void;
  onClose: () => void;
  onRemoveServer: (serverId: string) => void;
}) {
  const serverEntries = Object.entries(mcpState.servers);
  const toolCount = mcpState.tools.length;

  return (
    <div className="absolute top-full right-0 z-50 mt-2 w-96">
      <Surface className="space-y-4 rounded-xl p-4 shadow-lg ring ring-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PlugsConnectedIcon size={16} className="text-primary" />
            <Text size="sm" bold>
              MCP Servers
            </Text>
            {serverEntries.length > 0 && <Badge variant="secondary">{serverEntries.length}</Badge>}
          </div>
          <Button
            variant="ghost"
            size="sm"
            shape="square"
            aria-label="Close MCP panel"
            icon={<XIcon size={14} />}
            onClick={onClose}
          />
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            onAddServer();
          }}
          className="space-y-2"
        >
          <input
            type="text"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            aria-label="MCP server name"
            placeholder="Server name"
            className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-ring focus:outline-none"
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={url}
              onChange={(event) => onUrlChange(event.target.value)}
              aria-label="MCP server URL"
              placeholder="https://mcp.example.com"
              className="flex-1 rounded-lg border border-border bg-card px-3 py-1.5 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-ring focus:outline-none"
            />
            <Button
              type="submit"
              variant="primary"
              size="sm"
              icon={<PlusIcon size={14} />}
              disabled={isAddingServer || !name.trim() || !url.trim()}
            >
              {isAddingServer ? "..." : "Add"}
            </Button>
          </div>
        </form>

        {serverEntries.length > 0 && (
          <div className="max-h-60 space-y-2 overflow-y-auto">
            {serverEntries.map(([id, server]) => (
              <div
                key={id}
                className="flex items-start justify-between rounded-lg border border-border p-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">
                      {server.name}
                    </span>
                    <Badge
                      variant={
                        server.state === "ready"
                          ? "primary"
                          : server.state === "failed"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {server.state}
                    </Badge>
                  </div>
                  <span className="mt-0.5 block truncate font-mono text-xs text-muted-foreground">
                    {server.server_url}
                  </span>
                  {server.state === "failed" && server.error && (
                    <span className="mt-0.5 block text-xs text-red-500">{server.error}</span>
                  )}
                </div>
                <div className="ml-2 flex shrink-0 items-center gap-1">
                  {server.state === "authenticating" && server.auth_url && (
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<SignInIcon size={12} />}
                      onClick={() =>
                        window.open(server.auth_url as string, "oauth", "width=600,height=800")
                      }
                    >
                      Auth
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    shape="square"
                    aria-label="Remove server"
                    icon={<TrashIcon size={12} />}
                    onClick={() => onRemoveServer(id)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {toolCount > 0 && (
          <div className="border-t border-border pt-2">
            <div className="flex items-center gap-2">
              <WrenchIcon size={14} className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {toolCount} tool{toolCount !== 1 ? "s" : ""} available from MCP servers
              </span>
            </div>
          </div>
        )}
      </Surface>
    </div>
  );
}
