"use client";

// Alegerea raioanelor deservite (zona unei drone). Grupate pe regiuni, cu
// „toată regiunea” ca scurtătură — nu se bifează raion cu raion dacă nu e nevoie.

import { DISTRICTS, REGIONS, type Region } from "@/lib/districts";

const BY_REGION = (Object.keys(REGIONS) as Region[]).map((region) => ({
  region,
  districts: DISTRICTS.filter((d) => d.region === region).sort((a, b) => a.name.localeCompare(b.name, "ro")),
}));

export default function DistrictAreaPicker({ value, onChange, disabled, error }: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  error?: string;
}) {
  const selected = new Set(value);
  const toggle = (ids: string[], on: boolean) => {
    const next = new Set(selected);
    for (const id of ids) {
      if (on) next.add(id);
      else next.delete(id);
    }
    onChange([...next].sort());
  };

  return (
    <fieldset className="space-y-3" disabled={disabled} aria-invalid={Boolean(error)}>
      <legend className="t-label">Raioane deservite ({value.length})</legend>
      {BY_REGION.map(({ region, districts }) => {
        const ids = districts.map((d) => d.id);
        const all = ids.every((id) => selected.has(id));
        return (
          <div key={region}>
            <label className="mb-1 flex items-center gap-2 text-xs font-medium text-ink-2">
              <input type="checkbox" className="accent-[var(--color-accent)]" checked={all} onChange={(e) => toggle(ids, e.target.checked)} />
              {REGIONS[region].name} — toată regiunea
            </label>
            <div className="flex flex-wrap gap-1.5">
              {districts.map((d) => {
                const on = selected.has(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle([d.id], !on)}
                    className={`rounded border px-2 py-0.5 text-xs ${on ? "border-accent bg-accent-soft text-accent-strong" : "border-line text-ink-2 hover:border-line-strong"}`}
                  >
                    {d.name}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      {error && <span className="field-error">{error}</span>}
    </fieldset>
  );
}
