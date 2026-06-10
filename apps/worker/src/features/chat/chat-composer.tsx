import type { ClipboardEvent, RefObject } from "react";

import { PaperclipIcon, PaperPlaneRightIcon, StopIcon, XIcon } from "@/components/app/icons";
import { Button, InputArea } from "@/components/app/ui";
import type { Attachment } from "@/features/attachments/attachments";

export function ChatComposer({
  input,
  attachments,
  connected,
  isStreaming,
  textareaRef,
  fileInputRef,
  onInputChange,
  onSend,
  onStop,
  onAddFiles,
  onPaste,
  onRemoveAttachment
}: {
  input: string;
  attachments: Attachment[];
  connected: boolean;
  isStreaming: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  onAddFiles: (files: FileList | File[]) => void;
  onPaste: (event: ClipboardEvent) => void;
  onRemoveAttachment: (id: string) => void;
}) {
  return (
    <div className="border-t border-border bg-card">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSend();
        }}
        className="mx-auto max-w-3xl px-5 py-4"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          aria-label="Upload image attachments"
          className="hidden"
          onChange={(event) => {
            if (event.target.files) onAddFiles(event.target.files);
            event.target.value = "";
          }}
        />

        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="group relative overflow-hidden rounded-lg border border-border bg-muted"
              >
                <img
                  src={attachment.preview}
                  alt={attachment.file.name}
                  className="h-16 w-16 object-cover"
                />
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(attachment.id)}
                  className="absolute top-0.5 right-0.5 rounded-full bg-primary/80 p-0.5 text-primary-foreground opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label={`Remove ${attachment.file.name}`}
                >
                  <XIcon size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-3 rounded-xl border border-border bg-card p-3 shadow-sm transition-shadow focus-within:border-transparent focus-within:ring-2 focus-within:ring-ring">
          <Button
            type="button"
            variant="ghost"
            shape="square"
            aria-label="Attach images"
            icon={<PaperclipIcon size={18} />}
            onClick={() => fileInputRef.current?.click()}
            disabled={!connected || isStreaming}
            className="mb-0.5"
          />
          <InputArea
            ref={textareaRef}
            value={input}
            onValueChange={onInputChange}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSend();
              }
            }}
            onInput={(event) => {
              const el = event.currentTarget;
              el.style.height = "auto";
              el.style.height = `${el.scrollHeight}px`;
            }}
            onPaste={onPaste}
            placeholder={
              attachments.length > 0 ? "Add a message or send images..." : "Send a message..."
            }
            disabled={!connected || isStreaming}
            rows={1}
            className="max-h-40 flex-1 resize-none bg-transparent! shadow-none! ring-0! outline-none! focus:ring-0!"
          />
          {isStreaming ? (
            <Button
              type="button"
              variant="secondary"
              shape="square"
              aria-label="Stop generation"
              icon={<StopIcon size={18} />}
              onClick={onStop}
              className="mb-0.5"
            />
          ) : (
            <Button
              type="submit"
              variant="primary"
              shape="square"
              aria-label="Send message"
              disabled={(!input.trim() && attachments.length === 0) || !connected}
              icon={<PaperPlaneRightIcon size={18} />}
              className="mb-0.5"
            />
          )}
        </div>
      </form>
    </div>
  );
}
