export interface Attachment {
  id: string;
  file: File;
  preview: string;
  mediaType: string;
}

export function createAttachment(file: File): Attachment {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    preview: URL.createObjectURL(file),
    mediaType: file.type || "application/octet-stream"
  };
}

export function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function imageFiles(files: FileList | File[]) {
  return Array.from(files).filter((file) => file.type.startsWith("image/"));
}

export function clipboardFiles(event: React.ClipboardEvent) {
  const items = event.clipboardData?.items;
  if (!items) return [];

  const files: File[] = [];
  for (const item of items) {
    if (item.kind === "file") {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }
  return files;
}

export function releaseAttachmentPreviews(attachments: Attachment[]) {
  for (const attachment of attachments) URL.revokeObjectURL(attachment.preview);
}
