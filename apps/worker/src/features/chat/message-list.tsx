import { getToolName, isToolUIPart, type UIMessage } from "ai";
import { code } from "@streamdown/code";
import { Streamdown } from "streamdown";
import {
  BrainIcon,
  CaretDownIcon,
  CheckCircleIcon,
  GearIcon,
  WrenchIcon,
  XCircleIcon
} from "@/components/app/icons";
import { Badge, Button, Empty } from "@/components/app/ui";
import type { AgentVisualState } from "@/features/avatar/agent-avatar";
import {
  ActivityCard,
  ActivityCodeBlock,
  ActivityDisclosure,
  ActivityMeta,
  ActivityTitle,
  ActivityTray,
  AssistantTimeline,
  DisclosureCaret,
  TimelineNode,
  WorkSummary
} from "@/features/chat/ui/assistant-timeline";

const starterPrompts = [
  "What do you remember about this project?",
  "What tools can you use here?",
  "Search memory for current UI decisions",
  "Record a proposed decision for this assistant"
];

export function MessageList({
  messages,
  showDebug,
  isStreaming,
  onStarterPrompt,
  addToolApprovalResponse
}: {
  messages: UIMessage[];
  showDebug: boolean;
  isStreaming: boolean;
  onStarterPrompt: (prompt: string) => void;
  addToolApprovalResponse: (response: {
    id: string;
    approved: boolean;
  }) => void;
}) {
  if (messages.length === 0) {
    return (
      <Empty
        icon={<BrainIcon size={32} />}
        title="Start thinking"
        contents={
          <div className="flex flex-wrap justify-center gap-2">
            {starterPrompts.map((prompt) => (
              <Button
                key={prompt}
                variant="outline"
                size="sm"
                disabled={isStreaming}
                onClick={() => onStarterPrompt(prompt)}
              >
                {prompt}
              </Button>
            ))}
          </div>
        }
      />
    );
  }

  return (
    <>
      {messages.map((message, index) => (
        <MessageView
          key={message.id}
          message={message}
          showDebug={showDebug}
          isStreaming={isStreaming}
          isLastAssistant={
            message.role === "assistant" && index === messages.length - 1
          }
          addToolApprovalResponse={addToolApprovalResponse}
        />
      ))}
    </>
  );
}

function MessageView({
  message,
  showDebug,
  isStreaming,
  isLastAssistant,
  addToolApprovalResponse
}: {
  message: UIMessage;
  showDebug: boolean;
  isStreaming: boolean;
  isLastAssistant: boolean;
  addToolApprovalResponse: (response: {
    id: string;
    approved: boolean;
  }) => void;
}) {
  const isUser = message.role === "user";
  const avatarState = getAssistantAvatarState(
    message,
    isLastAssistant,
    isStreaming
  );

  return (
    <div className="space-y-2">
      {showDebug && (
        <pre className="text-[11px] text-muted-foreground bg-muted rounded-lg p-3 overflow-auto max-h-64">
          {JSON.stringify(message, null, 2)}
        </pre>
      )}

      {isUser ? (
        <UserMessageParts message={message} />
      ) : (
        <AssistantRun
          message={message}
          avatarState={avatarState}
          isStreaming={isLastAssistant && isStreaming}
          addToolApprovalResponse={addToolApprovalResponse}
        />
      )}
    </div>
  );
}

function getAssistantAvatarState(
  message: UIMessage,
  isLastAssistant: boolean,
  isStreaming: boolean
): AgentVisualState {
  if (message.role !== "assistant") return "idle";

  const hasRejectedTool = message.parts.some(
    (part) =>
      isToolUIPart(part) &&
      (part.state === "output-denied" ||
        ("approval" in part &&
          (part.approval as { approved?: boolean })?.approved === false))
  );
  if (hasRejectedTool) return "error";

  const hasRunningTool = message.parts.some(
    (part) =>
      isToolUIPart(part) &&
      (part.state === "input-available" ||
        part.state === "input-streaming" ||
        part.state === "approval-requested")
  );
  if (hasRunningTool) return "tool";

  const hasStreamingReasoning = message.parts.some(
    (part) =>
      part.type === "reasoning" &&
      (part as { state?: string }).state === "streaming"
  );
  if (hasStreamingReasoning) return "thinking";

  if (isLastAssistant && isStreaming) return "speaking";
  return "idle";
}

function UserMessageParts({ message }: { message: UIMessage }) {
  return (
    <>
      {message.parts
        .filter(
          (part): part is Extract<typeof part, { type: "file" }> =>
            part.type === "file" &&
            (part as { mediaType?: string }).mediaType?.startsWith("image/") ===
              true
        )
        .map((part, index) => (
          <div key={`file-${index}`} className="flex justify-end">
            <img
              src={part.url}
              alt="Attachment"
              className="max-h-64 rounded-xl border border-border object-contain"
            />
          </div>
        ))}

      {message.parts
        .filter((part) => part.type === "text")
        .map((part, index) => (
          <TextPart
            key={index}
            text={(part as { type: "text"; text: string }).text}
            isUser
            isAnimating={false}
          />
        ))}
    </>
  );
}

function AssistantRun({
  message,
  avatarState,
  isStreaming,
  addToolApprovalResponse
}: {
  message: UIMessage;
  avatarState: AgentVisualState;
  isStreaming: boolean;
  addToolApprovalResponse: (response: {
    id: string;
    approved: boolean;
  }) => void;
}) {
  const renderActivityNodes = (showDot: boolean) =>
    message.parts
      .map((part, index) => {
        if (isToolUIPart(part)) {
          return (
            <TimelineNode
              key={part.toolCallId}
              variant={toolNodeVariant(part)}
              showDot={showDot}
            >
              <ToolTimelinePart
                part={part}
                addToolApprovalResponse={addToolApprovalResponse}
              />
            </TimelineNode>
          );
        }

        if (
          part.type === "reasoning" &&
          (part as { text?: string }).text?.trim()
        ) {
          return (
            <TimelineNode
              key={`reasoning-${index}`}
              variant="thinking"
              showDot={showDot}
            >
              <ReasoningPart
                part={
                  part as {
                    type: "reasoning";
                    text: string;
                    state?: "streaming" | "done";
                  }
                }
                isStreaming={isStreaming}
              />
            </TimelineNode>
          );
        }

        if (
          part.type === "file" &&
          (part as { mediaType?: string }).mediaType?.startsWith("image/") ===
            true
        ) {
          const filePart = part as Extract<typeof part, { type: "file" }>;
          return (
            <TimelineNode
              key={`file-${index}`}
              variant="idle"
              showDot={showDot}
            >
              <img
                src={filePart.url}
                alt="Attachment"
                className="max-h-64 rounded-xl border border-border object-contain"
              />
            </TimelineNode>
          );
        }

        if (part.type === "text") {
          return null;
        }

        return null;
      })
      .filter(Boolean);

  const activityNodes = renderActivityNodes(true);

  const finalNodes = message.parts
    .map((part, index) => {
      if (part.type === "text") {
        return (
          <TimelineNode key={`text-${index}`} variant="speaking">
            <TextPart
              text={(part as { type: "text"; text: string }).text}
              isUser={false}
              isAnimating={isStreaming}
            />
          </TimelineNode>
        );
      }

      return null;
    })
    .filter(Boolean);

  const shouldCollapseActivity = !isStreaming && activityNodes.length > 0;
  const nodes = shouldCollapseActivity
    ? [
        <TimelineNode key="work-summary" variant="success">
          <ActivityDisclosure
            defaultOpen={false}
            header={(open) => (
              <>
                <ActivityTitle>
                  <span className="font-medium text-foreground">
                    Completed in {activityNodes.length} step
                    {activityNodes.length === 1 ? "" : "s"}
                  </span>
                  <DisclosureCaret open={open}>
                    <CaretDownIcon size={13} />
                  </DisclosureCaret>
                </ActivityTitle>
              </>
            )}
          >
            <WorkSummary>{renderActivityNodes(false)}</WorkSummary>
          </ActivityDisclosure>
        </TimelineNode>,
        ...finalNodes
      ]
    : [...activityNodes, ...finalNodes];

  if (nodes.length === 0) return null;

  return (
    <AssistantTimeline avatarState={avatarState}>{nodes}</AssistantTimeline>
  );
}

function toolNodeVariant(
  part: UIMessage["parts"][number]
): "tool" | "success" | "error" {
  if (!isToolUIPart(part)) return "tool";
  if (
    part.state === "output-denied" ||
    ("approval" in part &&
      (part.approval as { approved?: boolean })?.approved === false)
  ) {
    return "error";
  }
  if (part.state === "output-available") return "success";
  return "tool";
}

function ToolTimelinePart({
  part,
  addToolApprovalResponse
}: {
  part: UIMessage["parts"][number];
  addToolApprovalResponse: (response: {
    id: string;
    approved: boolean;
  }) => void;
}) {
  if (!isToolUIPart(part)) return null;

  const toolName = getToolName(part);
  const approvalId =
    "approval" in part ? (part.approval as { id?: string })?.id : undefined;

  if (part.state === "output-available") {
    return (
      <ActivityDisclosure
        defaultOpen={false}
        header={(open) => (
          <>
            <ActivityTitle>
              <GearIcon size={14} className="text-muted-foreground" />
              <span className="truncate font-medium">{toolName}</span>
              <DisclosureCaret open={open}>
                <CaretDownIcon size={13} />
              </DisclosureCaret>
            </ActivityTitle>
          </>
        )}
      >
        <ActivityTray>
          <ActivityCodeBlock>
            {JSON.stringify(part.output, null, 2)}
          </ActivityCodeBlock>
        </ActivityTray>
      </ActivityDisclosure>
    );
  }

  if ("approval" in part && part.state === "approval-requested") {
    return (
      <ActivityCard approval>
        <div className="flex min-h-9 w-fit max-w-full items-center justify-start gap-[0.55rem] py-[0.2rem] text-xs text-foreground">
          <ActivityTitle>
            <WrenchIcon size={14} className="text-warning" />
            <span className="truncate font-medium">Approval: {toolName}</span>
          </ActivityTitle>
          <Badge variant="secondary">Waiting</Badge>
        </div>
        <ActivityTray>
          <ActivityCodeBlock>
            {JSON.stringify(part.input, null, 2)}
          </ActivityCodeBlock>
          <div className="mt-2 flex gap-2">
            <Button
              variant="primary"
              size="sm"
              icon={<CheckCircleIcon size={14} />}
              onClick={() => {
                if (approvalId) {
                  addToolApprovalResponse({ id: approvalId, approved: true });
                }
              }}
            >
              Approve
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<XCircleIcon size={14} />}
              onClick={() => {
                if (approvalId) {
                  addToolApprovalResponse({ id: approvalId, approved: false });
                }
              }}
            >
              Reject
            </Button>
          </div>
        </ActivityTray>
      </ActivityCard>
    );
  }

  if (
    part.state === "output-denied" ||
    ("approval" in part &&
      (part.approval as { approved?: boolean })?.approved === false)
  ) {
    return (
      <ActivityCard>
        <div className="flex min-h-9 w-fit max-w-full items-center justify-start gap-[0.55rem] py-[0.2rem] text-xs text-foreground">
          <ActivityTitle>
            <XCircleIcon size={14} className="text-destructive" />
            <span className="truncate font-medium">{toolName}</span>
          </ActivityTitle>
          <Badge variant="secondary">Rejected</Badge>
        </div>
      </ActivityCard>
    );
  }

  if (part.state === "input-available" || part.state === "input-streaming") {
    return (
      <ActivityCard>
        <div className="flex min-h-9 w-fit max-w-full items-center justify-start gap-[0.55rem] py-[0.2rem] text-xs text-foreground">
          <ActivityTitle>
            <GearIcon
              size={14}
              className="animate-spin text-muted-foreground"
            />
            <span className="truncate font-medium">Running {toolName}</span>
          </ActivityTitle>
          <Badge variant="secondary">Active</Badge>
        </div>
      </ActivityCard>
    );
  }

  return null;
}

function ReasoningPart({
  part,
  isStreaming
}: {
  part: { type: "reasoning"; text: string; state?: "streaming" | "done" };
  isStreaming: boolean;
}) {
  const isDone = part.state === "done" || !isStreaming;

  return (
    <ActivityDisclosure
      defaultOpen={!isDone}
      header={(open) => (
        <>
          <ActivityTitle>
            <BrainIcon size={14} className="text-muted-foreground" />
            <span className="font-medium text-foreground">Reasoning</span>
            <DisclosureCaret open={open}>
              <CaretDownIcon size={13} />
            </DisclosureCaret>
          </ActivityTitle>
          {!isDone && (
            <ActivityMeta>
              <span className="text-xs text-primary">Thinking...</span>
            </ActivityMeta>
          )}
        </>
      )}
    >
      <ActivityTray>
        <ActivityCodeBlock>{part.text}</ActivityCodeBlock>
      </ActivityTray>
    </ActivityDisclosure>
  );
}

function TextPart({
  text,
  isUser,
  isAnimating
}: {
  text: string;
  isUser: boolean;
  isAnimating: boolean;
}) {
  if (!text) return null;

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 leading-relaxed text-primary-foreground">
          {text}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-card leading-relaxed text-foreground">
      <Streamdown
        className="sd-theme rounded-2xl rounded-bl-md px-0 py-3"
        plugins={{ code }}
        controls={false}
        isAnimating={isAnimating}
      >
        {text}
      </Streamdown>
    </div>
  );
}
