import type { OpenClawConfig } from "../../config/config.js";
import type { PluginRecord } from "../../plugins/registry.js";
import type { OpenClawPluginApi, OpenClawPluginModule } from "../../plugins/types.js";
import type { ExtensionHostLoaderSession } from "./loader-session.js";
import {
  finalizeExtensionHostLoaderSession,
  processExtensionHostLoaderSessionCandidate,
} from "./loader-session.js";

export function runExtensionHostLoaderSession(params: {
  session: ExtensionHostLoaderSession;
  orderedCandidates: Array<{
    rootDir: string;
  }>;
  manifestByRoot: Map<string, { rootDir: string }>;
  normalizedConfig: {
    entries: Record<
      string,
      {
        enabled?: boolean;
        hooks?: {
          allowPromptInjection?: boolean;
        };
        config?: unknown;
      }
    >;
    slots: {
      memory?: string | null;
    };
  };
  rootConfig: OpenClawConfig;
  validateOnly: boolean;
  createApi: (
    record: PluginRecord,
    options: {
      config: OpenClawConfig;
      pluginConfig?: Record<string, unknown>;
      hookPolicy?: { allowPromptInjection?: boolean };
    },
  ) => OpenClawPluginApi;
  loadModule: (safeSource: string) => OpenClawPluginModule;
}) {
  for (const candidate of params.orderedCandidates) {
    const manifestRecord = params.manifestByRoot.get(candidate.rootDir);
    if (!manifestRecord) {
      continue;
    }
    processExtensionHostLoaderSessionCandidate({
      session: params.session,
      candidate: candidate as never,
      manifestRecord: manifestRecord as never,
      normalizedConfig: params.normalizedConfig,
      rootConfig: params.rootConfig,
      validateOnly: params.validateOnly,
      createApi: params.createApi,
      loadModule: params.loadModule,
    });
  }

  return finalizeExtensionHostLoaderSession(params.session);
}
