"use client";

import { useParams } from "next/navigation";
import { CollabDocEditor } from "@/components/collab-doc-editor/collab-doc-editor";

export default function CollabDocumentEditorPage() {
  const params = useParams<{ chatId: string }>();
  const chatId = params.chatId;

  if (!chatId || typeof chatId !== "string") {
    return (
      <p className="p-6 text-destructive">Invalid document link.</p>
    );
  }

  return <CollabDocEditor chatId={chatId} />;
}
