"use client";

import { useEffect, useState } from "react";

type Schedule = {
  enabled: boolean;
  mode: "news" | "topic";
  domain: string;
  topic: string;
  notes: string;
  attachImage: boolean;
  autoPublish: boolean;
  lastRunDate: string | null;
  lastRunAt: string | null;
  lastResult: string | null;
  lastError: string | null;
};

type QueuedDraft = {
  id: string;
  createdAt: string;
  domain: string;
  text: string;
  source: { title: string; link: string } | null;
  imageFile: string | null;
  imageTitle: string | null;
};

type Note = { kind: "error" | "info"; message: string } | null;

async function callApi(path: string, method: "GET" | "POST", payload?: object) {
  const res = await fetch(path, {
    method,
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

export default function Scheduler() {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [drafts, setDrafts] = useState<QueuedDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);

  async function refresh() {
    const [s, q] = await Promise.all([
      callApi("/api/schedule", "GET"),
      callApi("/api/queue", "GET"),
    ]);
    setSchedule(s);
    setDrafts(q.drafts ?? []);
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [s, q] = await Promise.all([
          callApi("/api/schedule", "GET"),
          callApi("/api/queue", "GET"),
        ]);
        if (!active) return;
        setSchedule(s);
        setDrafts(q.drafts ?? []);
      } catch (err) {
        if (!active) return;
        setNote({ kind: "error", message: err instanceof Error ? err.message : "Failed to load" });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  function patch(next: Partial<Schedule>) {
    setSchedule((prev) => (prev ? { ...prev, ...next } : prev));
  }

  async function save(next: Partial<Schedule>) {
    setBusy(true);
    setNote(null);
    try {
      const saved = await callApi("/api/schedule", "POST", next);
      setSchedule(saved);
    } catch (err) {
      setNote({ kind: "error", message: err instanceof Error ? err.message : "Save failed" });
      // Reload so the UI reflects the server's actual (unchanged) state after a failed save.
      refresh().catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  async function runNow() {
    setBusy(true);
    setNote(null);
    try {
      const outcome = await callApi("/api/schedule/run", "POST");
      setNote({ kind: outcome.status === "error" ? "error" : "info", message: outcome.message });
      await refresh();
    } catch (err) {
      setNote({ kind: "error", message: err instanceof Error ? err.message : "Run failed" });
    } finally {
      setBusy(false);
    }
  }

  async function act(id: string, action: "approve" | "discard") {
    setBusy(true);
    setNote(null);
    try {
      const data = await callApi("/api/queue", "POST", { id, action });
      if (action === "approve") {
        setNote({ kind: "info", message: data.url ? `Published: ${data.url}` : "Published." });
      }
      await refresh();
    } catch (err) {
      setNote({ kind: "error", message: err instanceof Error ? err.message : "Action failed" });
    } finally {
      setBusy(false);
    }
  }

  if (!schedule) {
    return <p className="mt-10 text-sm text-zinc-500">Loading scheduler…</p>;
  }

  return (
    <section className="mt-14 border-t border-zinc-200 pt-8 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Daily schedule</h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={schedule.enabled}
            disabled={busy}
            onChange={(e) => save({ enabled: e.target.checked })}
          />
          {schedule.enabled ? "On" : "Off"}
        </label>
      </div>
      <p className="mt-1 text-sm text-zinc-500">
        Once a day the agent generates a post for the settings below, then{" "}
        {schedule.autoPublish ? "publishes it automatically" : "adds it to the review queue"}.
      </p>

      <div className="mt-5 flex flex-col gap-4">
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="mode"
              checked={schedule.mode === "news"}
              disabled={busy}
              onChange={() => patch({ mode: "news" })}
            />
            News (domain)
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="mode"
              checked={schedule.mode === "topic"}
              disabled={busy}
              onChange={() => patch({ mode: "topic" })}
            />
            Topic (explainer)
          </label>
        </div>

        {schedule.mode === "news" ? (
          <label className="flex flex-col gap-1 text-sm font-medium">
            Domain
            <input
              value={schedule.domain}
              disabled={busy}
              onChange={(e) => patch({ domain: e.target.value })}
              onBlur={(e) => save({ domain: e.target.value.trim() })}
              placeholder='e.g. "AI", "fintech", "HR"'
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-normal outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
        ) : (
          <label className="flex flex-col gap-1 text-sm font-medium">
            Topic
            <input
              value={schedule.topic}
              disabled={busy}
              onChange={(e) => patch({ topic: e.target.value })}
              onBlur={(e) => save({ topic: e.target.value.trim() })}
              placeholder='e.g. "retrieval-augmented generation"'
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-normal outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
        )}

        <label className="flex flex-col gap-1 text-sm font-medium">
          Angle / notes (optional)
          <input
            value={schedule.notes}
            disabled={busy}
            onChange={(e) => patch({ notes: e.target.value })}
            onBlur={(e) => save({ notes: e.target.value.trim() })}
            placeholder="e.g. keep it beginner-friendly"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-normal outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={schedule.attachImage}
            disabled={busy}
            onChange={(e) => save({ attachImage: e.target.checked })}
          />
          Attach an explainer image
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={schedule.autoPublish}
            disabled={busy}
            onChange={(e) => save({ autoPublish: e.target.checked })}
          />
          Publish automatically{" "}
          <span className="text-zinc-500">(off = review each draft before it posts)</span>
        </label>

        <div className="flex items-center gap-3">
          <button
            onClick={runNow}
            disabled={busy}
            className="self-start rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Run now
          </button>
          {schedule.lastRunAt && (
            <span className="text-xs text-zinc-500">
              Last run {new Date(schedule.lastRunAt).toLocaleString()}
              {schedule.lastResult ? ` — ${schedule.lastResult}` : ""}
            </span>
          )}
        </div>

        {schedule.lastError && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {schedule.lastError}
          </p>
        )}
        {note && (
          <p
            className={`rounded-md px-3 py-2 text-sm ${
              note.kind === "error"
                ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                : "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300"
            }`}
          >
            {note.message}
          </p>
        )}
      </div>

      <h3 className="mt-10 text-base font-semibold">
        Review queue{drafts.length > 0 && ` (${drafts.length})`}
      </h3>
      {drafts.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">
          No drafts waiting. Generated drafts appear here for approval unless auto-publish is on.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-5">
          {drafts.map((draft) => (
            <li
              key={draft.id}
              className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="flex gap-4">
                {draft.imageFile && (
                  // eslint-disable-next-line @next/next/no-img-element -- runtime-generated file served by our API route
                  <img
                    src={`/api/image/${draft.imageFile}`}
                    alt={`Explainer: ${draft.imageTitle ?? ""}`}
                    className="h-40 w-32 shrink-0 rounded border border-zinc-300 object-cover object-top dark:border-zinc-700"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap text-sm leading-6">{draft.text}</p>
                  {draft.source && (
                    <p className="mt-2 text-xs text-zinc-500">
                      Grounded in:{" "}
                      <a
                        href={draft.source.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        {draft.source.title}
                      </a>
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => act(draft.id, "approve")}
                  disabled={busy}
                  className="rounded-md bg-[#0a66c2] px-4 py-2 text-sm font-medium text-white hover:bg-[#004182] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Approve & publish
                </button>
                <button
                  onClick={() => act(draft.id, "discard")}
                  disabled={busy}
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
                >
                  Discard
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
