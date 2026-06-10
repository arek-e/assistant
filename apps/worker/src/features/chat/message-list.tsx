import type { ReactNode } from "react";
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

type ToolActivityKind = "output" | "approval" | "rejected" | "running";

const assistantAvatarStateRules: Array<{
  state: AgentVisualState;
  matches: (parts: UIMessage["parts"]) => boolean;
}> = [
  { state: "error", matches: (parts) => parts.some(isRejectedToolPart) },
  { state: "tool", matches: (parts) => parts.some(isRunningToolPart) },
  {
    state: "thinking",
    matches: (parts) => parts.some(isStreamingReasoningPart)
  }
];

const toolActivityRules: Array<{
  kind: ToolActivityKind;
  matches: (part: UIMessage["parts"][number]) => boolean;
}> = [
  {
    kind: "output",
    matches: (part) => isToolUIPart(part) && part.state === "output-available"
  },
  {
    kind: "approval",
    matches: (part) =>
      isToolUIPart(part) &&
      "approval" in part &&
      part.state === "approval-requested"
  },
  { kind: "rejected", matches: isRejectedToolPart },
  {
    kind: "running",
    matches: (part) =>
      isToolUIPart(part) &&
      (part.state === "input-available" || part.state === "input-streaming")
  }
];

const starterPrompts = [
  "What do you remember about this project?",
  "What tools can you use here?",
  "Search memory for current UI decisions",
  "Record a proposed decision for this assistant"
];

export function MessageList({
  messages,
  isStreaming,
  onStarterPrompt,
  addToolApprovalResponse
}: {
  messages: UIMessage[];
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
  isStreaming,
  isLastAssistant,
  addToolApprovalResponse
}: {
  message: UIMessage;
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
  return (
    assistantAvatarStateRules.find((rule) => rule.matches(message.parts))
      ?.state ?? getFallbackAvatarState(isLastAssistant, isStreaming)
  );
}

function getFallbackAvatarState(
  isLastAssistant: boolean,
  isStreaming: boolean
): AgentVisualState {
  return isLastAssistant && isStreaming ? "speaking" : "idle";
}

function isRejectedToolPart(part: UIMessage["parts"][number]) {
  return isDeniedToolPart(part) || isRejectedApprovalPart(part);
}

function isDeniedToolPart(part: UIMessage["parts"][number]) {
  return isToolUIPart(part) && part.state === "output-denied";
}

function isRejectedApprovalPart(part: UIMessage["parts"][number]) {
  if (!isToolUIPart(part) || !("approval" in part)) return false;
  return (part.approval as { approved?: boolean })?.approved === false;
}

function isRunningToolPart(part: UIMessage["parts"][number]) {
  if (!isToolUIPart(part)) return false;
  return (
    part.state === "input-available" ||
    part.state === "input-streaming" ||
    part.state === "approval-requested"
  );
}

function isStreamingReasoningPart(part: UIMessage["parts"][number]) {
  return (
    part.type === "reasoning" &&
    (part as { state?: string }).state === "streaming"
  );
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
      .map((part, index) =>
        renderActivityPart({
          addToolApprovalResponse,
          index,
          isStreaming,
          part,
          showDot
        })
      )
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

function renderActivityPart({
  part,
  index,
  showDot,
  isStreaming,
  addToolApprovalResponse
}: {
  part: UIMessage["parts"][number];
  index: number;
  showDot: boolean;
  isStreaming: boolean;
  addToolApprovalResponse: (response: {
    id: string;
    approved: boolean;
  }) => void;
}) {
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

  if (isTextReasoningPart(part)) {
    return (
      <TimelineNode
        key={`reasoning-${index}`}
        variant="thinking"
        showDot={showDot}
      >
        <ReasoningPart part={part} isStreaming={isStreaming} />
      </TimelineNode>
    );
  }

  if (isImageFilePart(part)) {
    return (
      <TimelineNode key={`file-${index}`} variant="idle" showDot={showDot}>
        <img
          src={part.url}
          alt="Attachment"
          className="max-h-64 rounded-xl border border-border object-contain"
        />
      </TimelineNode>
    );
  }

  return null;
}

function isTextReasoningPart(
  part: UIMessage["parts"][number]
): part is { type: "reasoning"; text: string; state?: "streaming" | "done" } {
  return (
    part.type === "reasoning" &&
    Boolean((part as { text?: string }).text?.trim())
  );
}

function isImageFilePart(
  part: UIMessage["parts"][number]
): part is Extract<UIMessage["parts"][number], { type: "file" }> {
  return (
    part.type === "file" &&
    (part as { mediaType?: string }).mediaType?.startsWith("image/") === true
  );
}

function toolNodeVariant(
  part: UIMessage["parts"][number]
): "tool" | "success" | "error" {
  if (!isToolUIPart(part)) return "tool";
  if (isRejectedToolPart(part)) return "error";
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
  const activityKind = getToolActivityKind(part);

  return activityKind
    ? renderToolActivity({
        activityKind,
        addToolApprovalResponse,
        part,
        toolName
      })
    : null;
}

function getToolActivityKind(part: UIMessage["parts"][number]) {
  return toolActivityRules.find((rule) => rule.matches(part))?.kind;
}

function renderToolActivity({
  activityKind,
  part,
  toolName,
  addToolApprovalResponse
}: {
  activityKind: ToolActivityKind;
  part: UIMessage["parts"][number];
  toolName: string;
  addToolApprovalResponse: (response: {
    id: string;
    approved: boolean;
  }) => void;
}) {
  const renderers = {
    approval: () => (
      <ToolApprovalActivity
        approvalId={
          "approval" in part
            ? (part.approval as { id?: string })?.id
            : undefined
        }
        input={"input" in part ? part.input : undefined}
        toolName={toolName}
        addToolApprovalResponse={addToolApprovalResponse}
      />
    ),
    output: () => (
      <ToolOutputActivity
        output={"output" in part ? part.output : undefined}
        toolName={toolName}
      />
    ),
    rejected: () => <ToolRejectedActivity toolName={toolName} />,
    running: () => <ToolRunningActivity toolName={toolName} />
  } satisfies Record<ToolActivityKind, () => ReactNode>;

  return renderers[activityKind]();
}

function ToolOutputActivity({
  output,
  toolName
}: {
  output: unknown;
  toolName: string;
}) {
  return (
    <ActivityDisclosure
      defaultOpen={false}
      header={(open) => (
        <ActivityTitle>
          <GearIcon size={14} className="text-muted-foreground" />
          <span className="truncate font-medium">{toolName}</span>
          <DisclosureCaret open={open}>
            <CaretDownIcon size={13} />
          </DisclosureCaret>
        </ActivityTitle>
      )}
    >
      <ActivityTray>
        <ActivityCodeBlock>{JSON.stringify(output, null, 2)}</ActivityCodeBlock>
      </ActivityTray>
    </ActivityDisclosure>
  );
}

function ToolApprovalActivity({
  approvalId,
  input,
  toolName,
  addToolApprovalResponse
}: {
  approvalId?: string;
  input: unknown;
  toolName: string;
  addToolApprovalResponse: (response: {
    id: string;
    approved: boolean;
  }) => void;
}) {
  return (
    <ActivityCard approval>
      <ToolStatusRow
        icon={<WrenchIcon size={14} className="text-warning" />}
        label={`Approval: ${toolName}`}
        badge="Waiting"
      />
      <ActivityTray>
        <ActivityCodeBlock>{JSON.stringify(input, null, 2)}</ActivityCodeBlock>
        <ToolApprovalActions
          approvalId={approvalId}
          addToolApprovalResponse={addToolApprovalResponse}
        />
      </ActivityTray>
    </ActivityCard>
  );
}

function ToolRejectedActivity({ toolName }: { toolName: string }) {
  return (
    <ActivityCard>
      <ToolStatusRow
        icon={<XCircleIcon size={14} className="text-destructive" />}
        label={toolName}
        badge="Rejected"
      />
    </ActivityCard>
  );
}

function ToolRunningActivity({ toolName }: { toolName: string }) {
  return (
    <ActivityCard>
      <ToolStatusRow
        icon={
          <GearIcon size={14} className="animate-spin text-muted-foreground" />
        }
        label={`Running ${toolName}`}
        badge="Active"
      />
    </ActivityCard>
  );
}

function ToolStatusRow({
  icon,
  label,
  badge
}: {
  icon: ReactNode;
  label: string;
  badge: string;
}) {
  return (
    <div className="flex min-h-9 w-fit max-w-full items-center justify-start gap-[0.55rem] py-[0.2rem] text-xs text-foreground">
      <ActivityTitle>
        {icon}
        <span className="truncate font-medium">{label}</span>
      </ActivityTitle>
      <Badge variant="secondary">{badge}</Badge>
    </div>
  );
}

function ToolApprovalActions({
  approvalId,
  addToolApprovalResponse
}: {
  approvalId?: string;
  addToolApprovalResponse: (response: {
    id: string;
    approved: boolean;
  }) => void;
}) {
  const respond = (approved: boolean) => {
    if (!approvalId) return;
    addToolApprovalResponse({ id: approvalId, approved });
  };

  return (
    <div className="mt-2 flex gap-2">
      <Button
        variant="primary"
        size="sm"
        icon={<CheckCircleIcon size={14} />}
        onClick={() => respond(true)}
      >
        Approve
      </Button>
      <Button
        variant="secondary"
        size="sm"
        icon={<XCircleIcon size={14} />}
        onClick={() => respond(false)}
      >
        Reject
      </Button>
    </div>
  );
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
