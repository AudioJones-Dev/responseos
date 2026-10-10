import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaClient, type Prisma } from "@prisma/client";

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
      if (error instanceof Error && "code" in error && error.code === "P1017" && !recovery) {
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
