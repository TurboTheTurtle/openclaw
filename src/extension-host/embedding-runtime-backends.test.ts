import { describe, expect, it } from "vitest";
import {
  DEFAULT_EXTENSION_HOST_LOCAL_EMBEDDING_MODEL,
  EXTENSION_HOST_EMBEDDING_RUNTIME_BACKEND_IDS,
  EXTENSION_HOST_REMOTE_EMBEDDING_PROVIDER_IDS,
  isExtensionHostEmbeddingRuntimeBackendAutoSelectable,
} from "./embedding-runtime-backends.js";

describe("embedding-runtime-backends", () => {
  it("keeps the built-in embedding backend order stable", () => {
    expect(DEFAULT_EXTENSION_HOST_LOCAL_EMBEDDING_MODEL).toContain("embeddinggemma");
    expect(EXTENSION_HOST_REMOTE_EMBEDDING_PROVIDER_IDS).toEqual([
      "openai",
      "gemini",
      "voyage",
      "mistral",
    ]);
    expect(EXTENSION_HOST_EMBEDDING_RUNTIME_BACKEND_IDS).toEqual([
      "local",
      "openai",
      "gemini",
      "voyage",
      "mistral",
      "ollama",
    ]);
  });

  it("marks only local and remote embedding backends as auto-selectable", () => {
    expect(isExtensionHostEmbeddingRuntimeBackendAutoSelectable("local")).toBe(true);
    expect(isExtensionHostEmbeddingRuntimeBackendAutoSelectable("openai")).toBe(true);
    expect(isExtensionHostEmbeddingRuntimeBackendAutoSelectable("mistral")).toBe(true);
    expect(isExtensionHostEmbeddingRuntimeBackendAutoSelectable("ollama")).toBe(false);
  });
});
