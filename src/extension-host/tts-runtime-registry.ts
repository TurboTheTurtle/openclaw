import type { TtsProvider } from "../config/types.tts.js";
import { resolveExtensionHostTtsRuntimeBackendOrder } from "./runtime-backend-catalog.js";
import type { ResolvedTtsConfig } from "./tts-config.js";
import {
  EXTENSION_HOST_TTS_RUNTIME_BACKEND_IDS,
  getExtensionHostTtsRuntimeBackend,
  listExtensionHostTtsRuntimeBackends,
  type ExtensionHostTtsRuntimeBackend,
} from "./tts-runtime-backends.js";

export type ExtensionHostTtsRuntimeProvider = ExtensionHostTtsRuntimeBackend;

export const EXTENSION_HOST_TTS_PROVIDER_IDS = EXTENSION_HOST_TTS_RUNTIME_BACKEND_IDS;

export function listExtensionHostTtsRuntimeProviders(): readonly ExtensionHostTtsRuntimeProvider[] {
  return listExtensionHostTtsRuntimeBackends();
}

export function getExtensionHostTtsRuntimeProvider(
  id: TtsProvider,
): ExtensionHostTtsRuntimeProvider | undefined {
  return getExtensionHostTtsRuntimeBackend(id);
}

export function resolveExtensionHostTtsApiKey(
  config: ResolvedTtsConfig,
  provider: TtsProvider,
): string | undefined {
  return getExtensionHostTtsRuntimeProvider(provider)?.resolveApiKey(config);
}

export function isExtensionHostTtsProviderConfigured(
  config: ResolvedTtsConfig,
  provider: TtsProvider,
): boolean {
  return getExtensionHostTtsRuntimeProvider(provider)?.isConfigured(config) ?? false;
}

export function resolveExtensionHostTtsProviderOrder(primary: TtsProvider): TtsProvider[] {
  return [...resolveExtensionHostTtsRuntimeBackendOrder(primary)];
}

export function supportsExtensionHostTtsTelephony(provider: TtsProvider): boolean {
  return getExtensionHostTtsRuntimeProvider(provider)?.supportsTelephony ?? false;
}
