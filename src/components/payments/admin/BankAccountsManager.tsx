"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type AdminAccount = {
  id: string;
  currency: string;
  countryName: string;
  countryFlag: string | null;
  beneficiary: string;
  bankName: string;
  accountType: string | null;
  accountNumber: string | null;
  iban: string | null;
  bic: string | null;
  swift: string | null;
  routing: string | null;
  sortCode: string | null;
  institutionNumber: string | null;
  transitNumber: string | null;
  branchCode: string | null;
  bankCode: string | null;
  transferType: string;
  bankAddress: string | null;
  isActive: boolean;
  displayOrder: number;
  envKeyRef: string | null;
  notes: string | null;
};

function emptyDraft(): AdminAccount {
  return {
    id: "",
    currency: "",
    countryName: "",
    countryFlag: null,
    beneficiary: "KENNETH CHIDERA ODENYI",
    bankName: "Citibank",
    accountType: null,
    accountNumber: null,
    iban: null,
    bic: null,
    swift: null,
    routing: null,
    sortCode: null,
    institutionNumber: null,
    transitNumber: null,
    branchCode: null,
    bankCode: null,
    transferType: "Local transfer",
    bankAddress: null,
    isActive: true,
    displayOrder: 0,
    envKeyRef: null,
    notes: null,
  };
}

const FIELD_GROUPS: { legend: string; fields: (keyof AdminAccount)[] }[] = [
  { legend: "Account identity", fields: ["beneficiary", "bankName", "accountType", "transferType"] },
  { legend: "Currency identifiers", fields: ["accountNumber", "iban", "swift", "bic", "routing", "sortCode", "institutionNumber", "transitNumber", "branchCode", "bankCode"] },
  { legend: "Display", fields: ["countryName", "countryFlag", "bankAddress", "displayOrder", "notes"] },
];

export default function BankAccountsManager({ accounts }: { accounts: AdminAccount[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<AdminAccount>(emptyDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof AdminAccount, value: string | number | boolean | null) =>
    setDraft((d) => ({ ...d, [key]: value }));

  function startEdit(a: AdminAccount) {
    setDraft({ ...a, id: "" });
    setEditingId(a.id);
    setError(null);
  }
  function startNew() {
    setDraft(emptyDraft());
    setEditingId(null);
    setError(null);
  }

  async function save() {
    setError(null);
    if (!draft.currency.trim() || !draft.countryName.trim() || !draft.beneficiary.trim() || !draft.bankName.trim()) {
      setError("Currency, country, beneficiary and bank are required.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/tickets/admin/bank-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          currency: draft.currency.trim().toUpperCase(),
          displayOrder: Number(draft.displayOrder) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save the bank account.");
      setDraft(emptyDraft());
      setEditingId(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the bank account.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(a: AdminAccount) {
    setError(null);
    await fetch(`/api/tickets/admin/bank-accounts/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !a.isActive }),
    }).then((r) => r.ok);
    router.refresh();
  }

  async function remove(a: AdminAccount) {
    setError(null);
    if (!window.confirm(`Remove ${a.currency} (${a.bankName})?`)) return;
    const res = await fetch(`/api/tickets/admin/bank-accounts/${a.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (data && data.archived) setError(data.message);
    router.refresh();
  }

  const inputCls =
    "w-full rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-emerald-500";

  return (
    <div className="space-y-8">
      {/* Editor */}
      <div className="glass rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-black text-white">{editingId ? `Edit ${draft.currency}` : "Add a bank account"}</h2>
          <div className="flex gap-2">
            {editingId && (
              <button onClick={startNew} className="rounded-full px-4 py-1.5 text-sm text-zinc-400 ring-1 ring-white/10 transition hover:text-white">
                Cancel
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-400">Currency code *</span>
            <input value={draft.currency} onChange={(e) => set("currency", e.target.value)} className={inputCls} placeholder="USD" maxLength={3} />
          </label>
        </div>

        {FIELD_GROUPS.map((g) => (
          <fieldset key={g.legend} className="mt-5">
            <legend className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">{g.legend}</legend>
            <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {g.fields.map((f) => (
                <label key={String(f)} className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    {fieldLabel(f)}
                    {isRequiredField(f) ? " *" : ""}
                  </span>
                  <input
                    value={(draft[f] as string | number | null) ?? ""}
                    onChange={(e) => set(f, e.target.value || null)}
                    className={inputCls}
                    placeholder={fieldPlaceholder(f)}
                  />
                </label>
              ))}
            </div>
          </fieldset>
        ))}

        <label className="mt-4 flex items-center gap-2 text-sm text-zinc-300">
          <input type="checkbox" checked={draft.isActive} onChange={(e) => set("isActive", e.target.checked)} className="h-4 w-4 accent-emerald-500" />
          Active (shown to customers)
        </label>

        {error && <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>}

        <div className="mt-5 flex justify-end">
          <button
            onClick={save}
            disabled={busy}
            className="btn-grad rounded-full px-6 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {busy ? "Saving…" : editingId ? "Save changes" : "Add bank account"}
          </button>
        </div>
      </div>

      {/* List */}
      <div>
        <h2 className="text-lg font-black text-white">Bank accounts ({accounts.length})</h2>
        {accounts.length === 0 && (
          <p className="mt-3 rounded-xl bg-white/[0.03] p-4 text-sm text-zinc-400 ring-1 ring-white/10">
            No bank accounts yet. Add your first account above — customers will be shown it when they pick Bank Transfer for
            that currency.
          </p>
        )}
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((a) => (
            <div key={a.id} className={`rounded-2xl border p-4 ${a.isActive ? "border-white/10 bg-white/[0.03]" : "border-white/5 bg-white/[0.01] opacity-60"}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{a.countryFlag ?? "🏦"}</span>
                  <div>
                    <p className="font-bold text-white">{a.currency}</p>
                    <p className="text-xs text-zinc-400">{a.countryName}</p>
                  </div>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${a.isActive ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-800 text-zinc-500"}`}>
                  {a.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="mt-3 text-sm text-zinc-300">
                {a.bankName}
                {a.accountNumber ? <span className="block font-mono text-xs text-zinc-500">…{a.accountNumber.slice(-4)}</span> : null}
              </p>
              <div className="mt-4 flex gap-2">
                <button onClick={() => startEdit(a)} className="rounded-full px-3 py-1 text-xs font-bold text-zinc-300 ring-1 ring-white/10 transition hover:text-white">
                  Edit
                </button>
                <button onClick={() => toggleActive(a)} className="rounded-full px-3 py-1 text-xs font-bold text-zinc-300 ring-1 ring-white/10 transition hover:text-white">
                  {a.isActive ? "Disable" : "Enable"}
                </button>
                <button onClick={() => remove(a)} className="rounded-full px-3 py-1 text-xs font-bold text-rose-300 ring-1 ring-rose-500/20 transition hover:text-rose-200">
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function fieldLabel(f: keyof AdminAccount): string {
  const map: Record<string, string> = {
    beneficiary: "Beneficiary",
    bankName: "Bank name",
    accountType: "Account type",
    transferType: "Transfer type",
    accountNumber: "Account number",
    iban: "IBAN",
    swift: "SWIFT",
    bic: "BIC",
    routing: "Routing (ABA)",
    sortCode: "Sort code",
    institutionNumber: "Institution no.",
    transitNumber: "Transit no.",
    branchCode: "Branch code",
    bankCode: "Bank code",
    countryName: "Country *",
    countryFlag: "Country flag",
    bankAddress: "Bank address",
    displayOrder: "Display order",
    notes: "Notes",
  };
  return map[String(f)] ?? String(f);
}
function isRequiredField(f: keyof AdminAccount): boolean {
  return f === "beneficiary" || f === "bankName" || f === "countryName";
}
function fieldPlaceholder(f: keyof AdminAccount): string {
  const map: Record<string, string> = {
    currency: "USD",
    beneficiary: "KENNETH CHIDERA ODENYI",
    bankName: "Citibank",
    accountNumber: "0000000000",
    iban: "DE00 0000 0000 0000",
    swift: "CITIUS33",
    bic: "CITIUS33",
    routing: "021000089",
    sortCode: "00-00-00",
    institutionNumber: "000",
    transitNumber: "00000",
    branchCode: "000",
    bankCode: "000",
    countryFlag: "🇺🇸",
    displayOrder: "0",
  };
  return map[String(f)] ?? "";
}