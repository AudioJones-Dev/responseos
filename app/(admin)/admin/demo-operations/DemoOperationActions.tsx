"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";

export function ProspectActions(props: {
  id: string;
  status: "received" | "reviewed" | "qualified" | "rejected";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const targets = props.status === "received"
    ? (["reviewed"] as const)
    : props.status === "reviewed"
      ? (["qualified", "rejected"] as const)
      : [];

  async function transition(status: string) {
    setBusy(true);
    try {
      await fetch(`/api/admin/prospect-intakes/${props.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-2">
      {targets.map((target) => (
        <Button key={target} disabled={busy} onClick={() => transition(target)}>
          {target === "reviewed" ? "Mark reviewed" : target === "qualified" ? "Qualify" : "Reject"}
        </Button>
      ))}
    </div>
  );
}

export function CrmRetryAction(props: { id: string; retryable: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (!props.retryable) return null;

  return (
    <Button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await fetch(`/api/admin/crm-sync-operations/${props.id}/retry`, {
            method: "POST",
          });
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      Retry sync
    </Button>
  );
}
