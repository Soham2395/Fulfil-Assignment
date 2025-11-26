"use client";

import { useEffect, useState } from "react";
import { API_BASE, getJSON } from "@/lib/api";

export default function EnvBadge() {
  const [env, setEnv] = useState<string>("");
  const [status, setStatus] = useState<"healthy" | "degraded" | "unknown">("unknown");

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await getJSON<any>(`/health`);
        if (!mounted) return;
        setEnv(res.env || "");
        setStatus(res.status || "unknown");
      } catch {
        if (!mounted) return;
        setStatus("degraded");
      }
    }
    load();
    const t = setInterval(load, 10000);
    return () => { mounted = false; clearInterval(t); };
  }, []);

  const color = status === "healthy" ? "bg-green-600" : status === "degraded" ? "bg-yellow-600" : "bg-zinc-500";

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`inline-block w-2 h-2 rounded-full ${color}`}></span>
      <span className="text-zinc-600 dark:text-zinc-400">{env || "env"}</span>
      <span className="text-zinc-400">•</span>
      <span className="text-zinc-600 dark:text-zinc-400">{status}</span>
      <span className="text-zinc-400">@</span>
      <span className="text-zinc-600 dark:text-zinc-400 truncate max-w-[28ch]" title={API_BASE}>{API_BASE}</span>
    </div>
  );
}
