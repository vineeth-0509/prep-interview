"use client";

import { useCallback, useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { KitCreateForm } from "@/components/KitCreateForm";
import { KitList } from "@/components/KitList";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import type { KitListItem } from "@/lib/types";

function Dashboard() {
  const { user, logout } = useAuth();
  const [kits, setKits] = useState<KitListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    api
      .get<KitListItem[]>("/api/kits")
      .then(setKits)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
    // Poll while anything is still generating, so status updates without
    // a manual refresh.
    const interval = setInterval(() => {
      setKits((current) => {
        if (current.some((k) => k.pipeline_status === "running")) refresh();
        return current;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-ink">Your prep kits</h1>
          <p className="mt-1 text-sm text-slate">Signed in as {user?.email}</p>
        </div>
        <button onClick={() => logout()} className="text-sm text-slate underline">
          Sign out
        </button>
      </div>

      <div className="mt-8">
        <KitCreateForm onCreated={refresh} />
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-slate">Loading…</p>
      ) : (
        <KitList kits={kits} onKitDeleted={refresh} />
      )}
    </main>
  );
}

export default function HomePage() {
  return (
    <RequireAuth>
      <Dashboard />
    </RequireAuth>
  );
}
