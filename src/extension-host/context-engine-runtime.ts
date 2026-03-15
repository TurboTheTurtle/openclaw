import type { OpenClawConfig } from "../config/config.js";
import type { ContextEngine } from "../context-engine/types.js";
import { getExtensionHostDefaultSlotId } from "./policy/slot-arbitration.js";

export type ExtensionHostContextEngineFactory = () => ContextEngine | Promise<ContextEngine>;

const CONTEXT_ENGINE_RUNTIME_STATE = Symbol.for("openclaw.contextEngineRegistryState");

type ExtensionHostContextEngineRuntimeState = {
  engines: Map<string, ExtensionHostContextEngineFactory>;
};

function getExtensionHostContextEngineRuntimeState(): ExtensionHostContextEngineRuntimeState {
  const globalState = globalThis as typeof globalThis & {
    [CONTEXT_ENGINE_RUNTIME_STATE]?: ExtensionHostContextEngineRuntimeState;
  };
  if (!globalState[CONTEXT_ENGINE_RUNTIME_STATE]) {
    globalState[CONTEXT_ENGINE_RUNTIME_STATE] = {
      engines: new Map<string, ExtensionHostContextEngineFactory>(),
    };
  }
  return globalState[CONTEXT_ENGINE_RUNTIME_STATE];
}

export function registerExtensionHostContextEngine(
  id: string,
  factory: ExtensionHostContextEngineFactory,
): void {
  getExtensionHostContextEngineRuntimeState().engines.set(id, factory);
}

export function getExtensionHostContextEngineFactory(
  id: string,
): ExtensionHostContextEngineFactory | undefined {
  return getExtensionHostContextEngineRuntimeState().engines.get(id);
}

export function listExtensionHostContextEngineIds(): string[] {
  return [...getExtensionHostContextEngineRuntimeState().engines.keys()];
}

export async function resolveExtensionHostContextEngine(
  config?: OpenClawConfig,
): Promise<ContextEngine> {
  const slotValue = config?.plugins?.slots?.contextEngine;
  const engineId =
    typeof slotValue === "string" && slotValue.trim()
      ? slotValue.trim()
      : getExtensionHostDefaultSlotId("contextEngine");

  const factory = getExtensionHostContextEngineRuntimeState().engines.get(engineId);
  if (!factory) {
    throw new Error(
      `Context engine "${engineId}" is not registered. ` +
        `Available engines: ${listExtensionHostContextEngineIds().join(", ") || "(none)"}`,
    );
  }

  return factory();
}
