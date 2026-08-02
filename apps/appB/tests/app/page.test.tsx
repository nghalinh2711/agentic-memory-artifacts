import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "../helpers/test-utils";
import Home from "@/app/page";
import type { Conversation } from "@/lib/types";

const mockCreateConversation = vi.fn();
const mockGetAllConversations = vi.fn((): Promise<Conversation[]> => Promise.resolve([]));
const mockDeleteConversation = vi.fn();
const mockUpdateConversation = vi.fn();
const mockGetConversation = vi.fn();

vi.mock("@/lib/conversationStore", () => ({
  createConversationStore: vi.fn(() => ({
    createConversation: mockCreateConversation,
    getAllConversations: mockGetAllConversations,
    getConversation: mockGetConversation,
    updateConversation: mockUpdateConversation,
    deleteConversation: mockDeleteConversation,
  })),
}));

vi.mock("@/lib/collectionManager", () => ({
  createCollectionManager: vi.fn(() => ({
    getCollection: vi.fn(() => ({ name: "Default", documents: [], createdAt: "2024-01-01" })),
    createCollection: vi.fn(() => ({ name: "Default", documents: [], createdAt: "2024-01-01" })),
    getAllCollections: vi.fn(() => []),
  })),
}));

function mockConv(overrides = {}): Conversation {
  return {
    id: "1",
    name: "Default",
    collectionName: "Default",
    messages: [],
    uploadedFiles: [],
    createdAt: "2024-01-01",
    updatedAt: "2024-01-01",
    ...overrides,
  };
}

describe("Home page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAllConversations.mockResolvedValue([]);
  });

  it("renders the main heading", async () => {
    render(<Home />);
    await waitFor(() => {
      expect(screen.getByText("AI Chatbot RAG")).toBeInTheDocument();
    });
  });

  it("renders the welcome message when no conversation is active", async () => {
    render(<Home />);
    await waitFor(() => {
      expect(screen.getByText("Welcome")).toBeInTheDocument();
    });
  });

  it("renders the conversation sidebar", async () => {
    render(<Home />);
    await waitFor(() => {
      expect(screen.getByText("Conversations")).toBeInTheDocument();
    });
  });

  it("shows upload area when upload button is clicked", async () => {
    const conv = mockConv();
    mockCreateConversation.mockResolvedValue(conv);
    render(<Home />);
    await waitFor(() => expect(screen.getByText("AI Chatbot RAG")).toBeInTheDocument());
    const uploadButton = screen.getByText("Upload");
    fireEvent.click(uploadButton);
    await waitFor(() => {
      expect(screen.getByText(/Drag and drop a file here/)).toBeInTheDocument();
    });
  });

  it("renders ChatWindow when a conversation is active", async () => {
    const conv = mockConv();
    mockGetAllConversations.mockResolvedValue([conv]);
    mockCreateConversation.mockResolvedValue(conv);
    render(<Home />);
    await waitFor(() => expect(screen.getByText("AI Chatbot RAG")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "New conversation" }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Ask a question about your documents...")).toBeInTheDocument();
    });
  });

  it("shows error when conversations fail to load", async () => {
    mockGetAllConversations.mockRejectedValue(new Error("Network error"));
    render(<Home />);
    await waitFor(() => {
      expect(screen.getByText(/Failed to load conversations/)).toBeInTheDocument();
    });
  });

  it("shows uploaded files for active conversation", async () => {
    const conv = mockConv({ uploadedFiles: ["doc.pdf", "readme.md"] });
    mockGetAllConversations.mockResolvedValue([conv]);
    render(<Home />);
    await waitFor(() => expect(screen.getByText("Default")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Default"));
    await waitFor(() => {
      expect(screen.getByText("doc.pdf")).toBeInTheDocument();
      expect(screen.getByText("readme.md")).toBeInTheDocument();
    });
    expect(screen.getByText("Uploaded documents")).toBeInTheDocument();
  });
});
