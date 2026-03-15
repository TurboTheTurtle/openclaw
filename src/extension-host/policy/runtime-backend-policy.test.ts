import { describe, expect, it } from "vitest";
import { resolveExtensionHostRuntimeBackendIdsByPolicy } from "./runtime-backend-policy.js";

const entries = [
  {
    id: "capability.runtime-backend:media.image:openai",
    family: "capability.runtime-backend",
    subsystemId: "media.image",
    backendId: "openai",
    source: "builtin",
    defaultRank: 0,
    selectorKeys: ["openai"],
    capabilities: ["image"],
    metadata: { autoSelectable: true },
  },
  {
    id: "capability.runtime-backend:media.image:google",
    family: "capability.runtime-backend",
    subsystemId: "media.image",
    backendId: "google",
    source: "builtin",
    defaultRank: 1,
    selectorKeys: ["google", "gemini"],
    capabilities: ["image"],
    metadata: { autoSelectable: true },
  },
  {
    id: "capability.runtime-backend:media.image:custom",
    family: "capability.runtime-backend",
    subsystemId: "media.image",
    backendId: "custom",
    source: "builtin",
    defaultRank: 2,
    selectorKeys: ["custom"],
    capabilities: ["image"],
    metadata: { autoSelectable: false },
  },
  {
    id: "capability.runtime-backend:tts:edge",
    family: "capability.runtime-backend",
    subsystemId: "tts",
    backendId: "edge",
    source: "builtin",
    defaultRank: 0,
    selectorKeys: ["edge"],
    capabilities: ["tts.synthesis"],
  },
  {
    id: "capability.runtime-backend:tts:openai",
    family: "capability.runtime-backend",
    subsystemId: "tts",
    backendId: "openai",
    source: "builtin",
    defaultRank: 1,
    selectorKeys: ["openai"],
    capabilities: ["tts.synthesis", "tts.telephony"],
  },
] as const;

describe("runtime-backend-policy", () => {
  it("resolves the default-ranked filtered chain when no preferred backend is provided", () => {
    expect(
      resolveExtensionHostRuntimeBackendIdsByPolicy({
        entries,
        subsystemId: "media.image",
        include: (entry) => entry.metadata?.autoSelectable === true,
      }),
    ).toEqual(["openai", "google"]);
  });

  it("keeps the preferred backend first even when it is outside the filtered chain", () => {
    expect(
      resolveExtensionHostRuntimeBackendIdsByPolicy({
        entries,
        subsystemId: "media.image",
        preferredBackendId: "missing-provider",
        include: (entry) => entry.metadata?.autoSelectable === true,
      }),
    ).toEqual(["missing-provider", "openai", "google"]);
  });

  it("falls back to an explicit backend id when no filtered default exists", () => {
    expect(
      resolveExtensionHostRuntimeBackendIdsByPolicy({
        entries,
        subsystemId: "tts",
        include: () => false,
        fallbackBackendId: "edge",
      }),
    ).toEqual(["edge"]);
  });
});
