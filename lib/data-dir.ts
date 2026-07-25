import path from "path";

// Base directory for the local-file stopgap stores (account, history, queue,
// schedule, rendered images). Vercel's serverless filesystem is read-only except
// for /tmp, so writing to process.cwd()/data throws ENOENT there. /tmp is writable
// but EPHEMERAL and per-instance — data does NOT persist across cold starts or
// between function invocations. This is a demo-grade unblock only; the durable fix
// is a real database (roadmap item 3).
export const DATA_DIR = process.env.VERCEL
  ? path.join("/tmp", "data")
  : path.join(process.cwd(), "data");
