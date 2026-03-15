import { describe, expect, it } from "vitest";
import {
  resolveExtensionHostEmbeddingFallbackModel,
  resolveExtensionHostEmbeddingFallbackPolicy,
} from "./embedding-runtime-policy.js";

describe("embedding-runtime-policy", () => {
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
