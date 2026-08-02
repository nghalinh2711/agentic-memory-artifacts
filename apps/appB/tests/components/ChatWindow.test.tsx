import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "../helpers/test-utils";
import userEvent from "@testing-library/user-event";
import ChatWindow from "@/components/ChatWindow";

const mockOnMessagesChange = vi.fn().mockResolvedValue(undefined);

const defaultProps = {
  collectionName: "docs",
  conversationId: "conv-1",
  initialMessages: [],
  onMessagesChange: mockOnMessagesChange,
};

function renderChat(props = {}) {
  return render(<ChatWindow {...defaultProps} {...props} />);
}

describe("ChatWindow", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    mockOnMessagesChange.mockClear();
    mockOnMessagesChange.mockResolvedValue(undefined);
  });

  it("renders the empty state message with collection name", () => {
    renderChat({ collectionName: "test-collection" });
    expect(screen.getByText(/test-collection/)).toBeInTheDocument();
  });

  it("renders the text input field", () => {
    renderChat();
    expect(screen.getByPlaceholderText(/Ask a question/)).toBeInTheDocument();
  });

  it("renders the send button", () => {
    renderChat();
    const sendButton = screen.getByTestId("SendIcon").closest("button");
    expect(sendButton).toBeInTheDocument();
  });

  it("does not send empty message", () => {
    renderChat();
    const input = screen.getByPlaceholderText(/Ask a question/);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText(/Start a conversation/)).toBeInTheDocument();
  });

  it("sends message and shows user bubble", async () => {
    const onMessagesChange = vi.fn().mockResolvedValue(undefined);
    const encoder = new TextEncoder();
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"sources":[]}\n\n'));
        controller.enqueue(encoder.encode('data: {"token":"Hello"}\n\n'));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: true, body: mockStream }));
    renderChat({ onMessagesChange });
    const input = screen.getByPlaceholderText(/Ask a question/);
    await userEvent.type(input, "Hi");
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => {
      expect(screen.getByText("Hi")).toBeInTheDocument();
    });
    expect(onMessagesChange).toHaveBeenCalledWith(
      "conv-1",
      expect.arrayContaining([expect.objectContaining({ role: "user", content: "Hi" })]),
    );
  });

  it("saves user message before API call returns", async () => {
    const onMessagesChange = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise(() => {})));
    renderChat({ onMessagesChange });
    const input = screen.getByPlaceholderText(/Ask a question/);
    await userEvent.type(input, "Hi");
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => {
      expect(onMessagesChange).toHaveBeenCalledWith(
        "conv-1",
        expect.arrayContaining([expect.objectContaining({ role: "user", content: "Hi" })]),
      );
    });
  });

  it("shows error message on API failure", async () => {
    const onMessagesChange = vi.fn().mockResolvedValue(undefined);
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Server error" }),
    });
    vi.stubGlobal("fetch", mockFetch);
    renderChat({ onMessagesChange });
    const input = screen.getByPlaceholderText(/Ask a question/);
    await userEvent.type(input, "Query");
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });
  });

  it("shows generic error on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("Network down")));
    renderChat();
    const input = screen.getByPlaceholderText(/Ask a question/);
    await userEvent.type(input, "Query");
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => {
      expect(screen.getByText("Network down")).toBeInTheDocument();
    });
  });

  it("disables input while loading", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise(() => {})));
    renderChat();
    const input = screen.getByPlaceholderText(/Ask a question/);
    await userEvent.type(input, "Query");
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => {
      expect(input).toBeDisabled();
    });
  });

  it("handles streaming SSE response", async () => {
    const encoder = new TextEncoder();
    const chunks = [
      encoder.encode('data: {"sources":[]}\n\n'),
      encoder.encode('data: {"token":"Hello"}\n\n'),
      encoder.encode('data: {"token":" world"}\n\n'),
      encoder.encode("data: [DONE]\n\n"),
    ];
    let chunkIndex = 0;
    const mockStream = new ReadableStream({
      pull(controller) {
        if (chunkIndex < chunks.length) {
          controller.enqueue(chunks[chunkIndex++]);
        } else {
          controller.close();
        }
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({
      ok: true,
      body: mockStream,
    }));
    renderChat();
    const input = screen.getByPlaceholderText(/Ask a question/);
    await userEvent.type(input, "Query");
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => {
      expect(screen.getByText("Hello world")).toBeInTheDocument();
    });
  });

  it("handles stream disconnection gracefully", async () => {
    const encoder = new TextEncoder();
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"sources":[]}\n\n'));
        controller.error(new Error("Connection lost"));
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({
      ok: true,
      body: mockStream,
    }));
    renderChat();
    const input = screen.getByPlaceholderText(/Ask a question/);
    await userEvent.type(input, "Query");
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => {
      expect(screen.getByText(/Connection lost/)).toBeInTheDocument();
    });
  });

  it("renders Summarize button", () => {
    renderChat();
    expect(screen.getByText("Summarize")).toBeInTheDocument();
  });

  it("sends summarize query when button is clicked", async () => {
    const encoder = new TextEncoder();
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"sources":[]}\n\n'));
        controller.enqueue(encoder.encode('data: {"token":"Summary"}\n\n'));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: true, body: mockStream }));
    renderChat();
    fireEvent.click(screen.getByText("Summarize"));
    await waitFor(() => {
      expect(screen.getByText("Summary")).toBeInTheDocument();
    });
  });

  it("renders initial messages", () => {
    renderChat({
      initialMessages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" },
      ],
    });
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("Hi there!")).toBeInTheDocument();
  });
});
