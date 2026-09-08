"use client";

import { useCallback, useEffect, useState } from "react";
import { api, fmtDate, StatusBadge } from "./SocialUI";

interface OverviewData {
  platforms: number;
  connectedAccounts: number;
  queueSize: number;
  approvals: number;
  totalPosts: number;
  published: number;
  publishedToday: number;
  failed: number;
  logs: number;
  automationEnabled: boolean;
  paused: boolean;
  approvalMode: string;
  maxPostsPerDay: number;
  nextRun: {
    nextSchedule: { platform: string; at: string } | null;
    nextPost: { title: string; platform: string; status: string; at: string | null } | null;
    scheduleCount: number;
  };
}

const CRON_URL = `${typeof window !== "undefined" ? window.location.origin : ""}/api/social/cron`;

function StatCard({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div className="glass card-hover rounded-3xl p-5">
      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">{label}</p>
      <p className={`mt-2 text-3xl font-black tabular-nums ${accent ?? "text-white"}`}>{value}</p>
    </div>
  );
}

export default function MarketingOverview() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [running, setRunning] = useState(false);
  const [runReport, setRunReport] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api<OverviewData>("/api/social/admin/overview");
      setData(d);
    } catch {
      setData(null);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const runNow = async () => {
    setRunning(true);
    setRunReport(null);
    try {
      const report = await api<Record<string, unknown>>("/api/social/admin/run", { method: "POST" });
      setRunReport(report);
      await load();
    } catch (e) {
      setRunReport({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      setRunning(false);
    }
  };

  if (!data) {
    return <p className="py-16 text-center text-zinc-500">Loading dashboard…</p>;
  }

  const nextRunAt = data.nextRun?.nextSchedule?.at;

  return (
    <div className="space-y-8">
      <section>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white">Social Media Automation</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Auto-publish your marketplace content to {data.platforms} platforms.
            </p>
          </div>
          <button onClick={runNow} disabled={running} className="btn-grad rounded-full px-6 py-2.5 text-sm font-bold text-white disabled:opacity-60">
            {running ? "Running…" : "Run now"}
          </button>
        </div>

        {runReport && (
          <div className="glass mt-4 rounded-2xl p-4 text-sm text-zinc-300">
            {runReport.error ? (
              <span className="text-rose-300">{String(runReport.error)}</span>
            ) : (
              <span>
                Ran scheduler — generated <b className="text-white">{String(runReport.generated)}</b>, processed{" "}
                <b className="text-white">{String(runReport.processed)}</b>, published{" "}
                <b className="text-emerald-300">{String(runReport.published)}</b>, failed{" "}
                <b className={Number(runReport.failed) > 0 ? "text-rose-300" : "text-white"}>{String(runReport.failed)}</b>, skipped{" "}
                <b className="text-white">{String(runReport.skipped)}</b>
              </span>
            )}
          </div>
        )}
      </section>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Connected accounts" value={data.connectedAccounts} />
        <StatCard label="Published (all time)" value={data.published} />
        <StatCard label="Published today" value={data.publishedToday} accent="text-emerald-300" />
        <StatCard label="In queue" value={data.queueSize} />
        <StatCard label="Awaiting approval" value={data.approvals} accent={data.approvals ? "text-violet-300" : "text-white"} />
        <StatCard label="Failed" value={data.failed} accent={data.failed ? "text-rose-300" : "text-white"} />
        <StatCard label="Log events" value={data.logs} />
        <StatCard label="Global daily cap" value={data.maxPostsPerDay} />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="glass rounded-3xl p-6 lg:col-span-2">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Automation status</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <StatusBadge status={data.automationEnabled ? "QUEUED" : "disconnected"} />
            <span className="text-sm text-zinc-300">
              {!data.automationEnabled ? "Disabled — enable it in Automatic to publish on schedule" : data.paused ? "Paused — no new auto posts until you resume" : "Active"}
            </span>
          </div>
          <ul className="mt-5 space-y-2.5 text-sm text-zinc-400">
            <li>• Approval mode: <b className="text-white">{data.approvalMode === "approval" ? "Manual approval required" : "Publish instantly"}</b></li>
            <li>• Next scheduled scan: <b className="text-white">{nextRunAt ? fmtDate(nextRunAt) : "no enabled schedules"}</b></li>
            <li>{data.nextRun?.nextPost ? <>• Next due post: <b className="text-white">{data.nextRun.nextPost.title}</b> on {data.nextRun.nextPost.platform}</> : "• No posts waiting"}</li>
            <li>• Schedule slots configured: {data.nextRun?.scheduleCount ?? 0}</li>
          </ul>
        </section>

        <section className="glass rounded-3xl p-6">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">Scheduler trigger</p>
          <p className="mt-3 text-sm text-zinc-400">
            Post your scheduled function here so automation keeps running while you&apos;re offline.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-2xl bg-ink-950/70 p-4 text-xs text-zinc-300 ring-1 ring-white/10">
            POST {CRON_URL}
            {"\n"}x-cron-secret: {"<SOCIAL_CRON_SECRET>"}
          </pre>
          <p className="mt-3 text-xs text-zinc-500">
            Any HTTP cron service works (Cloudflare scheduled, cron-job.org, UptimeRobot, GitHub Actions…). It&apos;s idempotent and concurrency-safe.
          </p>
        </section>
      </div>
    </div>
  );
}