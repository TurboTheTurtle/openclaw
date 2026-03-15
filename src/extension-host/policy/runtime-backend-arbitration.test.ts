import { describe, expect, it } from "vitest";
import {
  listExtensionHostRuntimeBackendCandidatesByArbitration,
  listExtensionHostRuntimeBackendIdsByArbitration,
  resolveExtensionHostRuntimeBackendOrderByArbitration,
} from "./runtime-backend-arbitration.js";

const entries = [
  {
    id: "capability.runtime-backend:embedding:local",
    family: "capability.runtime-backend",
    subsystemId: "embedding",
    backendId: "local",
    source: "builtin",
    defaultRank: 0,
    selectorKeys: ["local"],
    capabilities: ["embed.query", "embed.batch"],
    metadata: { autoSelectable: true },
  },
  {
    id: "capability.runtime-backend:embedding:openai",
    family: "capability.runtime-backend",
    subsystemId: "embedding",
    backendId: "openai",
    source: "builtin",
    defaultRank: 1,
    selectorKeys: ["openai"],
    capabilities: ["embed.query", "embed.batch"],
    metadata: { autoSelectable: true },
  },
  {
    id: "capability.runtime-backend:embedding:custom",
    family: "capability.runtime-backend",
    subsystemId: "embedding",
    backendId: "custom",
    source: "builtin",
    defaultRank: 2,
    selectorKeys: ["custom"],
    capabilities: ["embed.query", "embed.batch"],
    metadata: { autoSelectable: false },
  },
  {
    id: "capability.runtime-backend:tts:edge",
    family: "capability.runtime-backend",
    subsystemId: "tts",
    backendId: "edge",
    source: "builtin",
    defaultRank: 1,
    selectorKeys: ["edge"],
    capabilities: ["tts.synthesis"],
  },
] as const;

describe("runtime backend arbitration", () => {
  it("keeps candidates ranked by default rank inside a subsystem", () => {
    expect(
      listExtensionHostRuntimeBackendCandidatesByArbitration({
        entries,
        subsystemId: "embedding",
      }).map((entry) => entry.backendId),
    ).toEqual(["local", "openai", "custom"]);
  });

  it("supports filtered runtime-family arbitration", () => {
    expect(
      listExtensionHostRuntimeBackendIdsByArbitration({
        entries,
        subsystemId: "embedding",
        include: (entry) => entry.metadata?.autoSelectable === true && entry.backendId !== "local",
      }),
    ).toEqual(["openai"]);
  });

  it("keeps the preferred backend first without duplicating ranked entries", () => {
    expect(
      resolveExtensionHostRuntimeBackendOrderByArbitration({
        entries,
        subsystemId: "embedding",
        preferredBackendId: "openai",
      }),
    ).toEqual(["openai", "local", "custom"]);

    expect(
      resolveExtensionHostRuntimeBackendOrderByArbitration({
        entries,
        subsystemId: "embedding",
        preferredBackendId: "fallback-only",
        include: (entry) => entry.metadata?.autoSelectable === true,
      }),
    ).toEqual(["fallback-only", "local", "openai"]);
  });
});
