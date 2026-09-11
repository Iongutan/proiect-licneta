"use client";
import { useState, useEffect } from "react";
import { apiClient, Order } from "@/lib/api-client";

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.listOrders({ limit: 50 });
      setOrders(data);
      setError(null);
    } catch (err: any) {
      setError(err.message ?? "Failed to load orders");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const cancelOrder = async (id: string) => {
    await apiClient.cancelOrder(id);
    await fetchOrders(); // Refresh
  };

  return { orders, isLoading, error, refetch: fetchOrders, cancelOrder };
}
