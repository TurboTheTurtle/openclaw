import { describe, expect, it } from "vitest";
import {
  listExtensionHostEmbeddingRemoteRuntimeBackendIds,
  resolveExtensionHostEmbeddingFallbackModel,
  resolveExtensionHostEmbeddingFallbackPolicy,
} from "./embedding-runtime-policy.js";

describe("embedding-runtime-policy", () => {
  it("uses the shared runtime-backend policy for remote auto-provider order", () => {
    expect(listExtensionHostEmbeddingRemoteRuntimeBackendIds()).toEqual([
      "openai",
      "gemini",
      "voyage",
      "mistral",
    ]);
  });

  it("returns null when fallback is disabled or would repeat the requested provider", () => {
    expect(
      resolveExtensionHostEmbeddingFallbackPolicy({
        requestedProvider: "openai",
        fallback: "none",
        configuredModel: "configured-local-model",
      }),
    ).toBeNull();

    expect(
      resolveExtensionHostEmbeddingFallbackPolicy({
        requestedProvider: "openai",
        fallback: "openai",
        configuredModel: "configured-local-model",
      }),
    ).toBeNull();
  });

  it("resolves host-owned fallback requests with provider-specific models", () => {
    expect(
      resolveExtensionHostEmbeddingFallbackPolicy({
        requestedProvider: "openai",
        fallback: "gemini",
        configuredModel: "configured-local-model",
      }),
    ).toEqual({
      provider: "gemini",
      model: "gemini-embedding-001",
    });
  });

  it("keeps the configured model only for local fallback", () => {
    expect(resolveExtensionHostEmbeddingFallbackModel("local", "configured-local-model")).toBe(
      "configured-local-model",
    );
  });
});
