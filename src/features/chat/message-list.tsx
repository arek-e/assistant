import { isToolUIPart, type UIMessage } from "ai";
import { code } from "@streamdown/code";
import { Streamdown } from "streamdown";
import {
  BrainIcon,
  CaretDownIcon,
  ChatCircleDotsIcon
} from "@/components/app/icons";
import { Button, Empty } from "@/components/app/ui";
import { ToolPartView } from "@/features/tools/tool-part-view";

const starterPrompts = [
  "What's the weather in Paris?",
  "What timezone am I in?",
  "Calculate 5000 * 3",
  "Remind me in 5 minutes to take a break"
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
        icon={<ChatCircleDotsIcon size={32} />}
        title="Start a conversation"
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

  return (
    <div className="space-y-2">
      {showDebug && (
        <pre className="text-[11px] text-muted-foreground bg-muted rounded-lg p-3 overflow-auto max-h-64">
          {JSON.stringify(message, null, 2)}
        </pre>
      )}

      {message.parts.filter(isToolUIPart).map((part) => (
        <ToolPartView
          key={part.toolCallId}
          part={part}
          addToolApprovalResponse={addToolApprovalResponse}
        />
      ))}

      {message.parts
        .filter(
          (part) =>
            part.type === "reasoning" &&
            (part as { text?: string }).text?.trim()
        )
        .map((part, index) => (
          <ReasoningPart
            key={index}
            part={
              part as {
                type: "reasoning";
                text: string;
                state?: "streaming" | "done";
              }
            }
            isStreaming={isStreaming}
          />
        ))}

      {message.parts
        .filter(
          (part): part is Extract<typeof part, { type: "file" }> =>
            part.type === "file" &&
            (part as { mediaType?: string }).mediaType?.startsWith("image/") ===
              true
        )
        .map((part, index) => (
          <div
            key={`file-${index}`}
            className={`flex ${isUser ? "justify-end" : "justify-start"}`}
          >
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
            isUser={isUser}
            isAnimating={isLastAssistant && isStreaming}
          />
        ))}
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
    <div className="flex justify-start">
      <details className="max-w-[85%] w-full" open={!isDone}>
        <summary className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-sm select-none">
          <BrainIcon size={14} className="text-purple-400" />
          <span className="font-medium text-foreground">Reasoning</span>
          {isDone ? (
            <span className="text-xs text-success">Complete</span>
          ) : (
            <span className="text-xs text-primary">Thinking...</span>
          )}
          <CaretDownIcon size={14} className="ml-auto text-muted-foreground" />
        </summary>
        <pre className="mt-2 px-3 py-2 rounded-lg bg-muted text-xs text-foreground whitespace-pre-wrap overflow-auto max-h-64">
          {part.text}
        </pre>
      </details>
    </div>
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
        <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md bg-primary text-primary-foreground leading-relaxed">
          {text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-card text-foreground leading-relaxed">
        <Streamdown
          className="sd-theme rounded-2xl rounded-bl-md p-3"
          plugins={{ code }}
          controls={false}
          isAnimating={isAnimating}
        >
          {text}
        </Streamdown>
      </div>
    </div>
  );
}
