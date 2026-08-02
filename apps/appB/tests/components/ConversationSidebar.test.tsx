import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "../helpers/test-utils";
import ConversationSidebar from "@/components/ConversationSidebar";
import type { Conversation } from "@/lib/types";

function makeConversation(
  id: string,
  name: string,
  messages: Conversation["messages"] = [],
): Conversation {
  return {
    id,
    name,
    collectionName: name,
    messages,
    uploadedFiles: [],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  };
}

const defaultProps = {
  conversations: [] as Conversation[],
  activeId: null as string | null,
  onSelect: vi.fn(),
  onDelete: vi.fn(),
  onNew: vi.fn(),
  onRename: vi.fn(),
};

function renderSidebar(props = {}) {
  return render(<ConversationSidebar {...defaultProps} {...props} />);
}

describe("ConversationSidebar", () => {
  it("shows empty state when no conversations", () => {
    renderSidebar();
    expect(screen.getByText("No conversations yet")).toBeInTheDocument();
  });

  it("renders conversation list items", () => {
    const convs = [
      makeConversation("1", "collection-a", [
        { role: "user", content: "Hello" },
      ]),
    ];
    renderSidebar({ conversations: convs });
    expect(screen.getByText("collection-a")).toBeInTheDocument();
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("shows preview for empty conversation", () => {
    const convs = [makeConversation("1", "empty-collection")];
    renderSidebar({ conversations: convs });
    expect(screen.getByText("Empty conversation")).toBeInTheDocument();
  });

  it("truncates long message previews", () => {
    const convs = [
      makeConversation("1", "col", [
        { role: "user", content: "A".repeat(80) },
      ]),
    ];
    renderSidebar({ conversations: convs });
    const preview = screen.getByText(/A+\.\.\.$/);
    expect(preview).toBeInTheDocument();
  });

  it("calls onSelect when clicking a conversation", () => {
    const onSelect = vi.fn();
    const convs = [makeConversation("1", "col")];
    renderSidebar({ conversations: convs, onSelect });
    fireEvent.click(screen.getByText("col"));
    expect(onSelect).toHaveBeenCalledWith("1");
  });

  it("calls onDelete when clicking delete button", () => {
    const onDelete = vi.fn();
    const convs = [makeConversation("1", "col")];
    renderSidebar({ conversations: convs, onDelete });
    const deleteIcon = screen.getByTestId("DeleteIcon");
    fireEvent.click(deleteIcon.closest("button")!);
    expect(onDelete).toHaveBeenCalledWith("1");
  });

  it("calls onNew when clicking add button", () => {
    const onNew = vi.fn();
    renderSidebar({ onNew });
    const addBtn = screen.getByTestId("AddIcon").closest("button")!;
    fireEvent.click(addBtn);
    expect(onNew).toHaveBeenCalled();
  });

  it("highlights active conversation", () => {
    const convs = [makeConversation("1", "col")];
    renderSidebar({ conversations: convs, activeId: "1" });
    const item = screen.getByText("col").closest(".Mui-selected");
    expect(item).toBeTruthy();
  });

  it("enters edit mode when clicking edit button", () => {
    const convs = [makeConversation("1", "my-conv")];
    renderSidebar({ conversations: convs });
    const editIcon = screen.getByTestId("EditIcon");
    fireEvent.click(editIcon.closest("button")!);
    expect(screen.getByDisplayValue("my-conv")).toBeInTheDocument();
  });

  it("calls onRename when committing rename", async () => {
    const onRename = vi.fn();
    const convs = [makeConversation("1", "old-name")];
    renderSidebar({ conversations: convs, onRename });
    const editIcon = screen.getByTestId("EditIcon");
    fireEvent.click(editIcon.closest("button")!);
    const input = screen.getByDisplayValue("old-name");
    fireEvent.change(input, { target: { value: "new-name" } });
    const checkIcon = screen.getByTestId("CheckIcon");
    fireEvent.click(checkIcon.closest("button")!);
    await waitFor(() => {
      expect(onRename).toHaveBeenCalledWith("1", "new-name");
    });
  });

  it("cancels rename on escape", async () => {
    const convs = [makeConversation("1", "my-conv")];
    renderSidebar({ conversations: convs });
    const editIcon = screen.getByTestId("EditIcon");
    fireEvent.click(editIcon.closest("button")!);
    const input = screen.getByDisplayValue("my-conv");
    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByDisplayValue("my-conv")).not.toBeInTheDocument();
    });
  });
});
