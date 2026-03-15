import type { PluginRuntime } from "../../plugins/runtime/types.js";

export function createExtensionHostLazyRuntime<TOptions>(params: {
  runtimeOptions?: TOptions;
  createRuntime: (runtimeOptions?: TOptions) => PluginRuntime;
}): PluginRuntime {
  let resolvedRuntime: PluginRuntime | null = null;
  const resolveRuntime = (): PluginRuntime => {
    resolvedRuntime ??= params.createRuntime(params.runtimeOptions);
    return resolvedRuntime;
  };

  return new Proxy({} as PluginRuntime, {
    get(_target, prop, receiver) {
      return Reflect.get(resolveRuntime(), prop, receiver);
    },
    set(_target, prop, value, receiver) {
      return Reflect.set(resolveRuntime(), prop, value, receiver);
    },
    has(_target, prop) {
      return Reflect.has(resolveRuntime(), prop);
    },
    ownKeys() {
      return Reflect.ownKeys(resolveRuntime() as object);
    },
    getOwnPropertyDescriptor(_target, prop) {
      return Reflect.getOwnPropertyDescriptor(resolveRuntime() as object, prop);
    },
    defineProperty(_target, prop, attributes) {
      return Reflect.defineProperty(resolveRuntime() as object, prop, attributes);
    },
    deleteProperty(_target, prop) {
      return Reflect.deleteProperty(resolveRuntime() as object, prop);
    },
    getPrototypeOf() {
      return Reflect.getPrototypeOf(resolveRuntime() as object);
    },
  });
}
