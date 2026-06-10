import { describe, expect, test } from "bun:test";

import { imageFiles, releaseAttachmentPreviews, type Attachment } from "./attachments";

describe("attachment helpers", () => {
  test("keeps only image files", () => {
    const png = new File(["image"], "image.png", { type: "image/png" });
    const text = new File(["text"], "notes.txt", { type: "text/plain" });

    expect(imageFiles([png, text])).toEqual([png]);
  });

  test("releases preview object urls", () => {
    const revoked: string[] = [];
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.revokeObjectURL = (url: string) => revoked.push(url);

    const attachments: Attachment[] = [
      {
        id: "attachment-1",
        file: new File(["image"], "image.png", { type: "image/png" }),
        preview: "blob:preview-1",
        mediaType: "image/png"
      }
    ];

    try {
      releaseAttachmentPreviews(attachments);
      expect(revoked).toEqual(["blob:preview-1"]);
    } finally {
      URL.revokeObjectURL = originalRevokeObjectURL;
    }
  });
});
