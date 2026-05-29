import { lazy, type ComponentType, type LazyExoticComponent } from "react";

type PreloadableComponent<T extends ComponentType<unknown>> = LazyExoticComponent<T> & {
  preload: () => Promise<{ default: T }>;
};

type ComponentModule<T> = { default: T };

export function lazyWithPreload<T extends ComponentType<unknown>>(
  factory: () => Promise<ComponentModule<T>>
): PreloadableComponent<T> {
  const Component = lazy(factory) as PreloadableComponent<T>;
  Component.preload = factory;
  return Component;
}

export function scheduleRoutePreload(preloaders: Array<() => Promise<unknown>>) {
  const preload = () => {
    preloaders.forEach((load) => {
      load().catch(() => undefined);
    });
  };

  const idleCallback = globalThis.requestIdleCallback;
  if (idleCallback) {
    idleCallback(preload, { timeout: 2500 });
    return;
  }

  globalThis.setTimeout(preload, 800);
}
