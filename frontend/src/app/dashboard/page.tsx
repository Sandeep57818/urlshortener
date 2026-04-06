// src/app/dashboard/page.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Link2, Copy, Check, Trash2, QrCode, BarChart3, Plus, LogOut,
  Loader2, ExternalLink, RefreshCw, Shield, TrendingUp, MousePointerClick,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { copyToClipboard, formatNumber, formatDate, isExpired } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface ShortUrl {
  id: string;
  shortCode: string;
  originalUrl: string;
  shortUrl: string;
  title: string | null;
  clickCount: number;
  createdAt: string;
  expiresAt: string | null;
  isActive: boolean;
}

interface GlobalStats {
  totalUrls: number;
  totalClicks: number;
  totalUsers: number;
  clicksLast24h: number;
}

interface UrlAnalytics {
  totalClicks: number;
  clicksByDay: { date: string; clicks: number }[];
  topCountries: { country: string; count: number }[];
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, logout, fetchMe } = useAuthStore();
  const [urls, setUrls] = useState<ShortUrl[]>([]);
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedAnalytics, setSelectedAnalytics] = useState<{ id: string; data: UrlAnalytics } | null>(null);
  const [selectedQR, setSelectedQR] = useState<{ shortUrl: string; qrCode: string } | null>(null);
  const [form, setForm] = useState({ originalUrl: "", customCode: "", title: "", expiresAt: "" });

  const loadData = useCallback(async () => {
    try {
      const [urlsRes, statsRes] = await Promise.all([
        api.get<{ success: boolean; data: ShortUrl[] }>("/api/urls"),
        api.get<{ success: boolean; data: GlobalStats }>("/api/analytics/global/stats"),
      ]);
      const domain = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      setUrls(urlsRes.data.map((u) => ({ ...u, shortUrl: u.shortUrl || `${domain}/${u.shortCode}` })));
      setStats(statsRes.data);
    } catch (err) {
      if (err instanceof Error && err.message.includes("401")) router.push("/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchMe().then(loadData);
  }, [fetchMe, loadData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const payload: Record<string, string> = { originalUrl: form.originalUrl };
      if (form.customCode) payload.customCode = form.customCode;
      if (form.title) payload.title = form.title;
      if (form.expiresAt) payload.expiresAt = new Date(form.expiresAt).toISOString();

      const res = await api.post<{ success: boolean; data: ShortUrl & { qrCode: string } }>("/api/shorten", payload);
      toast.success("URL shortened!");
      setForm({ originalUrl: "", customCode: "", title: "", expiresAt: "" });
      setShowForm(false);
      await loadData();
      if (res.data.qrCode) setSelectedQR({ shortUrl: res.data.shortUrl, qrCode: res.data.qrCode });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create URL");
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async (url: ShortUrl) => {
    await copyToClipboard(url.shortUrl);
    setCopiedId(url.id);
    toast.success("Copied!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this URL?")) return;
    try {
      await api.delete(`/api/urls/${id}`);
      toast.success("Deleted");
      setUrls((prev) => prev.filter((u) => u.id !== id));
    } catch {
      toast.error("Delete failed");
    }
  };

  const handleAnalytics = async (url: ShortUrl) => {
    try {
      const res = await api.get<{ success: boolean; data: { analytics: UrlAnalytics } }>(`/api/analytics/${url.id}`);
      setSelectedAnalytics({ id: url.id, data: res.data.analytics });
    } catch {
      toast.error("Failed to load analytics");
    }
  };

  const handleQR = async (url: ShortUrl) => {
    try {
      const res = await api.get<{ success: boolean; data: { qrCode: string } }>(`/api/qr/${url.shortCode}`);
      setSelectedQR({ shortUrl: url.shortUrl, qrCode: res.data.qrCode });
    } catch {
      toast.error("QR generation failed");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Topbar */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-500 rounded-lg flex items-center justify-center">
              <Link2 size={14} />
            </div>
            <span className="font-bold">LinkSnap</span>
            {user?.role === "ADMIN" && (
              <a href="/admin" className="ml-4 flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 bg-amber-400/10 border border-amber-400/20 px-2 py-1 rounded-full">
                <Shield size={11} /> Admin
              </a>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400">{user?.email}</span>
            <button onClick={logout} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Links", value: formatNumber(stats.totalUrls), icon: Link2, color: "text-indigo-400" },
              { label: "Total Clicks", value: formatNumber(stats.totalClicks), icon: MousePointerClick, color: "text-purple-400" },
              { label: "Clicks (24h)", value: formatNumber(stats.clicksLast24h), icon: TrendingUp, color: "text-green-400" },
              { label: "My Links", value: formatNumber(urls.length), icon: BarChart3, color: "text-blue-400" },
            ].map((s) => (
              <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400">{s.label}</span>
                  <s.icon size={16} className={s.color} />
                </div>
                <p className="text-2xl font-bold">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Create */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Shorten a URL</h2>
            <div className="flex gap-2">
              <button onClick={loadData} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all">
                <RefreshCw size={14} />
              </button>
              <button onClick={() => setShowForm(!showForm)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 rounded-lg text-sm font-medium transition-all">
                <Plus size={14} /> New
              </button>
            </div>
          </div>

          {showForm && (
            <form onSubmit={handleCreate} className="space-y-3 mb-4 p-4 bg-white/5 rounded-xl border border-white/10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <input value={form.originalUrl} onChange={(e) => setForm({ ...form, originalUrl: e.target.value })}
                    placeholder="https://your-long-url.com" required
                    className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
                </div>
                <input value={form.customCode} onChange={(e) => setForm({ ...form, customCode: e.target.value })}
                  placeholder="Custom code (optional)" maxLength={20}
                  className="px-3 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Title (optional)"
                  className="px-3 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
                <div className="md:col-span-2">
                  <label className="text-xs text-slate-400 mb-1 block">Expires At (optional)</label>
                  <input type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                    className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={creating}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 rounded-xl text-sm font-semibold transition-all">
                  {creating ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                  {creating ? "Creating..." : "Shorten URL"}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2.5 text-sm text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* URL Table */}
          {urls.length === 0 ? (
            <div className="py-12 text-center">
              <Link2 size={40} className="text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No links yet — create your first one above</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-slate-400">
                    <th className="pb-3 pr-4">Short URL</th>
                    <th className="pb-3 pr-4">Original</th>
                    <th className="pb-3 pr-4">Clicks</th>
                    <th className="pb-3 pr-4">Created</th>
                    <th className="pb-3 pr-4">Expires</th>
                    <th className="pb-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {urls.map((url) => (
                    <tr key={url.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-1.5">
                          <a href={url.shortUrl} target="_blank" rel="noopener noreferrer"
                            className="text-indigo-400 font-mono hover:underline">
                            /{url.shortCode}
                          </a>
                          {isExpired(url.expiresAt) && (
                            <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">expired</span>
                          )}
                        </div>
                        {url.title && <p className="text-xs text-slate-500 mt-0.5">{url.title}</p>}
                      </td>
                      <td className="py-3 pr-4 max-w-xs">
                        <a href={url.originalUrl} target="_blank" rel="noopener noreferrer"
                          className="text-slate-300 hover:text-white text-xs truncate block max-w-[200px]" title={url.originalUrl}>
                          {url.originalUrl}
                        </a>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="font-semibold">{formatNumber(url.clickCount)}</span>
                      </td>
                      <td className="py-3 pr-4 text-slate-400 text-xs">{formatDate(url.createdAt)}</td>
                      <td className="py-3 pr-4 text-xs text-slate-400">
                        {url.expiresAt ? formatDate(url.expiresAt) : "Never"}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleCopy(url)} title="Copy"
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all">
                            {copiedId === url.id ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                          </button>
                          <button onClick={() => handleAnalytics(url)} title="Analytics"
                            className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-white/10 rounded-lg transition-all">
                            <BarChart3 size={14} />
                          </button>
                          <button onClick={() => handleQR(url)} title="QR Code"
                            className="p-1.5 text-slate-400 hover:text-purple-400 hover:bg-white/10 rounded-lg transition-all">
                            <QrCode size={14} />
                          </button>
                          <a href={url.shortUrl} target="_blank" rel="noopener noreferrer" title="Open"
                            className="p-1.5 text-slate-400 hover:text-green-400 hover:bg-white/10 rounded-lg transition-all">
                            <ExternalLink size={14} />
                          </a>
                          <button onClick={() => handleDelete(url.id)} title="Delete"
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-white/10 rounded-lg transition-all">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Analytics modal */}
        {selectedAnalytics && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg">Analytics</h3>
                <button onClick={() => setSelectedAnalytics(null)} className="text-slate-400 hover:text-white text-xl">✕</button>
              </div>
              <div className="mb-4">
                <p className="text-slate-400 text-sm mb-1">Total Clicks (30 days)</p>
                <p className="text-3xl font-bold">{formatNumber(selectedAnalytics.data.totalClicks)}</p>
              </div>
              {selectedAnalytics.data.clicksByDay.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm text-slate-400 mb-2">Daily Clicks</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={selectedAnalytics.data.clicksByDay}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }} />
                      <Line type="monotone" dataKey="clicks" stroke="#6172f3" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              {selectedAnalytics.data.topCountries.length > 0 && (
                <div>
                  <p className="text-sm text-slate-400 mb-2">Top Countries</p>
                  <div className="space-y-2">
                    {selectedAnalytics.data.topCountries.slice(0, 5).map((c) => (
                      <div key={c.country} className="flex items-center justify-between text-sm">
                        <span className="text-slate-300">{c.country}</span>
                        <span className="text-indigo-400 font-mono">{c.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* QR modal */}
        {selectedQR && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 text-center max-w-sm w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">QR Code</h3>
                <button onClick={() => setSelectedQR(null)} className="text-slate-400 hover:text-white text-xl">✕</button>
              </div>
              <img src={selectedQR.qrCode} alt="QR Code" className="mx-auto rounded-xl mb-4 bg-white p-3 w-48 h-48" />
              <p className="text-sm text-indigo-400 font-mono mb-4">{selectedQR.shortUrl}</p>
              <a href={selectedQR.qrCode} download="qr-code.png"
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-xl text-sm font-medium transition-all">
                Download PNG
              </a>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Zap({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>;
}
