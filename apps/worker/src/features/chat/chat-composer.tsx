import type { ChangeEvent, ClipboardEvent, FormEvent, KeyboardEvent, RefObject } from "react";

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
  const controlsDisabled = !connected || isStreaming;
  const sendDisabled = getSendDisabled(input, attachments.length, connected);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <form onSubmit={(event) => handleComposerSubmit(event, onSend)} className="w-full">
        <HiddenImageInput fileInputRef={fileInputRef} onAddFiles={onAddFiles} />

        <AttachmentPreviewList attachments={attachments} onRemoveAttachment={onRemoveAttachment} />

        <div className="flex items-end gap-2 rounded-xl border border-border/90 bg-background p-2 shadow-[0_18px_55px_rgba(0,0,0,0.10),0_1px_0_rgba(0,0,0,0.03)] transition-shadow focus-within:border-neutral-300 focus-within:shadow-[0_22px_70px_rgba(0,0,0,0.14),0_0_0_1px_rgba(0,0,0,0.04)]">
          <AttachmentButton disabled={controlsDisabled} fileInputRef={fileInputRef} />
          <InputArea
            ref={textareaRef}
            value={input}
            onValueChange={onInputChange}
            onKeyDown={(event) => handleComposerKeyDown(event, onSend)}
            onInput={handleComposerInput}
            onPaste={onPaste}
            placeholder={getComposerPlaceholder(attachments.length)}
            disabled={controlsDisabled}
            rows={1}
            className="max-h-40 min-h-10 flex-1 resize-none bg-transparent! text-base leading-6 shadow-none! ring-0! outline-none! placeholder:text-neutral-300 focus:ring-0!"
          />
          <ComposerAction isStreaming={isStreaming} sendDisabled={sendDisabled} onStop={onStop} />
        </div>
      </form>
    </div>
  );
}

function HiddenImageInput({
  fileInputRef,
  onAddFiles
}: {
  fileInputRef: RefObject<HTMLInputElement | null>;
  onAddFiles: (files: FileList | File[]) => void;
}) {
  return (
    <input
      ref={fileInputRef}
      type="file"
      multiple
      accept="image/*"
      aria-label="Upload image attachments"
      className="hidden"
      onChange={(event) => handleFileInputChange(event, onAddFiles)}
    />
  );
}

function AttachmentPreviewList({
  attachments,
  onRemoveAttachment
}: {
  attachments: Attachment[];
  onRemoveAttachment: (id: string) => void;
}) {
  if (attachments.length === 0) return null;

  return (
    <div className="mb-2 flex flex-wrap gap-2">
      {attachments.map((attachment) => (
        <AttachmentPreview
          key={attachment.id}
          attachment={attachment}
          onRemoveAttachment={onRemoveAttachment}
        />
      ))}
    </div>
  );
}

function AttachmentPreview({
  attachment,
  onRemoveAttachment
}: {
  attachment: Attachment;
  onRemoveAttachment: (id: string) => void;
}) {
  return (
    <div className="group relative overflow-hidden rounded-lg border border-border bg-muted">
      <img src={attachment.preview} alt={attachment.file.name} className="h-16 w-16 object-cover" />
      <button
        type="button"
        onClick={() => onRemoveAttachment(attachment.id)}
        className="absolute top-0.5 right-0.5 rounded-full bg-primary/80 p-0.5 text-primary-foreground opacity-0 transition-opacity group-hover:opacity-100"
        aria-label={`Remove ${attachment.file.name}`}
      >
        <XIcon size={10} />
      </button>
    </div>
  );
}

function AttachmentButton({
  disabled,
  fileInputRef
}: {
  disabled: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      shape="square"
      aria-label="Attach images"
      icon={<PaperclipIcon size={18} />}
      onClick={() => fileInputRef.current?.click()}
      disabled={disabled}
      className="mb-0.5 text-muted-foreground"
    />
  );
}

function ComposerAction({
  isStreaming,
  sendDisabled,
  onStop
}: {
  isStreaming: boolean;
  sendDisabled: boolean;
  onStop: () => void;
}) {
  if (isStreaming) {
    return (
      <Button
        type="button"
        variant="secondary"
        shape="square"
        aria-label="Stop generation"
        icon={<StopIcon size={18} />}
        onClick={onStop}
        className="mb-0.5"
      />
    );
  }

  return (
    <Button
      type="submit"
      variant="primary"
      shape="square"
      aria-label="Send message"
      disabled={sendDisabled}
      icon={<PaperPlaneRightIcon size={18} />}
      className="mb-0.5"
    />
  );
}

function handleComposerSubmit(event: FormEvent<HTMLFormElement>, onSend: () => void) {
  event.preventDefault();
  onSend();
}

function handleFileInputChange(
  event: ChangeEvent<HTMLInputElement>,
  onAddFiles: (files: FileList | File[]) => void
) {
  const { files } = event.target;
  if (files) onAddFiles(files);
  event.target.value = "";
}

function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>, onSend: () => void) {
  if (event.key !== "Enter" || event.shiftKey) return;
  event.preventDefault();
  onSend();
}

function handleComposerInput(event: FormEvent<HTMLTextAreaElement>) {
  const element = event.currentTarget;
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight}px`;
}

function getComposerPlaceholder(attachmentCount: number) {
  return attachmentCount > 0 ? "Add a message or send images..." : "Ask Teampitch";
}

function getSendDisabled(input: string, attachmentCount: number, connected: boolean) {
  return (!input.trim() && attachmentCount === 0) || !connected;
}
