"use client";
import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";

export function useAppStatus() {
  const [status, setStatus] = useState({
    isLive: false,
    mode: "auto" as "auto" | "live" | "demo",
  });

  useEffect(() => {
    // Verifică starea inițială
    apiClient.checkBackendHealth();

    // Abonează-te la schimbările de stare
    const unsubscribe = apiClient.subscribe((newStatus) => {
      setStatus(newStatus as { isLive: boolean; mode: "auto" | "live" | "demo" });
    });

    return () => unsubscribe();
  }, []);

  const setMode = (mode: "auto" | "live" | "demo") => {
    apiClient.setMode(mode);
  };

  const recheckHealth = () => {
    apiClient.checkBackendHealth();
  };

  return {
    isLive: status.isLive,
    mode: status.mode,
    setMode,
    recheckHealth,
    resetDemo: () => apiClient.resetDemo(),
  };
}
