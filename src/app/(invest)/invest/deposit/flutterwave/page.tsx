"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatUSD } from "@/components/invest/deposit/depositShared";

/**
 * Return page after a Flutterwave hosted checkout (redirect_url lands here).
 *
 * Confirmation is NEVER driven by the URL or the browser: the page triggers a
 * server-side re-verification with Flutterwave (reference, amount, currency,
 * status must all match) before showing success; the webhook settles as the
 * reliable async path while this page polls. Failed / cancelled / unverified
 * states are shown honestly with an option to try again.
 */
function CardDepositResult() {
  const sp = useSearchParams();
  const router = useRouter();
  const ref = sp.get("ref") ?? "";
  const transactionId = sp.get("transaction_id") ?? sp.get("transactionId") ?? "";
  const statusParam = (sp.get("status") ?? "").toLowerCase();

  const [screen, setScreen] = useState<"checking" | "confirmed" | "failed" | "unverified">("checking");
  const [message, setMessage] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [depositRef, setDepositRef] = useState<string | null>(null);
  const settledRef = useRef(false);

  useEffect(() => {
    if (settledRef.current) return;
    let stop = false;

    // Deferred so no setState runs synchronously in the effect body.
    window.setTimeout(() => {
      if (stop) return;
      if (!ref) {
        setScreen("unverified");
        settledRef.current = true;
        return;
      }
      // Flutterwave reports a cancelled / failed / expired attempt via ?status=…
      if (["cancelled", "failed", "declined", "expired", "abandoned"].includes(statusParam)) {
        setScreen("failed");
        setMessage("The payment was cancelled or not completed. No money was taken.");
        settledRef.current = true;
        return;
      }

      let attempts = 0;

      async function fillBatch(dep: { amount?: unknown; depositRef?: unknown } | undefined) {
        if (dep?.amount) setAmount(Number(dep.amount));
        if (dep?.depositRef) setDepositRef(String(dep.depositRef));
      }

      async function verify() {
        try {
          const res = await fetch(`/api/invest/deposits/${encodeURIComponent(ref)}/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transactionId }),
          });
          const data = await res.json().catch(() => ({}));
          if (stop) return;
          if (res.ok && data.status === "confirmed") {
            setAmount(data.amount ? Number(data.amount) : null);
            settledRef.current = true;
            setScreen("confirmed");
            return;
          }
          if (res.ok) {
            const st = String(data.status ?? "");
            if (st === "failed" || st === "cancelled") {
              setScreen("failed");
              setMessage("The payment was not completed. No money was taken.");
              settledRef.current = true;
              return;
            }
          }
          if (!res.ok && res.status === 422 && typeof data.error === "string" && data.error) {
            setScreen("failed");
            setMessage(data.error);
            settledRef.current = true;
            return;
          }
          // Transient or pending — fall through to polling; the webhook settles.
        } catch {
          // keep polling
        }
      }

      async function poll() {
        attempts += 1;
        try {
          const res = await fetch(`/api/invest/deposits/${encodeURIComponent(ref)}/status`, {
            cache: "no-store",
            credentials: "include",
          });
          const data = await res.json().catch(() => ({}));
          const dep = data?.deposit as { status?: string } | undefined;
          await fillBatch(data?.deposit);
          if (dep?.status === "SUCCESSFUL") {
            settledRef.current = true;
            setScreen("confirmed");
            return;
          }
          if (dep?.status && ["FAILED", "CANCELLED", "REFUNDED", "REVERSED"].includes(dep.status)) {
            settledRef.current = true;
            setScreen("failed");
            return;
          }
        } catch {
          // transient/network/auth — keep polling; the webhook settles anyway.
        }
        if (attempts >= 40) {
          settledRef.current = true;
          setScreen("unverified");
          return;
        }
        if (!stop) window.setTimeout(poll, 2500);
      }

      if (transactionId) {
        verify().then(() => {
          if (!settledRef.current && !stop) {
            attempts = 0;
            window.setTimeout(poll, 1500);
          }
        });
      } else {
        window.setTimeout(poll, 500);
      }
    }, 0);

    return () => {
      stop = true;
    };
  }, [ref, transactionId, statusParam]);

  const amountLine = amount !== null ? formatUSD(amount) : null;

  return (
    <div className="space-y-4">
      {screen === "checking" && (
        <>
          <ResultHeader title="Confirming your payment" />
          <div className="rounded-3xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-8 text-center ring-1 ring-white/[0.08]">
            <div className="mx-auto relative grid h-16 w-16 place-items-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-primary-500/20" />
              <span className="relative grid h-16 w-16 place-items-center rounded-full bg-primary-500/15 ring-1 ring-primary-400/40">
                <span className="h-7 w-7 animate-spin rounded-full border-[3px] border-white/20 border-t-primary-300" />
              </span>
            </div>
            <p className="mt-5 text-[18px] font-black text-white">Confirming your {amountLine ?? "payment"}</p>
            {depositRef && <p className="mt-1 font-mono text-[12px] text-zinc-500">{depositRef}</p>}
            <p className="mt-3 text-[13px] leading-6 text-zinc-400">
              We&apos;re just confirming your Flutterwave payment. This usually takes a few seconds — please don&apos;t
              close this screen.
            </p>
          </div>
        </>
      )}

      {screen === "confirmed" && (
        <>
          <ResultHeader title="Payment complete" />
          <div className="rounded-3xl bg-gradient-to-b from-emerald-500/12 to-emerald-500/[0.02] p-6 text-center ring-1 ring-emerald-400/25">
            <div className="mx-auto relative grid h-16 w-16 place-items-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/20" />
              <span className="relative grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/40">
                <svg className="h-9 w-9 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
            </div>
            <p className="mt-4 text-[20px] font-black text-white">Deposit confirmed</p>
            {amountLine && <p className="mt-1 text-[34px] font-black leading-none tracking-tight text-white">{amountLine}</p>}
            {depositRef && <p className="mt-1 font-mono text-[12px] text-zinc-500">{depositRef}</p>}
            <p className="mt-3 text-[13px] leading-6 text-zinc-400">
              Flutterwave verified your payment and your available balance has been credited.
            </p>
            <button
              onClick={() => router.replace("/invest/deposit")}
              className="btn-grad mt-5 w-full rounded-2xl py-4 text-[16px] font-black text-white shadow-xl shadow-primary-600/25 active:scale-[0.99]"
            >
              Done
            </button>
            <button
              onClick={() => router.replace("/invest")}
              className="mt-2.5 w-full rounded-2xl border-2 border-white/15 py-3.5 text-[15px] font-black text-white transition active:scale-[0.99] hover:bg-white/[0.06]"
            >
              View your investing dashboard
            </button>
          </div>
        </>
      )}

      {screen === "failed" && (
        <>
          <ResultHeader title="Payment not completed" />
          <div className="rounded-3xl bg-gradient-to-b from-rose-500/12 to-rose-500/[0.02] p-6 text-center ring-1 ring-rose-400/25">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-rose-500/15 ring-1 ring-rose-400/40">
              <svg className="h-9 w-9 text-rose-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="mt-4 text-[20px] font-black text-white">Your payment wasn&apos;t completed</p>
            <p className="mt-2 text-[13px] leading-6 text-zinc-400">{message ?? "No money was taken. You can try again below."}</p>
            <button
              onClick={() => router.replace("/invest/deposit")}
              className="btn-grad mt-5 w-full rounded-2xl py-4 text-[16px] font-black text-white shadow-xl shadow-primary-600/25 active:scale-[0.99]"
            >
              Try again
            </button>
            <button
              onClick={() => router.replace("/invest")}
              className="mt-2.5 w-full rounded-2xl border-2 border-white/15 py-3.5 text-[15px] font-black text-white transition active:scale-[0.99] hover:bg-white/[0.06]"
            >
              Back to investing
            </button>
          </div>
        </>
      )}

      {screen === "unverified" && (
        <>
          <ResultHeader title="Payment status" />
          <div className="rounded-3xl bg-gradient-to-b from-amber-500/12 to-amber-500/[0.02] p-6 text-center ring-1 ring-amber-400/25">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-amber-500/15 ring-1 ring-amber-400/40">
              <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-white/20 border-t-amber-300" />
            </div>
            <p className="mt-4 text-[20px] font-black text-white">We&apos;re still confirming your payment</p>
            <p className="mt-2 text-[13px] leading-6 text-zinc-400">
              This can take a little longer on rare occasions. If your bank shows the charge, rest assured your balance
              will be credited automatically by our confirmation system — no need to repeat the payment.
            </p>
            <button
              onClick={() => router.replace("/invest/deposit")}
              className="btn-grad mt-5 w-full rounded-2xl py-4 text-[16px] font-black text-white shadow-xl shadow-primary-600/25 active:scale-[0.99]"
            >
              Back to deposits
            </button>
            <button
              onClick={() => window.location.reload()}
              className="mt-2.5 w-full rounded-2xl border-2 border-white/15 py-3.5 text-[15px] font-black text-white transition active:scale-[0.99] hover:bg-white/[0.06]"
            >
              Check again
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ResultHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.05] text-zinc-400 ring-1 ring-white/10">
        💳
      </span>
      <p className="text-[17px] font-black tracking-wide text-white">{title}</p>
    </div>
  );
}

export default function FlutterwaveDepositResultPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-10 w-40 animate-pulse rounded-full bg-white/[0.05]" />
          <div className="h-72 animate-pulse rounded-3xl bg-white/[0.04] ring-1 ring-white/[0.05]" />
        </div>
      }
    >
      <CardDepositResult />
    </Suspense>
  );
}