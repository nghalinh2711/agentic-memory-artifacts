import { describe, expect, it } from "vitest";
import { render, screen } from "../helpers/test-utils";
import ChatBubble from "@/components/ChatBubble";
import type { ChatMessage } from "@/lib/types";

describe("ChatBubble", () => {
  it("renders user message with primary color", () => {
    const msg: ChatMessage = { role: "user", content: "Hello" };
    render(<ChatBubble message={msg} />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("renders assistant message", () => {
    const msg: ChatMessage = { role: "assistant", content: "Hi there!" };
    render(<ChatBubble message={msg} />);
    expect(screen.getByText("Hi there!")).toBeInTheDocument();
  });

  it("shows sources when provided", () => {
    const msg: ChatMessage = {
      role: "assistant",
      content: "Answer",
      sources: [
        { chunk: { text: "ctx", metadata: { sourceFilename: "doc.pdf", chunkIndex: 0, totalChunks: 1 } }, score: 0.9 },
      ],
    };
    render(<ChatBubble message={msg} />);
    expect(screen.getByText(/doc\.pdf/)).toBeInTheDocument();
  });

  it("does not show sources section when empty", () => {
    const msg: ChatMessage = { role: "assistant", content: "Answer", sources: [] };
    render(<ChatBubble message={msg} />);
    expect(screen.queryByText(/Sources:/)).not.toBeInTheDocument();
  });

  it("does not show sources section when undefined", () => {
    const msg: ChatMessage = { role: "user", content: "Query" };
    render(<ChatBubble message={msg} />);
    expect(screen.queryByText(/Sources:/)).not.toBeInTheDocument();
  });
});
