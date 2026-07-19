const AUTH_BASE = "https://www.linkedin.com/oauth/v2";
const API_BASE = "https://api.linkedin.com";

// LinkedIn requires an API version (YYYYMM) from the last 12 months. Default to two
// months back so it never ages out; override via LINKEDIN_VERSION if that month is missing.
function defaultVersion(): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 2);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
const LINKEDIN_VERSION = process.env.LINKEDIN_VERSION ?? defaultVersion();

export function getAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LINKEDIN_CLIENT_ID!,
    redirect_uri: process.env.LINKEDIN_REDIRECT_URI!,
    state,
    scope: "openid profile w_member_social",
  });
  return `${AUTH_BASE}/authorization?${params}`;
}

export async function exchangeCodeForToken(
  code: string
): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch(`${AUTH_BASE}/accessToken`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      redirect_uri: process.env.LINKEDIN_REDIRECT_URI!,
    }),
  });
  if (!res.ok) {
    throw new Error(`LinkedIn token exchange failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

export async function getUserInfo(
  accessToken: string
): Promise<{ sub: string; name: string }> {
  const res = await fetch(`${API_BASE}/v2/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`LinkedIn userinfo failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

// The commentary field uses LinkedIn's "little text" format; these characters
// are reserved and must be backslash-escaped or the API may reject the post.
function escapeCommentary(text: string): string {
  return text.replace(/[\\|{}@\[\]()<>#*_~]/g, (char) => `\\${char}`);
}

function restHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    "LinkedIn-Version": LINKEDIN_VERSION,
    "X-Restli-Protocol-Version": "2.0.0",
    "Content-Type": "application/json",
  };
}

/** Uploads an image via the Images API and returns its URN once processed. */
export async function uploadImage(
  accessToken: string,
  personId: string,
  data: Buffer
): Promise<string> {
  const init = await fetch(`${API_BASE}/rest/images?action=initializeUpload`, {
    method: "POST",
    headers: restHeaders(accessToken),
    body: JSON.stringify({
      initializeUploadRequest: { owner: `urn:li:person:${personId}` },
    }),
  });
  if (!init.ok) {
    throw new Error(`LinkedIn image upload init failed (${init.status}): ${await init.text()}`);
  }
  const { value } = await init.json();

  const put = await fetch(value.uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: new Uint8Array(data),
  });
  if (!put.ok) {
    throw new Error(`LinkedIn image upload failed (${put.status}): ${await put.text()}`);
  }

  // Processing is async; wait (best-effort) so post creation doesn't race it.
  for (let i = 0; i < 10; i++) {
    const res = await fetch(`${API_BASE}/rest/images/${encodeURIComponent(value.image)}`, {
      headers: restHeaders(accessToken),
    });
    if (res.ok) {
      const info = await res.json();
      if (info.status === "AVAILABLE") break;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return value.image;
}

/** Publishes a post (optionally with an image) on the member's profile. Returns the post URN. */
export async function createPost(
  accessToken: string,
  personId: string,
  text: string,
  image?: { urn: string; altText?: string }
): Promise<string | null> {
  const res = await fetch(`${API_BASE}/rest/posts`, {
    method: "POST",
    headers: restHeaders(accessToken),
    body: JSON.stringify({
      author: `urn:li:person:${personId}`,
      commentary: escapeCommentary(text),
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      ...(image && {
        content: {
          media: { id: image.urn, ...(image.altText && { altText: image.altText }) },
        },
      }),
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
  });
  if (!res.ok) {
    throw new Error(`LinkedIn post creation failed (${res.status}): ${await res.text()}`);
  }
  return res.headers.get("x-restli-id");
}
