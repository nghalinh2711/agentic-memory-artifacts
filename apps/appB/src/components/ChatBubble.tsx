import { Paper, Typography } from "@mui/material";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "@/lib/types";

export interface ChatBubbleProps {
  message: ChatMessage;
}

const isUserMsg = (msg: ChatMessage) => msg.role === "user";
const hasSources = (msg: ChatMessage) => msg.role === "assistant" && msg.sources && msg.sources.length > 0;

export default function ChatBubble({ message }: ChatBubbleProps) {
  const user = isUserMsg(message);
  const showSources = hasSources(message);

  return (
    <Paper elevation={1} sx={{ p: 2, mb: 1, maxWidth: "80%", alignSelf: user ? "flex-end" : "flex-start", bgcolor: user ? "primary.main" : "grey.100", color: user ? "white" : "text.primary", borderRadius: 2 }}>
      {user ? (<Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{message.content}</Typography>) : (<Markdown remarkPlugins={[remarkGfm]}>{message.content}</Markdown>)}
      {showSources && (<Typography variant="caption" sx={{ mt: 0.5, display: "block", opacity: 0.7 }}>Sources: {message.sources!.map((s) => s.chunk.metadata.sourceFilename).join(", ")}</Typography>)}
    </Paper>
  );
}
