"use client";

import { useState } from "react";
import { refreshStorefrontAction, revokeOtherSessionsAction } from "@/lib/actions/settings";

export function SettingsMaintenanceAction({ task }: { task: "cache" | "sessions" }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const label = task === "cache" ? "Invalidate storefront cache" : "Sign out other sessions";

  return (
    <div>
      <button type="button" disabled={pending} className="rounded-md border border-border px-4 py-2 text-sm font-semibold"
        onClick={async () => {
          if (!window.confirm(`${label}?`)) return;
          setPending(true);
          setMessage("");
          try {
            if (task === "sessions") {
              setMessage(await revokeOtherSessionsAction());
            } else {
              await refreshStorefrontAction();
              setMessage("Storefront cache invalidated.");
            }
          } catch {
            setMessage("Could not complete the action.");
          } finally {
            setPending(false);
          }
        }}>{pending ? "Working…" : label}</button>
      <p role="status" className="mt-2 text-sm">{message}</p>
    </div>
  );
}
