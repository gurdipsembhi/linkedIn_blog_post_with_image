"use client";

import { useState } from "react";

type Status =
  | { kind: "idle" }
  | { kind: "working"; label: string }
  | { kind: "error"; message: string }
  | { kind: "published"; url: string | null };

type Source = { title: string; link: string };
type ExplainerImage = { file: string; url: string; title: string };

export default function PostComposer() {
  const [domain, setDomain] = useState("");
  const [notes, setNotes] = useState("");
  const [text, setText] = useState("");
  const [source, setSource] = useState<Source | null>(null);
  const [image, setImage] = useState<ExplainerImage | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const busy = status.kind === "working";

  async function callApi(path: string, payload: object) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
    return data;
  }

  async function handleGenerate() {
    setStatus({ kind: "working", label: "Fetching fresh news and drafting…" });
    try {
      const data = await callApi("/api/generate", { domain, notes });
      setText(data.text);
      setSource(data.source ?? null);
      setStatus({ kind: "idle" });
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Generation failed" });
    }
  }

  async function handleGenerateImage() {
    setStatus({ kind: "working", label: "Drawing the explainer image…" });
    try {
      const data = await callApi("/api/image", { domain, postText: text });
      setImage(data);
      setStatus({ kind: "idle" });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Image generation failed",
      });
    }
  }

  async function handlePublish() {
    setStatus({ kind: "working", label: "Publishing to LinkedIn…" });
    try {
      const data = await callApi("/api/post", {
        text,
        domain,
        source,
        imageFile: image?.file,
        imageAlt: image?.title,
      });
      setStatus({ kind: "published", url: data.url ?? null });
      setText("");
      setSource(null);
      setImage(null);
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Publish failed" });
    }
  }

  return (
    <div className="mt-8 flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row">
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
          Domain
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder='e.g. "AI", "fintech", "HR"'
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-normal outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-[2] flex-col gap-1 text-sm font-medium">
          Angle / notes (optional)
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. lessons from a recent project"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-normal outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      </div>

      <button
        onClick={handleGenerate}
        disabled={busy || !domain.trim()}
        className="self-start rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        Generate draft
      </button>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Post text
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          maxLength={3000}
          placeholder="Write your post here, or generate a draft above. Review before publishing."
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-normal leading-6 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <span className="text-xs font-normal text-zinc-500">{text.length} / 3000</span>
      </label>

      {source && (
        <p className="text-xs text-zinc-500">
          Grounded in:{" "}
          <a
            href={source.link}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-zinc-700"
          >
            {source.title}
          </a>
        </p>
      )}

      <div className="flex flex-col gap-2">
        <button
          onClick={handleGenerateImage}
          disabled={busy || !text.trim()}
          className="self-start rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          {image ? "Regenerate explainer image" : "Generate explainer image"}
        </button>
        {image && (
          <div className="flex flex-col gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element -- runtime-generated file served by our API route */}
            <img
              src={image.url}
              alt={`Explainer: ${image.title}`}
              className="w-72 rounded-md border border-zinc-300 dark:border-zinc-700"
            />
            <button
              onClick={() => setImage(null)}
              className="self-start text-xs text-zinc-500 underline hover:text-zinc-700"
            >
              Remove image
            </button>
          </div>
        )}
      </div>

      <button
        onClick={handlePublish}
        disabled={busy || !text.trim()}
        className="self-start rounded-md bg-[#0a66c2] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#004182] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {image ? "Publish post + image to LinkedIn" : "Publish to LinkedIn"}
      </button>

      {status.kind === "working" && (
        <p className="text-sm text-zinc-500">{status.label}</p>
      )}
      {status.kind === "error" && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {status.message}
        </p>
      )}
      {status.kind === "published" && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">
          Published!{" "}
          {status.url && (
            <a href={status.url} target="_blank" rel="noopener noreferrer" className="underline">
              View the post on LinkedIn
            </a>
          )}
        </p>
      )}
    </div>
  );
}
