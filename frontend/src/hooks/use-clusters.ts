"use client";
import { useState, useEffect, useCallback } from "react";
import { apiClient, Cluster } from "@/lib/api-client";

export function useClusters() {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClusters = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.listClusters();
      setClusters(data);
      setError(null);
    } catch (err: any) {
      setError(err.message ?? "Eroare la încărcarea grupurilor de transport");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const runClustering = async () => {
    setIsLoading(true);
    try {
      const result = await apiClient.clusterOrders();
      await fetchClusters();
      return result;
    } catch (err: any) {
      setError(err.message ?? "Eroare la rularea algoritmului de clustering");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClusters();
  }, [fetchClusters]);

  return { clusters, isLoading, error, refetch: fetchClusters, runClustering };
}
