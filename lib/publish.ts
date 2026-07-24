import { readFile } from "fs/promises";
import path from "path";
import { recordPost } from "./history";
import { createPost, uploadImage } from "./linkedin";
import { IMAGES_DIR } from "./render";

export type PublishInput = {
  accessToken: string;
  personId: string;
  text: string;
  domain?: string;
  source?: { title: string; link: string } | null;
  imageFile?: string | null;
  imageAlt?: string | null;
};

export type PublishResult = { postUrn: string | null; url: string | null };

/**
 * Uploads the optional explainer image, publishes the post, and records it to history.
 * Shared by the manual publish route and the scheduler so both behave identically.
 */
export async function publishPost(input: PublishInput): Promise<PublishResult> {
  let image: { urn: string; altText?: string } | undefined;
  if (input.imageFile) {
    const name = path.basename(input.imageFile);
    let data: Buffer;
    try {
      data = await readFile(path.join(IMAGES_DIR, name));
    } catch {
      throw new Error("Attached image file not found — regenerate the image and try again.");
    }
    const urn = await uploadImage(input.accessToken, input.personId, data);
    image = { urn, ...(input.imageAlt && { altText: `Explainer: ${input.imageAlt}` }) };
  }

  const postUrn = await createPost(input.accessToken, input.personId, input.text, image);

  try {
    await recordPost({
      postedAt: new Date().toISOString(),
      domain: input.domain ?? "",
      postUrn,
      sourceTitle: input.source?.title ?? null,
      sourceLink: input.source?.link ?? null,
    });
  } catch (historyErr) {
    console.error("Post published but history write failed:", historyErr);
  }

  return {
    postUrn,
    url: postUrn ? `https://www.linkedin.com/feed/update/${postUrn}/` : null,
  };
}
