"use client";

import { Box, Button, Paper, Typography, LinearProgress, Alert } from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from "react";

const ALLOWED_EXTENSIONS = [".pdf", ".txt", ".md", ".docx"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export interface FileUploadProps {
  onUploadSuccess: (filename: string) => void;
  conversationId: string;
}

type UploadStatus = "idle" | "uploading" | "success" | "error";

function getExtension(filename: string): string {
  const parts = filename.split(".");
  const ext = parts.length > 1 ? parts[parts.length - 1] : "";
  return "." + ext.toLowerCase();
}

function validateClientFile(file: File): string | null {
  const ext = getExtension(file.name);
  if (!ALLOWED_EXTENSIONS.includes(ext)) return "Unsupported format. Allowed: PDF, TXT, MD, DOCX";
  if (file.size === 0) return "File is empty";
  if (file.size > MAX_FILE_SIZE) return "File exceeds 5MB limit";
  return null;
}

export default function FileUpload({ onUploadSuccess, conversationId }: FileUploadProps) {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      setStatus("uploading");
      setErrorMessage("");
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("conversationId", conversationId);
        const response = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await response.json();
        if (!response.ok) {
          setStatus("error");
          setErrorMessage(data.error ?? "Upload failed");
          return;
        }
        setStatus("success");
        onUploadSuccess(data.filename);
      } catch {
        setStatus("error");
        setErrorMessage("Network error. Please try again.");
      }
    },
    [onUploadSuccess, conversationId],
  );

  const handleFile = useCallback(
    (file: File) => {
      const error = validateClientFile(file);
      if (error) {
        setStatus("error");
        setErrorMessage(error);
        return;
      }
      uploadFile(file);
    },
    [uploadFile],
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const triggerFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const borderColor = dragOver ? "primary.main" : "grey.400";

  return (
    <Paper
      variant="outlined"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={triggerFilePicker}
      sx={{
        p: 4, textAlign: "center", cursor: "pointer", borderColor,
        borderStyle: "dashed", borderWidth: 2, transition: "border-color 0.2s",
        "&:hover": { borderColor: "primary.main" },
      }}
    >
      <input ref={fileInputRef} type="file" accept={ALLOWED_EXTENSIONS.join(",")}
        onChange={handleInputChange} hidden data-testid="file-input" />
      <CloudUploadIcon sx={{ fontSize: 48, color: "primary.main", mb: 1 }} />
      <Typography variant="body1" gutterBottom>
        Drag and drop a file here, or click to browse
      </Typography>
      <Typography variant="caption" color="text.secondary">
        Supported: PDF, TXT, MD, DOCX (max 5MB)
      </Typography>
      {status === "uploading" && <Box sx={{ mt: 2 }}><LinearProgress /></Box>}
      {status === "success" && <Alert severity="success" sx={{ mt: 2 }}>File uploaded successfully!</Alert>}
      {status === "error" && <Alert severity="error" sx={{ mt: 2 }}>{errorMessage}</Alert>}
      <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
        <Button variant="contained"
          onClick={(e) => { e.stopPropagation(); triggerFilePicker(); }}>Browse Files</Button>
      </Box>
    </Paper>
  );
}
