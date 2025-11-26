"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { postForm, subscribeSSE, getJSON } from "@/lib/api";

export default function UploadTab() {
  const [taskId, setTaskId] = useState<string | null>(null);
  const [progress, setProgress] = useState<any | null>(null);
  const [errors, setErrors] = useState<any[]>([]);
  const esRef = useRef<EventSource | null>(null);
  const [busy, setBusy] = useState(false);
  const [startMs, setStartMs] = useState<number | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Subscribe to SSE when we have a taskId
  useEffect(() => {
    if (!taskId) return;
    const es = subscribeSSE(`/uploads/progress/${taskId}/stream`, (p) => {
      setProgress(p);
      if (!startMs) setStartMs(Date.now());
    });
    esRef.current = es;
    return () => {
      es.close();
      esRef.current = null;
    };
  }, [taskId]);

  // Poll errors periodically while the task is active (stop on completed/failed)
  useEffect(() => {
    let t: any;
    const status = progress?.status as string | undefined;
    const terminal = status === "completed" || status === "failed";
    async function poll() {
      if (!taskId || terminal) return;
      try {
        const res = await getJSON<{ count: number; items: any[] }>(`/uploads/errors/${taskId}?limit=50`);
        setErrors(res.items || []);
      } catch { }
      t = setTimeout(poll, 2000);
    }
    if (taskId && !terminal) poll();
    return () => t && clearTimeout(t);
  }, [taskId, progress?.status]);

  const handleFile = async (file: File) => {
    if (!file) return;
    setBusy(true);
    setProgress(null);
    setErrors([]);
    setStartMs(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await postForm<{ task_id: string }>(`/uploads/csv`, form);
      setTaskId(res.task_id);
      // Immediately set status to queued so UI shows the active state
      setProgress({ status: "queued", processed: 0, total: 0 });
    } catch (err: any) {
      alert(err?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const onDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const status = progress?.status || "idle";
  const completed = status === "completed" || status === "failed";
  const active = status === "queued" || status === "importing" || status === "running";
  const processed = Number(progress?.processed || 0);
  const total = Number(progress?.total || 0);
  const hasTotal = total > 0;
  const percent = hasTotal ? Math.min(100, Math.round((processed / total) * 100)) : 0;

  // Speed & ETA
  const elapsedSec = startMs ? Math.max(0, Math.round((Date.now() - startMs) / 1000)) : 0;
  const rate = elapsedSec > 0 ? Math.round(processed / elapsedSec) : 0; // rows/sec
  const remaining = hasTotal ? Math.max(0, total - processed) : 0;
  const etaSec = rate > 0 && hasTotal ? Math.round(remaining / rate) : undefined;

  // Group errors by message
  const grouped = errors.reduce((acc: Record<string, { count: number; sample?: any }>, e: any) => {
    const key = String(e?.error || "error");
    if (!acc[key]) acc[key] = { count: 0, sample: e };
    acc[key].count += 1;
    return acc;
  }, {});
  const groupedArr = Object.entries(grouped).map(([msg, info]) => ({ message: msg, count: info.count, sample: info.sample }));

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Upload Area */}
      {!active && !completed && (
        <div
          className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 ease-in-out ${dragActive
            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
            : "border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600"
            }`}
          onDragEnter={onDrag}
          onDragLeave={onDrag}
          onDragOver={onDrag}
          onDrop={onDrop}
        >
          <input
            type="file"
            accept=".csv"
            onChange={handleChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={busy}
          />
          <div className="flex flex-col items-center gap-4 pointer-events-none">
            <div className="p-4 rounded-full bg-zinc-100 dark:bg-zinc-800">
              <svg className="w-8 h-8 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
                {busy ? "Starting upload..." : "Drop your CSV file here"}
              </p>
              <p className="text-sm text-zinc-500 mt-1">or click to browse</p>
            </div>
          </div>
        </div>
      )}

      {/* Active State */}
      {active && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                <div className="absolute inset-0 w-3 h-3 bg-blue-500 rounded-full animate-ping opacity-75"></div>
              </div>
              <div>
                <h3 className="font-medium text-zinc-900 dark:text-zinc-100">Importing Products</h3>
                <p className="text-xs text-zinc-500">Task ID: {taskId}</p>
              </div>
            </div>
            {etaSec !== undefined && (
              <div className="text-sm text-zinc-500 font-mono">
                ~{Math.floor(etaSec / 60)}m {etaSec % 60}s remaining
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm text-zinc-600 dark:text-zinc-400">
              <span>{percent}% complete</span>
              <span>{processed.toLocaleString()} / {total.toLocaleString()} rows</span>
            </div>
            <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-300 ease-out"
                style={{ width: `${percent}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-zinc-500 mt-2">
              <span>Status: {status}</span>
              <span>Speed: {rate.toLocaleString()} rows/sec</span>
            </div>
          </div>
        </div>
      )}

      {/* Completed State */}
      {completed && (
        <div className={`rounded-xl border p-6 ${status === 'completed'
          ? 'bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-900'
          : 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-900'
          }`}>
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-full ${status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
              }`}>
              {status === 'completed' ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <div className="flex-1">
              <h3 className={`font-medium ${status === 'completed' ? 'text-green-900 dark:text-green-100' : 'text-red-900 dark:text-red-100'
                }`}>
                Import {status === 'completed' ? 'Successful' : 'Failed'}
              </h3>
              <p className={`text-sm ${status === 'completed' ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                }`}>
                Processed {processed.toLocaleString()} rows with {errors.length} errors.
              </p>
            </div>
            <button
              onClick={() => { setTaskId(null); setProgress(null); setErrors([]); setStartMs(null); }}
              className="px-4 py-2 text-sm font-medium bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Upload Another
            </button>
          </div>
        </div>
      )}

      {/* Errors Section */}
      {(active || completed) && groupedArr.length > 0 && (
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          <div className="bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
            <h3 className="font-medium text-zinc-900 dark:text-zinc-100">Import Errors</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-zinc-500 uppercase bg-zinc-50 dark:bg-zinc-800/30">
                <tr>
                  <th className="px-4 py-3">Error Message</th>
                  <th className="px-4 py-3 w-24">Count</th>
                  <th className="px-4 py-3">Sample Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {groupedArr.map((g, i) => (
                  <tr key={i} className="bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <td className="px-4 py-3 font-medium text-red-600 dark:text-red-400">{g.message}</td>
                    <td className="px-4 py-3 text-zinc-500">{g.count}</td>
                    <td className="px-4 py-3">
                      <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded text-zinc-600 dark:text-zinc-400">
                        {JSON.stringify(g.sample?.data || {}, null, 0)}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

