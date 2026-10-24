import { useEffect, useState } from "react";
import API_CONFIG from "@/lib/api";
import { requestJson } from "@/lib/http";

export interface ServerConfig {
  max_upload_size: number;
  max_documents_per_session: number;
}

/** Used until /config responds (matches the backend default) */
export const DEFAULT_SERVER_CONFIG: ServerConfig = { max_upload_size: 20 * 1024 * 1024, max_documents_per_session: 25 };

let pending: Promise<ServerConfig> | null = null;

/** Fetch once per page load, shared by every caller; falls back to defaults on failure. */
export function loadServerConfig(): Promise<ServerConfig> {
  pending ??= requestJson<ServerConfig>(API_CONFIG.ENDPOINTS.CONFIG).catch(() => {
    pending = null; // retry on next use
    return DEFAULT_SERVER_CONFIG;
  });
  return pending;
}

/** Limits the backend enforces, so the UI never promises something the server rejects. */
export function useServerConfig(): ServerConfig {
  const [config, setConfig] = useState(DEFAULT_SERVER_CONFIG);
  useEffect(() => {
    let active = true;
    loadServerConfig().then((value) => active && setConfig(value));
    return () => {
      active = false;
    };
  }, []);
  return config;
}

export const formatMegabytes = (bytes: number) => `${Math.round(bytes / (1024 * 1024))}MB`;
