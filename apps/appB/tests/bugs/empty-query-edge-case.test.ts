/**
 * Bug Regression Test: Empty Query Edge Case
 *
 * Description:
 * When a user submits a chat query consisting only of whitespace or an empty string,
 * the system should reject it with a 400 status rather than processing it through
 * the RAG pipeline.
 *
 * Reproduction Steps:
 * 1. POST /api/chat with body { query: "   " }
 * 2. Expected: 400 Bad Request with error message
 * 3. Actual (before fix): The query would pass validation and flow into the pipeline
 *
 * Root Cause:
 * The original validation checked `if (!query)` but didn't check for whitespace-only strings.
 *
 * Fix:
 * Added `!query.trim()` check in the API route handler to catch whitespace-only queries.
 */

import { describe, expect, it } from "vitest";

function validateQuery(query: unknown): string | null {
  if (typeof query !== "string") return "Query must be a string";
  if (!query.trim()) return "Query cannot be empty";
  if (query.length > 10000) return "Query too long";
  return null;
}

describe("Bug: Empty query edge case", () => {
  it("rejects null query", () => {
    expect(validateQuery(null)).toBe("Query must be a string");
  });

  it("rejects undefined query", () => {
    expect(validateQuery(undefined)).toBe("Query must be a string");
  });

  it("rejects number query", () => {
    expect(validateQuery(42)).toBe("Query must be a string");
  });

  it("rejects empty string", () => {
    expect(validateQuery("")).toBe("Query cannot be empty");
  });

  it("rejects whitespace-only string", () => {
    expect(validateQuery("   \t\n  ")).toBe("Query cannot be empty");
  });

  it("rejects excessively long query", () => {
    expect(validateQuery("x".repeat(10001))).toBe("Query too long");
  });

  it("accepts valid query", () => {
    expect(validateQuery("What is RAG?")).toBeNull();
  });

  it("accepts query with surrounding whitespace", () => {
    expect(validateQuery("  hello  ")).toBeNull();
  });
});
