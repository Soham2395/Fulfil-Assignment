"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { del, getJSON, postJSON } from "@/lib/api";

interface Product {
  id: number;
  sku: string;
  name: string;
  description?: string | null;
  price?: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface PageResp {
  total: number;
  page: number;
  page_size: number;
  items: Product[];
}

export default function ProductsTab() {
  const search = useSearchParams();
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [active, setActive] = useState<string>("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [data, setData] = useState<PageResp | null>(null);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({ sku: "", name: "", description: "", price: "", active: true });
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const totalPages = useMemo(() => data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1, [data]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
      if (sku) params.set("sku", sku);
      if (name) params.set("name", name);
      if (active) params.set("active", active);
      const res = await getJSON<PageResp>(`/products/?${params.toString()}`);
      setData(res);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page, pageSize]);

  // When user switches to the Products tab, refresh the list
  useEffect(() => {
    if (search.get("tab") === "products") {
      load();
    }
  }, [search]);

  // Refresh when window regains focus, but only if Products tab is active
  useEffect(() => {
    function onFocus() {
      if (search.get("tab") === "products") {
        load();
      }
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load();
  }

  async function createProduct(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const payload: any = {
        sku: form.sku,
        name: form.name,
        description: form.description || null,
        price: form.price ? Number(form.price) : null,
        active: form.active,
      };
      await postJSON<Product>(`/products/`, payload);
      setForm({ sku: "", name: "", description: "", price: "", active: true });
      setShowCreate(false);
      await load();
    } catch (e: any) {
      alert(e?.message || "Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function deleteProduct(id: number) {
    if (!confirm("Delete this product?")) return;
    try {
      await del(`/products/${id}`);
      await load();
    } catch (e: any) {
      alert(e?.message || "Delete failed");
    }
  }

  async function deleteAll() {
    if (!confirm("Delete ALL products? This cannot be undone.")) return;
    try {
      await del(`/products/?confirm=true`);
      await load();
    } catch (e: any) {
      alert(e?.message || "Bulk delete failed");
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Products</h2>
          <p className="text-sm text-zinc-500">Manage your product catalog</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {showCreate ? "Cancel" : "Add Product"}
          </button>
          <button
            onClick={deleteAll}
            className="px-4 py-2 bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm font-medium transition-colors"
          >
            Delete All
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm animate-in fade-in slide-in-from-top-4">
          <h3 className="font-medium mb-4 text-zinc-900 dark:text-zinc-100">New Product</h3>
          <form onSubmit={createProduct} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-3">
              <label className="block text-xs font-medium text-zinc-500 mb-1">SKU</label>
              <input
                placeholder="e.g. PROD-001"
                value={form.sku}
                onChange={e => setForm({ ...form, sku: e.target.value })}
                className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-zinc-800"
                required
              />
            </div>
            <div className="lg:col-span-4">
              <label className="block text-xs font-medium text-zinc-500 mb-1">Name</label>
              <input
                placeholder="Product Name"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-zinc-800"
                required
              />
            </div>
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-zinc-500 mb-1">Price</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.price}
                onChange={e => setForm({ ...form, price: e.target.value })}
                className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-zinc-800"
              />
            </div>
            <div className="lg:col-span-3 flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-zinc-500 mb-1">Status</label>
                <select
                  value={form.active ? "true" : "false"}
                  onChange={e => setForm({ ...form, active: e.target.value === "true" })}
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-zinc-800"
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
              <button
                disabled={creating}
                className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
            <div className="lg:col-span-12">
              <label className="block text-xs font-medium text-zinc-500 mb-1">Description</label>
              <input
                placeholder="Optional description"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-zinc-800"
              />
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm">
        <form onSubmit={applyFilters} className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-zinc-500 mb-1">Search SKU</label>
            <div className="relative">
              <input
                value={sku}
                onChange={e => setSku(e.target.value)}
                className="w-full pl-9 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-zinc-800"
                placeholder="Search..."
              />
              <svg className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-zinc-500 mb-1">Search Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-zinc-800"
              placeholder="Product name..."
            />
          </div>
          <div className="w-32">
            <label className="block text-xs font-medium text-zinc-500 mb-1">Status</label>
            <select
              value={active}
              onChange={e => setActive(e.target.value)}
              className="w-full border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-zinc-800"
            >
              <option value="">All</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
          <button className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-lg text-sm font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
            Apply Filters
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 uppercase text-xs font-medium">
              <tr>
                <th className="px-6 py-3">Product</th>
                <th className="px-6 py-3">SKU</th>
                <th className="px-6 py-3">Price</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/4"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3"></div></td>
                    <td className="px-6 py-4"></td>
                  </tr>
                ))
              ) : data?.items?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-8 h-8 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                      <p>No products found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                data?.items?.map(p => (
                  <tr key={p.id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">{p.name}</div>
                      {p.description && <div className="text-xs text-zinc-500 truncate max-w-xs">{p.description}</div>}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-zinc-600 dark:text-zinc-400">{p.sku}</td>
                    <td className="px-6 py-4 text-zinc-900 dark:text-zinc-100">
                      {p.price !== null && p.price !== undefined ? `$${Number(p.price).toFixed(2)}` : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${p.active
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}>
                        {p.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => deleteProduct(p.id)}
                        className="text-zinc-400 hover:text-red-600 transition-colors p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                        title="Delete Product"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="bg-zinc-50 dark:bg-zinc-800/50 px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="text-sm text-zinc-500">
            Showing <span className="font-medium">{data?.items?.length || 0}</span> of <span className="font-medium">{data?.total || 0}</span> results
          </div>
          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={e => setPageSize(Number(e.target.value))}
              className="border border-zinc-300 dark:border-zinc-700 rounded-lg px-2 py-1 text-sm bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n} / page</option>)}
            </select>
            <div className="flex rounded-lg border border-zinc-300 dark:border-zinc-700 overflow-hidden">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="px-3 py-1 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 border-r border-zinc-300 dark:border-zinc-700 disabled:opacity-50 disabled:hover:bg-white dark:disabled:hover:bg-zinc-800 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="px-3 py-1 bg-white dark:bg-zinc-800 text-sm font-medium flex items-center">
                {page} / {totalPages}
              </div>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 border-l border-zinc-300 dark:border-zinc-700 disabled:opacity-50 disabled:hover:bg-white dark:disabled:hover:bg-zinc-800 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
