"use client";

import { Box, TextField, IconButton, Typography, CircularProgress, Button } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import SummarizeIcon from "@mui/icons-material/Summarize";
import { useState, useRef, useEffect } from "react";
import ChatBubble from "./ChatBubble";
import type { ChatMessage } from "@/lib/types";

export interface ChatWindowProps {
  collectionName: string;
  conversationId: string;
  initialMessages: ChatMessage[];
  onMessagesChange: (conversationId: string, messages: ChatMessage[]) => Promise<void>;
}

const SUMMARIZE_QUERY = "Please provide a comprehensive summary of all the documents in this conversation. Cover key topics, main arguments, and important details.";

async function processStream(
  res: Response,
  messagesRef: { current: ChatMessage[] },
  setMessages: (msgs: ChatMessage[]) => void,
  save: (msgs: ChatMessage[]) => Promise<void>,
  setError: (err: string) => void,
): Promise<void> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");
  const decoder = new TextDecoder();
  const assistantMsg: ChatMessage = { role: "assistant", content: "" };
  setMessages([...messagesRef.current, assistantMsg]);
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6);
      if (payload === "[DONE]") {
        const final = [...messagesRef.current.slice(0, -1), { ...assistantMsg }];
        setMessages(final);
        try { await save(final); } catch { setError("Failed to save conversation. Your messages may be lost on refresh."); }
        return;
      }
      const event = JSON.parse(payload);
      if (event.error) throw new Error(event.error);
      if (event.token) {
        assistantMsg.content += event.token;
        setMessages([...messagesRef.current.slice(0, -1), { ...assistantMsg }]);
      }
      if (event.sources) {
        assistantMsg.sources = event.sources;
        setMessages([...messagesRef.current.slice(0, -1), { ...assistantMsg }]);
      }
    }
  }
}

export default function ChatWindow({ collectionName, conversationId, initialMessages, onMessagesChange }: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const cidRef = useRef(conversationId);
  cidRef.current = conversationId;

  useEffect(() => {
    const el = listRef.current;
    if (el && typeof el.scrollTo === "function") el.scrollTo(0, el.scrollHeight);
  }, [messages]);

  const save = async (msgs: ChatMessage[]) => { await onMessagesChange(cidRef.current, msgs); };

  const doSend = async (query: string) => {
    setLoading(true);
    setError(null);
    const withUser: ChatMessage[] = [...messagesRef.current, { role: "user", content: query }];
    setMessages(withUser);
    try { await save(withUser); } catch { setError("Failed to save message."); setLoading(false); return; }
    abortRef.current = new AbortController();
    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, conversationId, collectionName, stream: true }),
        signal: abortRef.current.signal,
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Chat failed");
      await processStream(res, messagesRef, setMessages, save, setError);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "An error occurred");
    } finally { setLoading(false); abortRef.current = null; }
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setInput("");
    await doSend(trimmed);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <Box ref={listRef} sx={{ flex: 1, overflowY: "auto", minHeight: 0, p: 2, px: { xs: 2, md: 4, lg: 6 }, display: "flex", flexDirection: "column", maxWidth: 900, width: "100%", mx: "auto" }}>
        {messages.length === 0 && <Typography color="text.secondary" textAlign="center" sx={{ mt: 4 }}>Start a conversation about documents in "{collectionName}"</Typography>}
        {messages.map((msg, i) => (<ChatBubble key={i} message={msg} />))}
        {loading && <CircularProgress size={24} sx={{ alignSelf: "center", my: 1 }} />}
        {error && <Typography color="error" textAlign="center" sx={{ my: 1 }}>{error}</Typography>}
      </Box>
      <Box sx={{ display: "flex", gap: 1, p: 2, px: { xs: 2, md: 4, lg: 6 }, borderTop: 1, borderColor: "divider", maxWidth: 900, width: "100%", mx: "auto", alignItems: "center" }}>
        <TextField fullWidth variant="outlined" placeholder="Ask a question about your documents..." value={input}
          onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          disabled={loading} size="small" />
        <Button variant="outlined" startIcon={<SummarizeIcon />} onClick={() => doSend(SUMMARIZE_QUERY)} disabled={loading} sx={{ whiteSpace: "nowrap", minWidth: "auto" }}>Summarize</Button>
        <IconButton color="primary" onClick={sendMessage} disabled={loading || !input.trim()}><SendIcon /></IconButton>
      </Box>
    </Box>
  );
}
