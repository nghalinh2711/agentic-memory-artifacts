"use client";

import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  IconButton,
  Divider,
  TextField,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import { useState } from "react";
import type { Conversation } from "@/lib/types";

export interface ConversationSidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, name: string) => void;
}

function getPreview(messages: Conversation["messages"]): string {
  const last = messages[messages.length - 1];
  if (!last) return "Empty conversation";
  return last.content.length > 60
    ? last.content.slice(0, 60) + "..."
    : last.content;
}

export default function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onDelete,
  onNew,
  onRename,
}: ConversationSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const startRename = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  };

  const commitRename = () => {
    if (editingId && editName.trim()) {
      onRename(editingId, editName.trim());
    }
    setEditingId(null);
  };

  const cancelRename = () => {
    setEditingId(null);
  };

  return (
    <Box sx={{ width: 280, borderRight: 1, borderColor: "divider", display: "flex", flexDirection: "column" }}>
      <Box sx={{ p: 2, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="h6">Conversations</Typography>
        <IconButton onClick={onNew} size="small" color="primary" aria-label="New conversation">
          <AddIcon />
        </IconButton>
      </Box>
      <Divider />
      {conversations.length === 0 && (
        <Typography color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
          No conversations yet
        </Typography>
      )}
      <List sx={{ flex: 1, overflowY: "auto" }}>
        {conversations.map((conv) => (
          <ListItemButton
            key={conv.id}
            selected={conv.id === activeId}
            onClick={() => onSelect(conv.id)}
            sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}
          >
            {editingId === conv.id ? (
              <Box sx={{ display: "flex", alignItems: "center", width: "100%" }}>
                <TextField
                  size="small"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") cancelRename();
                  }}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                  fullWidth
                />
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); commitRename(); }} color="primary">
                  <CheckIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); cancelRename(); }}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            ) : (
              <>
                <ListItemText
                  primary={conv.name || conv.collectionName}
                  secondary={getPreview(conv.messages)}
                  primaryTypographyProps={{ fontWeight: conv.id === activeId ? 700 : 400, fontSize: 14 }}
                  secondaryTypographyProps={{ fontSize: 12, noWrap: true }}
                />
                <Box sx={{ position: "absolute", right: 4, top: 4, display: "flex" }}>
                  <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); startRename(conv.id, conv.name || conv.collectionName); }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              </>
            )}
          </ListItemButton>
        ))}
      </List>
    </Box>
  );
}
