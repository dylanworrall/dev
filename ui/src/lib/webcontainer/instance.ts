"use client";

import { WebContainer } from "@webcontainer/api";

let instance: WebContainer | null = null;
let bootPromise: Promise<WebContainer> | null = null;

// Server-ready listeners
type ServerReadyCallback = (port: number, url: string) => void;
const serverReadyListeners = new Set<ServerReadyCallback>();

export function onServerReady(cb: ServerReadyCallback): () => void {
  serverReadyListeners.add(cb);
  return () => { serverReadyListeners.delete(cb); };
}

/**
 * Boot the WebContainer singleton. Only one instance per page.
 * Calling multiple times returns the same instance.
 */
export async function getWebContainer(): Promise<WebContainer> {
  if (instance) return instance;
  if (bootPromise) return bootPromise;

  bootPromise = WebContainer.boot({ coep: "credentialless" }).then((wc) => {
    instance = wc;

    // Forward server-ready events
    wc.on("server-ready", (port, url) => {
      for (const cb of serverReadyListeners) {
        cb(port, url);
      }
    });

    return wc;
  });

  return bootPromise;
}

/**
 * Tear down the WebContainer instance (e.g. on page unmount).
 */
export function teardownWebContainer(): void {
  if (instance) {
    instance.teardown();
    instance = null;
    bootPromise = null;
    serverReadyListeners.clear();
  }
}

/**
 * Check if WebContainer is booted.
 */
export function isBooted(): boolean {
  return instance !== null;
}
