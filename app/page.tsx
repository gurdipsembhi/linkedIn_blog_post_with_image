import { getUsableAccount, saveAccount } from "@/lib/account";
import PostComposer from "@/components/post-composer";
import Scheduler from "@/components/scheduler";
import { getSession } from "@/lib/session";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  const { error } = await searchParams;

  // Backfill the server-side token store from a valid browser session, so accounts
  // connected before that store existed get the scheduler without a full reconnect.
  if (session && !(await getUsableAccount())) {
    await saveAccount(session);
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">LinkedIn Post Agent</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Draft domain-specific posts and publish them to your LinkedIn profile.
      </p>

      {error && (
        <p className="mt-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {session ? (
        <>
          <div className="mt-8 flex items-center justify-between text-sm">
            <span>
              Connected as <strong>{session.name}</strong>
            </span>
            <a href="/api/auth/logout" className="text-zinc-500 underline hover:text-zinc-700">
              Disconnect
            </a>
          </div>
          <PostComposer />
          <Scheduler />
        </>
      ) : (
        <a
          href="/api/auth/linkedin"
          className="mt-10 inline-block rounded-md bg-[#0a66c2] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#004182]"
        >
          Connect LinkedIn
        </a>
      )}
    </main>
  );
}
