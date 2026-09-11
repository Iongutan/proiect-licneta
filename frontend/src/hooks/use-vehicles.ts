"use client";
import { useState, useEffect, useCallback } from "react";
import { apiClient, Vehicle } from "@/lib/api-client";

export function useVehicles() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVehicles = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.listVehicles();
      setVehicles(data);
      setError(null);
    } catch (err: any) {
      setError(err.message ?? "Eroare la încărcarea flotei");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  return { vehicles, isLoading, error, refetch: fetchVehicles };
}
