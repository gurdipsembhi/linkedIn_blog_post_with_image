import { getUsableAccount, readAccount } from "./account";
import { generateExplainerImage } from "./image-pipeline";
import { generatePost, type GenerateInput } from "./pipeline";
import { publishPost } from "./publish";
import { enqueueDraft } from "./queue";
import { getSchedule, saveSchedule, todayKey } from "./schedule";

export type RunOutcome = {
  ran: boolean;
  status: "published" | "queued" | "skipped" | "error";
  message: string;
};

/**
 * One scheduled cycle: generate a post for the configured domain/topic, optionally render
 * an explainer image, then either auto-publish or drop it in the review queue. The schedule's
 * status fields are updated so the dashboard can show what happened. Never throws — failures
 * are recorded in `lastError` and surfaced to the user (per the project's failure-behavior rule).
 *
 * @param force  bypass the ~1/day cap (used by the manual "Run now" button)
 */
export async function runScheduledJob(force = false): Promise<RunOutcome> {
  const schedule = await getSchedule();

  if (!schedule.enabled && !force) {
    return { ran: false, status: "skipped", message: "Scheduler is off." };
  }

  const today = todayKey();
  if (!force && schedule.lastRunDate === today) {
    return { ran: false, status: "skipped", message: "Already ran today (1/day cap)." };
  }

  // Token check — surface expiry instead of failing silently.
  const account = await getUsableAccount();
  if (!account) {
    const existed = await readAccount();
    const message = existed
      ? "LinkedIn token expired — reconnect to resume scheduled posts."
      : "No connected LinkedIn account — connect one to enable scheduling.";
    await saveSchedule({ lastRunAt: new Date().toISOString(), lastError: message, lastResult: null });
    return { ran: false, status: "error", message };
  }

  try {
    const input: GenerateInput =
      schedule.mode === "topic"
        ? { mode: "topic", topic: schedule.topic, notes: schedule.notes || undefined }
        : { mode: "news", domain: schedule.domain, notes: schedule.notes || undefined };
    const post = await generatePost(input);

    let imageFile: string | null = null;
    let imageTitle: string | null = null;
    if (schedule.attachImage) {
      try {
        const image = await generateExplainerImage(
          schedule.mode === "topic" ? schedule.topic : schedule.domain,
          post.text
        );
        imageFile = image.file;
        imageTitle = image.title;
      } catch (imageErr) {
        // The image is optional decoration — a failure here must not block the post.
        console.error("Scheduled image generation failed:", imageErr);
      }
    }

    const stamp = { lastRunDate: today, lastRunAt: new Date().toISOString(), lastError: null };

    if (schedule.autoPublish) {
      const result = await publishPost({
        accessToken: account.accessToken,
        personId: account.personId,
        text: post.text,
        domain: schedule.mode === "news" ? schedule.domain : schedule.topic,
        source: post.source,
        imageFile,
        imageAlt: imageTitle,
      });
      const message = result.url ? `Published: ${result.url}` : "Published.";
      await saveSchedule({ ...stamp, lastResult: message });
      return { ran: true, status: "published", message };
    }

    await enqueueDraft({
      domain: schedule.mode === "news" ? schedule.domain : schedule.topic,
      text: post.text,
      source: post.source,
      imageFile,
      imageTitle,
    });
    const message = "Draft added to the review queue.";
    await saveSchedule({ ...stamp, lastResult: message });
    return { ran: true, status: "queued", message };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scheduled generation failed.";
    await saveSchedule({ lastRunAt: new Date().toISOString(), lastError: message, lastResult: null });
    return { ran: false, status: "error", message };
  }
}
