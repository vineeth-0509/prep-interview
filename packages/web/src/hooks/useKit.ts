"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Kit, KitDocument } from "@/lib/types";

export function useKit(id: string) {
  const [doc, setDoc] = useState<KitDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    const d = await api.get<KitDocument>(`/api/kits/${id}`);
    setDoc(d);
    return d;
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    refresh().finally(() => !cancelled && setLoading(false));

    pollRef.current = setInterval(async () => {
      const d = await refresh();
      if (d.pipeline_status !== "running" && pollRef.current) {
        clearInterval(pollRef.current);
      }
    }, 3000);

    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refresh]);

  const saveKit = useCallback(
    async (updatedKit: Kit) => {
      setSaving(true);
      try {
        const d = await api.patch<KitDocument>(`/api/kits/${id}`, { kit: updatedKit });
        setDoc(d);
      } finally {
        setSaving(false);
      }
    },
    [id],
  );

  const regenerate = useCallback(
    async (scope: string) => {
      setSaving(true);
      try {
        const d = await api.post<KitDocument>(`/api/kits/${id}/regenerate`, { scope });
        setDoc(d);
      } finally {
        setSaving(false);
      }
    },
    [id],
  );

  return { doc, loading, saving, saveKit, regenerate, refresh };
}
