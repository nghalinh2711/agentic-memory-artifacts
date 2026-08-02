"use client";

import { Box, Typography, Button, CircularProgress, Chip } from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DescriptionIcon from "@mui/icons-material/Description";
import { useState, useCallback, useEffect, useRef } from "react";
import ChatWindow from "@/components/ChatWindow";
import ConversationSidebar from "@/components/ConversationSidebar";
import FileUpload from "@/components/FileUpload";
import { createCollectionManager } from "@/lib/collectionManager";
import { createConversationStore } from "@/lib/conversationStore";
import type { CollectionManager, ConversationStore, Conversation, ChatMessage } from "@/lib/types";

const DEFAULT_COLLECTION = "Default";

function UploadedFileChips({ files, onDelete }: { files: string[]; onDelete: (f: string) => void }) {
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, p: 2, borderBottom: 1, borderColor: "divider", bgcolor: "grey.50" }}>
      <Typography variant="overline" sx={{ width: "100%", mb: 0.5 }}>Uploaded documents</Typography>
      {files.map((file) => (<Chip key={file} icon={<DescriptionIcon />} label={file} onDelete={() => onDelete(file)} size="small" variant="outlined" />))}
    </Box>
  );
}

export default function Home() {
  const [collectionManager] = useState<CollectionManager>(createCollectionManager);
  const [conversationStore] = useState<ConversationStore>(createConversationStore);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeId;

  const activeConversation = conversations.find((c) => c.id === activeId) ?? null;

  const patchLocal = useCallback((id: string, patch: Partial<Conversation>) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c)));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    async function init() {
      try {
        collectionManager.getCollection(DEFAULT_COLLECTION) ?? collectionManager.createCollection(DEFAULT_COLLECTION);
        const all = await conversationStore.getAllConversations();
        if (!cancelled) { setConversations(all); setError(null); }
      } catch { if (!cancelled) setError("Failed to load conversations. Is the server running?"); }
      finally { if (!cancelled) setLoading(false); }
    }
    init();
    return () => { cancelled = true; };
  }, [collectionManager, conversationStore]);

  const handleSelect = useCallback((id: string) => setActiveId(id), []);
  const handleDelete = useCallback(async (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeIdRef.current === id) setActiveId(null);
    await conversationStore.deleteConversation(id);
  }, [conversationStore]);
  const handleNew = useCallback(async () => {
    const conv = await conversationStore.createConversation(DEFAULT_COLLECTION);
    setConversations((prev) => [conv, ...prev]);
    setActiveId(conv.id); setShowUpload(false);
  }, [conversationStore]);
  const handleRename = useCallback(async (id: string, name: string) => {
    const prev = conversations.find((c) => c.id === id);
    patchLocal(id, { name });
    try { await conversationStore.updateConversation(id, { name }); } catch { if (prev) patchLocal(id, { name: prev.name }); }
  }, [conversations, conversationStore, patchLocal]);

  const handleToggleUpload = useCallback(async () => {
    if (!activeIdRef.current) {
      const conv = await conversationStore.createConversation(DEFAULT_COLLECTION);
      setConversations((prev) => [conv, ...prev]); setActiveId(conv.id);
    }
    setShowUpload((v) => !v);
  }, [conversationStore]);

  const handleUploadSuccess = useCallback(async (filename: string) => {
    setShowUpload(false);
    const targetId = activeIdRef.current;
    if (!targetId) return;
    const conv = await conversationStore.getConversation(targetId);
    if (conv) {
      const currentFiles = conv.uploadedFiles ?? [];
      if (!currentFiles.includes(filename)) {
        const newFiles = [...currentFiles, filename];
        await conversationStore.updateConversation(targetId, { uploadedFiles: newFiles });
        patchLocal(targetId, { uploadedFiles: newFiles });
      }
    }
  }, [conversationStore, patchLocal]);

  const handleDeleteFile = useCallback(async (filename: string) => {
    const targetId = activeIdRef.current;
    if (!targetId || !activeConversation) return;
    const updated = (activeConversation.uploadedFiles ?? []).filter((f) => f !== filename);
    patchLocal(targetId, { uploadedFiles: updated });
    await conversationStore.updateConversation(targetId, { uploadedFiles: updated });
    fetch(`/api/conversations/${targetId}/files?filename=${encodeURIComponent(filename)}`, { method: "DELETE" }).catch((e: unknown) => { console.error("Failed to delete file entries:", e); });
  }, [activeConversation, conversationStore, patchLocal]);

  const handleMessagesChange = useCallback(async (id: string, messages: ChatMessage[]): Promise<void> => {
    patchLocal(id, { messages });
    await conversationStore.updateConversation(id, { messages });
  }, [conversationStore, patchLocal]);

  if (loading) return (<Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}><CircularProgress /></Box>);

  const files = activeConversation?.uploadedFiles ?? [];

  return (
    <Box sx={{ display: "flex", height: "100vh" }}>
      <ConversationSidebar conversations={conversations} activeId={activeId} onSelect={handleSelect} onDelete={handleDelete} onNew={handleNew} onRename={handleRename} />
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 3, py: 2, borderBottom: 1, borderColor: "divider" }}>
          <Typography variant="h4">AI Chatbot RAG</Typography>
          <Button variant="contained" startIcon={<CloudUploadIcon />} onClick={handleToggleUpload} size="small">Upload</Button>
        </Box>
        {error && <Typography color="error" sx={{ p: 2, textAlign: "center" }}>{error}</Typography>}
        {showUpload && (<Box sx={{ p: 3, borderBottom: 1, borderColor: "divider" }}><FileUpload onUploadSuccess={handleUploadSuccess} conversationId={activeId || ""} /></Box>)}
        {activeId && activeConversation ? (
          <>
            {files.length > 0 && <UploadedFileChips files={files} onDelete={handleDeleteFile} />}
            <ChatWindow key={activeId} collectionName={activeConversation.name || DEFAULT_COLLECTION} conversationId={activeId} initialMessages={activeConversation.messages} onMessagesChange={handleMessagesChange} />
          </>
        ) : (
          <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", p: 4 }}>
            <Typography variant="h3" sx={{ mb: 2 }}>Welcome</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>Upload a document or start a new conversation to begin chatting.</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
