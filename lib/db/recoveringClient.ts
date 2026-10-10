import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaClient, Prisma } from "@prisma/client";

// Postgres's session-ending messages for SQLSTATE 57P01/57P02, with the
// severity it sends each at (src/backend/tcop/postgres.c).
const SESSION_TERMINATED = /(?:FATAL: terminating connection due to administrator command|WARNING: terminating connection (?:because of crash of another server process|due to immediate shutdown command|because of unexpected SIGQUIT signal))/;

// A terminated backend surfaces as a dropped connection (P1017); or, when
// Postgres's termination message arrives first, as a failed raw query (P2010)
// carrying the server's admin/crash shutdown or connection-exception SQLSTATE,
// or as an uncoded request error (seen on batch transactions) whose message is it.
export function isConnectionLoss(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientUnknownRequestError) return SESSION_TERMINATED.test(error.message);
  if (!(error instanceof Error) || !("code" in error)) return false;
  if (error.code === "P1017") return true;
  const sqlState = (error as { meta?: { code?: unknown } }).meta?.code;
  return error.code === "P2010" && typeof sqlState === "string" && (["57P01", "57P02"].includes(sqlState) || sqlState.startsWith("08"));
}

export function createRecoveringClient(options?: Prisma.PrismaClientOptions) {
  const base = new PrismaClient(options);
  const transactionContext = new AsyncLocalStorage<boolean>();
  let active = 0;
  let recovery: Promise<void> | undefined;
  let releaseRecovery: (() => void) | undefined;

  async function run<T>(operation: () => PromiseLike<T>): Promise<T> {
    if (recovery) await recovery;
    active++;
    try {
      return await operation();
    } catch (error) {
      if (isConnectionLoss(error) && !recovery) {
        recovery = new Promise<void>(resolve => { releaseRecovery = resolve; });
      }
      throw error;
    } finally {
      active--;
      if (active === 0 && recovery) {
        try {
          await base.$disconnect().catch(() => {});
        } finally {
          recovery = undefined;
          releaseRecovery?.();
          releaseRecovery = undefined;
        }
      }
    }
  }

  const transaction = ((...args: unknown[]) => run(() => transactionContext.run(true, () => Reflect.apply(base.$transaction, base, args)))) as typeof base.$transaction;
  return base.$extends({
    name: "connection-loss-recovery",
    query: {
      async $allOperations({ args, query }) {
        if (transactionContext.getStore()) return query(args);
        return run(() => query(args));
      },
    },
    client: { $transaction: transaction },
  });
}

export type RecoveringClient = ReturnType<typeof createRecoveringClient>;
