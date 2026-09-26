import type { BookingStatus } from "./db-types";

export const BOOKING_STATUS: Record<BookingStatus, { t: string; c: string }> = {
  NEGOTIATING: { t: "În negociere", c: "badge-warn" },
  AGREED: { t: "Preț acceptat", c: "badge-accent" },
  CONTRACTED: { t: "Contract activ", c: "badge-ok" },
  IN_TRANSIT: { t: "În drum", c: "badge-accent" },
  DELIVERED: { t: "Livrat", c: "badge-ok" },
  CANCELLED: { t: "Anulat", c: "" },
  REJECTED: { t: "Refuzat", c: "" },
};
