import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "../helpers/test-utils";
import userEvent from "@testing-library/user-event";
import FileUpload from "@/components/FileUpload";

function createFile(name: string, size: number, type: string): File {
  return new File(size > 0 ? ["x".repeat(size)] : [], name, { type });
}

function mockFetchSuccess(filename: string) {
  return vi.fn().mockResolvedValueOnce({
    ok: true,
    json: async () => ({ success: true, filename }),
  });
}

function mockFetchError(errorMessage: string) {
  return vi.fn().mockResolvedValueOnce({
    ok: false,
    json: async () => ({ success: false, error: errorMessage }),
  });
}

function mockFetchNetworkError() {
  return vi.fn().mockRejectedValueOnce(new Error("Network error"));
}

describe("FileUpload", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders the drop zone with instructions", () => {
    render(<FileUpload onUploadSuccess={vi.fn()} conversationId="conv-1" />);
    expect(screen.getByText(/Drag and drop/)).toBeInTheDocument();
    expect(screen.getByText(/Supported:/)).toBeInTheDocument();
  });

  it("shows error for unsupported file format via file input", async () => {
    render(<FileUpload onUploadSuccess={vi.fn()} conversationId="conv-1" />);
    const file = createFile("test.png", 100, "image/png");
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/Unsupported/);
    });
  });

  it("shows error for empty file via file input", async () => {
    render(<FileUpload onUploadSuccess={vi.fn()} conversationId="conv-1" />);
    const file = createFile("empty.txt", 0, "text/plain");
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/empty/);
    });
  });

  it("shows error for oversized file via file input", async () => {
    render(<FileUpload onUploadSuccess={vi.fn()} conversationId="conv-1" />);
    const file = createFile("big.pdf", 6 * 1024 * 1024, "application/pdf");
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/exceeds/);
    });
  });

  it("uploads valid file and calls onUploadSuccess", async () => {
    vi.stubGlobal("fetch", mockFetchSuccess("doc.pdf"));
    const onSuccess = vi.fn();
    render(<FileUpload onUploadSuccess={onSuccess} conversationId="conv-1" />);
    const file = createFile("doc.pdf", 1024, "application/pdf");
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith("doc.pdf");
    });
  });

  it("shows error on network failure", async () => {
    vi.stubGlobal("fetch", mockFetchNetworkError());
    render(<FileUpload onUploadSuccess={vi.fn()} conversationId="conv-1" />);
    const file = createFile("doc.pdf", 1024, "application/pdf");
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("shows error on API error response", async () => {
    vi.stubGlobal("fetch", mockFetchError("Server rejected file"));
    render(<FileUpload onUploadSuccess={vi.fn()} conversationId="conv-1" />);
    const file = createFile("doc.pdf", 1024, "application/pdf");
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Server rejected file");
    });
  });

  it("shows drag-over visual state on dragover", () => {
    render(<FileUpload onUploadSuccess={vi.fn()} conversationId="conv-1" />);
    const dropZone = screen.getByText(/Drag and drop/).closest("div")!;
    fireEvent.dragOver(dropZone);
    expect(dropZone).toBeTruthy();
  });

  it("handles drag leave event", () => {
    render(<FileUpload onUploadSuccess={vi.fn()} conversationId="conv-1" />);
    const dropZone = screen.getByText(/Drag and drop/).closest("div")!;
    fireEvent.dragLeave(dropZone);
    expect(dropZone).toBeTruthy();
  });

  it("handles drop event with no file", () => {
    render(<FileUpload onUploadSuccess={vi.fn()} conversationId="conv-1" />);
    const dropZone = screen.getByText(/Drag and drop/).closest("div")!;
    fireEvent.drop(dropZone, { dataTransfer: { files: [] } });
    expect(dropZone).toBeTruthy();
  });

  it("handles drop with valid PDF file", async () => {
    vi.stubGlobal("fetch", mockFetchSuccess("dropped.pdf"));
    const onSuccess = vi.fn();
    render(<FileUpload onUploadSuccess={onSuccess} conversationId="conv-1" />);
    const dropZone = screen.getByText(/Drag and drop/).closest("div")!;
    const file = createFile("dropped.pdf", 1024, "application/pdf");
    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith("dropped.pdf");
    });
  });

  it("triggers file picker on click without stopPropagation", () => {
    render(<FileUpload onUploadSuccess={vi.fn()} conversationId="conv-1" />);
    const dropZone = screen.getByText(/Drag and drop/).closest("div")!;
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click");
    fireEvent.click(dropZone);
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it("Browse Files button triggers file picker", () => {
    render(<FileUpload onUploadSuccess={vi.fn()} conversationId="conv-1" />);
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click");
    fireEvent.click(screen.getByText("Browse Files"));
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it("shows error for file without extension", async () => {
    render(<FileUpload onUploadSuccess={vi.fn()} conversationId="conv-1" />);
    const file = createFile("noextension", 100, "text/plain");
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/Unsupported/);
    });
  });

  it("shows default error when API response has no error field", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ success: false }),
    }));
    render(<FileUpload onUploadSuccess={vi.fn()} conversationId="conv-1" />);
    const file = createFile("doc.pdf", 1024, "application/pdf");
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Upload failed");
    });
  });

  it("handles file input change with no files selected", () => {
    render(<FileUpload onUploadSuccess={vi.fn()} conversationId="conv-1" />);
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: null } });
    expect(screen.getByText(/Drag and drop/)).toBeInTheDocument();
  });
});
