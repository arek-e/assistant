import type { MCPServersState } from "agents";

import {
  PlugsConnectedIcon,
  PlusIcon,
  SignInIcon,
  TrashIcon,
  WrenchIcon,
  XIcon
} from "@/components/app/icons";
import { Badge, Button, Input, Surface, Text } from "@/components/app/ui";

export function McpPanel({
  embedded = false,
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
  embedded?: boolean;
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

  const content = (
    <Surface
      variant={embedded ? "glass" : "solid"}
      className={embedded ? "space-y-4 p-4" : "space-y-4 rounded-xl p-4 ring ring-border"}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PlugsConnectedIcon size={16} className="text-primary" />
          <Text size="sm" bold>
            MCP Servers
          </Text>
          {serverEntries.length > 0 && <Badge variant="secondary">{serverEntries.length}</Badge>}
        </div>
        {!embedded && (
          <Button
            variant="ghost"
            size="sm"
            shape="square"
            aria-label="Close MCP panel"
            icon={<XIcon size={14} />}
            onClick={onClose}
          />
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          onAddServer();
        }}
        className="space-y-2"
      >
        <Input
          type="text"
          value={name}
          onValueChange={onNameChange}
          aria-label="MCP server name"
          placeholder="Server name"
        />
        <div className="flex gap-2">
          <Input
            type="text"
            value={url}
            onValueChange={onUrlChange}
            aria-label="MCP server URL"
            placeholder="https://mcp.example.com"
            className="flex-1"
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
  );

  if (embedded) return content;

  return <div className="absolute top-full right-0 z-50 mt-2 w-96">{content}</div>;
}
