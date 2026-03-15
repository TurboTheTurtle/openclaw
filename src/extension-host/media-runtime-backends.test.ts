import { describe, expect, it } from "vitest";
import {
  buildExtensionHostMediaRuntimeSelectorKeys,
  listExtensionHostMediaAutoRuntimeBackendSeedIds,
  listExtensionHostMediaRuntimeBackendIds,
  listExtensionHostMediaUnderstandingProviders,
  normalizeExtensionHostMediaProviderId,
  resolveExtensionHostMediaRuntimeDefaultModelMetadata,
} from "./media-runtime-backends.js";

describe("extension host media runtime backends", () => {
  it("publishes the built-in media providers once", () => {
    const providers = listExtensionHostMediaUnderstandingProviders();

    expect(providers.some((provider) => provider.id === "openai")).toBe(true);
    expect(providers.some((provider) => provider.id === "deepgram")).toBe(true);
  });

  it("keeps media-specific provider normalization and selector aliases", () => {
    expect(normalizeExtensionHostMediaProviderId("gemini")).toBe("google");
    expect(buildExtensionHostMediaRuntimeSelectorKeys("google")).toEqual(["google", "gemini"]);
  });

  it("keeps auto-seeded runtime backends ordered ahead of the rest", () => {
    expect(listExtensionHostMediaAutoRuntimeBackendSeedIds("image")).toEqual([
      "openai",
      "anthropic",
      "google",
      "minimax",
      "minimax-portal",
      "zai",
    ]);
    expect(listExtensionHostMediaRuntimeBackendIds("audio").slice(0, 3)).toEqual([
      "openai",
      "groq",
      "deepgram",
    ]);
    expect(listExtensionHostMediaRuntimeBackendIds("image").slice(0, 4)).toEqual([
      "openai",
      "anthropic",
      "google",
      "minimax",
    ]);
  });

  it("keeps default-model metadata with the shared backend definitions", () => {
    expect(
      resolveExtensionHostMediaRuntimeDefaultModelMetadata({
        capability: "image",
        backendId: "openai",
      }),
    ).toBe("gpt-5-mini");
    expect(
      resolveExtensionHostMediaRuntimeDefaultModelMetadata({
        capability: "video",
        backendId: "openai",
      }),
    ).toBeUndefined();
  });
});
