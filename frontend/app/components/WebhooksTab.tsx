"use client";

import { useEffect, useMemo, useState } from "react";
import { del, getJSON, postJSON, putJSON } from "@/lib/api";

interface Webhook {
  id: number;
  url: string;
  event_type: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  last_response_code?: number | null;
  last_response_time_ms?: number | null;
}

export default function WebhooksTab() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [items, setItems] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({ url: "", event_type: "product.created", enabled: true });
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
      const res = await getJSON<Webhook[]>(`/webhooks/?${params.toString()}`);
      setItems(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page, pageSize]);

  async function createWebhook(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const payload = { url: form.url, event_type: form.event_type, enabled: form.enabled };
      await postJSON<Webhook>(`/webhooks/`, payload);
      setForm({ url: "", event_type: "product.created", enabled: true });
      await load();
    } catch (e: any) {
      alert(e?.message || "Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function deleteWebhook(id: number) {
    if (!confirm("Delete this webhook?")) return;
    try {
      await del(`/webhooks/${id}`);
      await load();
    } catch (e: any) {
      alert(e?.message || "Delete failed");
    }
  }

  async function toggleEnabled(item: Webhook) {
    try {
      await putJSON<Webhook>(`/webhooks/${item.id}`, { enabled: !item.enabled });
      await load();
    } catch (e: any) {
      alert(e?.message || "Update failed");
    }
  }

  async function testWebhook(id: number) {
    try {
      const res = await postJSON<{ task_id: string }>(`/webhooks/${id}/test`, {});
      alert(`Test enqueued: ${res.task_id}`);
    } catch (e: any) {
      alert(e?.message || "Test failed");
    }
  }

  return (
    <div className="space-y-6">
      <div className="border rounded">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900">
            <tr>
              <th className="text-left p-2">ID</th>
              <th className="text-left p-2">Event</th>
              <th className="text-left p-2">URL</th>
              <th className="text-left p-2">Enabled</th>
              <th className="text-left p-2">Last</th>
              <th className="text-left p-2 w-40">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(w => (
              <tr key={w.id} className="border-t">
                <td className="p-2">{w.id}</td>
                <td className="p-2">{w.event_type}</td>
                <td className="p-2 truncate max-w-[28ch]" title={w.url}>{w.url}</td>
                <td className="p-2">
                  <button onClick={()=>toggleEnabled(w)} className={`px-2 py-1 rounded text-xs ${w.enabled?"bg-green-600":"bg-zinc-400"} text-white`}>{w.enabled?"On":"Off"}</button>
                </td>
                <td className="p-2 text-xs text-zinc-600">{w.last_response_code ?? "-"} ({w.last_response_time_ms ?? "-"}ms)</td>
                <td className="p-2 flex gap-2">
                  <button onClick={()=>testWebhook(w.id)} className="px-2 py-1 border rounded text-xs">Test</button>
                  <button onClick={()=>deleteWebhook(w.id)} className="px-2 py-1 border border-red-600 text-red-600 rounded text-xs">Delete</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td className="p-4 text-center text-zinc-500" colSpan={6}>{loading?"Loading...":"No webhooks"}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-2">
        <label className="text-xs">Page size</label>
        <select value={pageSize} onChange={e=>setPageSize(Number(e.target.value))} className="border rounded px-2 py-1 text-sm">
          {[10,20,50,100,200].map(n=> <option key={n} value={n}>{n}</option>)}
        </select>
        <button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="px-2 py-1 border rounded text-sm disabled:opacity-50">Prev</button>
        <span className="text-sm">Page {page}</span>
        <button onClick={()=>setPage(p=>p+1)} className="px-2 py-1 border rounded text-sm">Next</button>
      </div>

      <div className="border rounded p-3">
        <h3 className="font-medium mb-2">Create Webhook</h3>
        <form onSubmit={createWebhook} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input placeholder="https://example.com/webhook" value={form.url} onChange={e=>setForm({...form, url: e.target.value})} className="border rounded px-2 py-1 text-sm md:col-span-2" required />
          <input placeholder="Event (e.g. product.created)" value={form.event_type} onChange={e=>setForm({...form, event_type: e.target.value})} className="border rounded px-2 py-1 text-sm" required />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.enabled} onChange={e=>setForm({...form, enabled: e.target.checked})}/> Enabled</label>
          <div className="md:col-span-4">
            <button disabled={creating} className="px-3 py-2 rounded bg-black text-white text-sm disabled:opacity-50">Create</button>
          </div>
        </form>
      </div>
    </div>
  );
}
