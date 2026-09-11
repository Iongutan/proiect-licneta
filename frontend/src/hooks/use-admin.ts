"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { apiClient, CompanyKyc, DigitalContract, Invoice, AuditLogEntry } from "@/lib/api-client";

export function useAdmin() {
  const [kycRequests, setKycRequests] = useState<CompanyKyc[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [contracts, setContracts] = useState<DigitalContract[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [k, inv, c, a] = await Promise.all([
        apiClient.listKycRequests(),
        apiClient.listInvoices(),
        apiClient.listContracts(),
        apiClient.listAuditLogs(),
      ]);
      setKycRequests(k);
      setInvoices(inv);
      setContracts(c);
      setAuditLogs(a);
      setError(null);
    } catch (err: any) {
      setError(err.message ?? "Eroare la încărcarea datelor administrative");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const reviewKyc = async (id: string, status: "VERIFIED" | "REJECTED", reason?: string) => {
    await apiClient.reviewKyc(id, status, reason);
    await fetchAll();
  };

  const markInvoicePaid = async (id: string, method?: string) => {
    await apiClient.markInvoicePaid(id, method);
    await fetchAll();
  };

  const acceptContract = async (id: string, acceptedBy: string) => {
    const updated = await apiClient.acceptContract(id, acceptedBy);
    await fetchAll();
    return updated;
  };

  // Metrici financiare agregate
  const financialMetrics = useMemo(() => {
    const totalCollectedMdl = invoices
      .filter((i) => i.status === "PAID")
      .reduce((sum, i) => sum + i.total_amount_mdl, 0);

    const totalPendingMdl = invoices
      .filter((i) => i.status === "PENDING_PAYMENT")
      .reduce((sum, i) => sum + i.total_amount_mdl, 0);

    const totalOverdueMdl = invoices
      .filter((i) => i.status === "OVERDUE")
      .reduce((sum, i) => sum + i.total_amount_mdl, 0);

    const totalCarrierPayoutsMdl = invoices
      .filter((i) => i.status === "PAID")
      .reduce((sum, i) => sum + i.carrier_payout_mdl, 0);

    const totalPlatformFeesMdl = invoices
      .filter((i) => i.status === "PAID")
      .reduce((sum, i) => sum + i.platform_fee_mdl, 0);

    return {
      totalCollectedMdl,
      totalPendingMdl,
      totalOverdueMdl,
      totalCarrierPayoutsMdl,
      totalPlatformFeesMdl,
      paidCount: invoices.filter((i) => i.status === "PAID").length,
      pendingCount: invoices.filter((i) => i.status === "PENDING_PAYMENT").length,
      overdueCount: invoices.filter((i) => i.status === "OVERDUE").length,
    };
  }, [invoices]);

  return {
    kycRequests,
    invoices,
    contracts,
    auditLogs,
    financialMetrics,
    isLoading,
    error,
    reviewKyc,
    markInvoicePaid,
    acceptContract,
    refetch: fetchAll,
  };
}
