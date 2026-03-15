import { existsSync, readFileSync } from "node:fs";
import type { TtsProvider } from "../config/types.tts.js";
import type { ResolvedTtsConfig } from "./tts-config.js";
import {
  resolveExtensionHostDefaultTtsProvider,
  resolveExtensionHostTtsFallbackProviders,
} from "./tts-runtime-policy.js";

type TtsUserPrefs = {
  tts?: {
    provider?: TtsProvider;
  };
};

function readExtensionHostTtsPrefs(prefsPath: string): TtsUserPrefs {
  try {
    if (!existsSync(prefsPath)) {
      return {};
    }
    const raw = readFileSync(prefsPath, "utf8");
    const parsed = JSON.parse(raw) as TtsUserPrefs;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function resolveExtensionHostTtsProvider(
  config: ResolvedTtsConfig,
  prefsPath: string,
): TtsProvider {
  const prefs = readExtensionHostTtsPrefs(prefsPath);
  if (prefs.tts?.provider) {
    return prefs.tts.provider;
  }
  if (config.providerSource === "config") {
    return config.provider;
  }

  return resolveExtensionHostDefaultTtsProvider(config);
}

export function resolveExtensionHostTtsRequestSetup(params: {
  text: string;
  config: ResolvedTtsConfig;
  prefsPath: string;
  providerOverride?: TtsProvider;
}):
  | {
      config: ResolvedTtsConfig;
      providers: TtsProvider[];
    }
  | {
      error: string;
    } {
  if (params.text.length > params.config.maxTextLength) {
    return {
      error: `Text too long (${params.text.length} chars, max ${params.config.maxTextLength})`,
    };
  }

  const provider =
    params.providerOverride ?? resolveExtensionHostTtsProvider(params.config, params.prefsPath);
  return {
    config: params.config,
    providers: [
      ...resolveExtensionHostTtsFallbackProviders({
        config: params.config,
        preferredProvider: provider,
      }),
    ],
  };
}
