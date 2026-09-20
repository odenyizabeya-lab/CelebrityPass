"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  HARD_MIN,
  HARD_MAX,
  QUICK_AMOUNTS,
  formatUSD,
  formatUSDInput,
  parseAmount,
  clamp,
  postDepositIntent,
  type DepositIntent,
} from "./depositShared";
import BankTransferDeposit from "./BankTransferDeposit";
import BankTransferPayout from "./BankTransferPayout";
import AtmDeposit from "./AtmDeposit";

export type MethodKey = "bank-transfer" | "atm-deposit";

const METHODS: { key: MethodKey; name: string; tagline: string; icon: string; accent: string }[] = [
  {
    key: "bank-transfer",
    name: "BANK TRANSFER",
    tagline: "Manual bank transfer",
    icon: "🏦",
    accent: "from-sky-500/20 to-sky-500/5 ring-sky-400/40",
  },
  {
    key: "atm-deposit",
    name: "ATM DEPOSIT",
    tagline: "Deposit through ATM",
    icon: "🏧",
    accent: "from-emerald-500/20 to-emerald-500/5 ring-emerald-400/40",
  },
];

/** Default amount starts at $1,000 and the amount is the center of the screen. */
export default function DepositFlow({ onCompleted }: { onCompleted?: () => void }) {
  const router = useRouter();
  const [raw, setRaw] = useState("1000");
  const [method, setMethod] = useState<MethodKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [intent, setIntent] = useState<DepositIntent | null>(null);
  const [selectingBank, setSelectingBank] = useState(false);

  const amount = parseAmount(raw);
  const valid = amount >= HARD_MIN && amount <= HARD_MAX;

  // Tune the stepper to the size of the amount (fast for large jumps).
  const step = amount < 2_000 ? 100 : amount < 10_000 ? 500 : 1_000;

  function bump(delta: number) {
    const next = clamp(amount + delta, HARD_MIN, HARD_MAX);
    setRaw(String(next));
  }

  async function continueToFlow(e: React.FormEvent) {
    e.preventDefault();
    if (!method || !valid || busy) return;
    // Bank Transfer first asks for COUNTRY → CURRENCY (only configured combos)
    // before opening the intent; ATM deposits open their intent directly.
    if (method === "bank-transfer") {
      setError(null);
      setSelectingBank(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await postDepositIntent(String(amount), method);
      setIntent(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start your deposit. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function backToSelector() {
    setIntent(null);
    setSelectingBank(false);
    setMethod(null);
    setError(null);
  }

  function completed() {
    backToSelector();
    // Re-run the server page so history/balance reflect the fresh PENDING deposit.
    router.refresh();
    onCompleted?.();
  }

  // Method flow is open — render ONLY that method's dedicated screen.
  if (intent) {
    return (
      <div className="fade-up">
        {intent.method === "atm-deposit" ? (
          <AtmDeposit intent={intent} onBack={backToSelector} onDone={completed} />
        ) : (
          <BankTransferDeposit
            intent={intent}
            onBack={backToSelector}
            onDone={completed}
            onChangeDestination={() => {
              setIntent(null);
              setSelectingBank(true);
            }}
          />
        )}
      </div>
    );
  }

  // Bank Transfer's COUNTRY → CURRENCY selection, before the intent opens.
  if (selectingBank) {
    return (
      <div className="fade-up">
        <BankTransferPayout
          amount={amount}
          onBack={() => setSelectingBank(false)}
          onIntent={(data) => {
            setIntent(data);
            setSelectingBank(false);
          }}
        />
      </div>
    );
  }

  return (
    <form onSubmit={continueToFlow} className="mt-2">
      {/* Amount — the visual center of the screen */}
      <section className="rounded-3xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-5 ring-1 ring-white/[0.08]">
        <div className="flex items-end justify-between">
          <p className="text-[15px] font-bold text-white">How much would you like to deposit?</p>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <BigStepButton
            aria="Decrease amount"
            disabled={amount <= HARD_MIN}
            onClick={() => bump(-step)}
          >
            −
          </BigStepButton>

          <AmountInput raw={raw} setRaw={setRaw} valid={valid} />

          <BigStepButton aria="Increase amount" disabled={amount >= HARD_MAX} onClick={() => bump(step)}>
            +
          </BigStepButton>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {QUICK_AMOUNTS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setRaw(String(q))}
              className={`rounded-2xl border px-2 py-3 text-center text-[14px] font-black transition active:scale-95 ${
                Math.abs(amount - q) < 0.005
                  ? "border-primary-400/60 bg-primary-500/20 text-white"
                  : "border-white/10 bg-white/[0.03] text-zinc-200 hover:bg-white/[0.07]"
              }`}
            >
              ${q.toLocaleString("en-US")}
            </button>
          ))}
        </div>

        <p className="mt-3 text-center text-[11px] text-zinc-500">
          Minimum {formatUSD(HARD_MIN)} · maximum {formatUSD(HARD_MAX)}
        </p>
      </section>

      {/* Payment method */}
      <section className="mt-4">
        <p className="px-1 text-[15px] font-bold text-white">Choose payment method</p>
        <div className="mt-2 space-y-2.5">
          {METHODS.map((m) => {
            const active = method === m.key;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setMethod(active ? null : m.key)}
                className={`flex w-full items-center gap-3 rounded-3xl bg-gradient-to-br p-4 text-left ring-1 transition active:scale-[0.99] ${
                  active ? `${m.accent} ring-2` : "from-white/[0.05] to-white/[0.02] ring-white/10 hover:bg-white/[0.06]"
                }`}
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/[0.06] text-2xl ring-1 ring-white/10">
                  {m.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-[15px] font-black tracking-wide ${active ? "text-white" : "text-zinc-100"}`}>
                    {m.name}
                  </span>
                  <span className="block text-[12px] text-zinc-400">{m.tagline}</span>
                </span>
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-black transition ${
                    active ? "bg-primary-500 text-white" : "border-2 border-white/20 text-transparent"
                  }`}
                >
                  ✓
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {error && (
        <p className="mt-3 rounded-2xl bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-300 ring-1 ring-rose-500/30">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!method || !valid || busy}
        className="btn-grad mt-4 w-full rounded-2xl py-4 text-[16px] font-black tracking-wide text-white shadow-xl shadow-primary-600/25 transition disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? "Setting up your deposit…" : "Continue"}
      </button>
    </form>
  );
}

function BigStepButton({
  children,
  onClick,
  disabled,
  aria,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  aria: string;
}) {
  return (
    <button
      type="button"
      aria-label={aria}
      onClick={onClick}
      disabled={disabled}
      className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-2xl font-black text-white transition active:scale-90 disabled:opacity-30 hover:bg-white/[0.08]"
    >
      {children}
    </button>
  );
}

/**
 * A large, native-feeling amount field. It is an invisible <input> layered over
 * the big formatted display, so tapping the number opens the numeric keypad and
 * any typed digits are live-formatted as USD. A custom amount is always allowed.
 */
function AmountInput({
  raw,
  setRaw,
  valid,
}: {
  raw: string;
  setRaw: (v: string) => void;
  valid: boolean;
}) {
  return (
    <div className="relative min-w-0 flex-1">
      <input
        inputMode="decimal"
        autoComplete="off"
        enterKeyHint="done"
        spellCheck={false}
        className="absolute inset-0 h-full w-full cursor-text opacity-0"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onFocus={(e) => e.target.select()}
        aria-label="Enter deposit amount"
      />
      <div className="pointer-events-none select-none text-center">
        <span className={`block text-[13px] font-semibold text-zinc-400`}>$</span>
        <span
          className={`block whitespace-nowrap text-[38px] font-black leading-none tracking-tight ${
            valid ? "text-white" : "text-rose-300"
          }`}
        >
          {formatUSDInput(raw)}
        </span>
        <span className={`mt-1 block text-[11px] font-semibold ${valid ? "text-emerald-400" : "text-rose-400"}`}>
          {valid ? "Tap to edit amount" : `Enter ${formatUSD(HARD_MIN)} or more`}
        </span>
      </div>
    </div>
  );
}