// src/app/admin/page.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Shield, Users, Link2, MousePointerClick, TrendingUp, Trash2,
  RefreshCw, Search, Loader2, ToggleLeft, ToggleRight, Database,
  Activity, ArrowLeft, ChevronLeft, ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { formatNumber, formatDate } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from "recharts";

interface AdminStats {
  totalUrls: number;
  totalClicks: number;
  totalUsers: number;
  clicksLast24h: number;
  redis: { memory: string; status: string };
}

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: "USER" | "ADMIN";
  isActive: boolean;
  createdAt: string;
  _count: { urls: number };
}

interface AdminUrl {
  id: string;
  shortCode: string;
  originalUrl: string;
  clickCount: number;
  createdAt: string;
  isActive: boolean;
  user: { email: string; name: string | null } | null;
}

type Tab = "overview" | "urls" | "users" | "cache";

export default function AdminPage() {
  const router = useRouter();
  const { user, fetchMe } = useAuthStore();
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [urls, setUrls] = useState<AdminUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [userSearch, setUserSearch] = useState("");
  const [urlSearch, setUrlSearch] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [urlPage, setUrlPage] = useState(1);
  const [userTotal, setUserTotal] = useState(0);
  const [urlTotal, setUrlTotal] = useState(0);

  const loadStats = useCallback(async () => {
    const res = await api.get<{ success: boolean; data: AdminStats }>("/api/admin/stats");
    setStats(res.data);
  }, []);

  const loadUsers = useCallback(async () => {
    const q = userSearch ? `&search=${encodeURIComponent(userSearch)}` : "";
    const res = await api.get<{ success: boolean; data: AdminUser[]; meta: { total: number } }>(
      `/api/admin/users?page=${userPage}&limit=10${q}`
    );
    setUsers(res.data);
    setUserTotal(res.meta.total);
  }, [userSearch, userPage]);

  const loadUrls = useCallback(async () => {
    const q = urlSearch ? `&search=${encodeURIComponent(urlSearch)}` : "";
    const res = await api.get<{ success: boolean; data: AdminUrl[]; meta: { total: number } }>(
      `/api/admin/urls?page=${urlPage}&limit=10${q}`
    );
    setUrls(res.data);
    setUrlTotal(res.meta.total);
  }, [urlSearch, urlPage]);

  useEffect(() => {
    fetchMe().then(async () => {
      const u = useAuthStore.getState().user;
      if (!u) { router.push("/login"); return; }
      if (u.role !== "ADMIN") { toast.error("Admin access required"); router.push("/dashboard"); return; }
      await loadStats();
      setLoading(false);
    });
  }, [fetchMe, loadStats, router]);

  useEffect(() => { if (tab === "users") loadUsers(); }, [tab, loadUsers]);
  useEffect(() => { if (tab === "urls") loadUrls(); }, [tab, loadUrls]);

  const toggleUser = async (id: string) => {
    try {
      await api.patch(`/api/admin/users/${id}/toggle`, {});
      toast.success("User status updated");
      await loadUsers();
    } catch { toast.error("Update failed"); }
  };

  const changeRole = async (id: string, role: "USER" | "ADMIN") => {
    try {
      await api.patch(`/api/admin/users/${id}/role`, { role });
      toast.success("Role updated");
      await loadUsers();
    } catch { toast.error("Update failed"); }
  };

  const deleteUrl = async (id: string) => {
    if (!confirm("Delete this URL and all its click data?")) return;
    try {
      await api.delete(`/api/admin/urls/${id}`);
      toast.success("URL deleted");
      await loadUrls();
      await loadStats();
    } catch { toast.error("Delete failed"); }
  };

  const flushCache = async () => {
    if (!confirm("Flush all Redis cache?")) return;
    try {
      await api.post("/api/admin/cache/flush", {});
      toast.success("Cache flushed");
    } catch { toast.error("Flush failed"); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "overview", label: "Overview", icon: Activity },
    { id: "urls", label: "All URLs", icon: Link2 },
    { id: "users", label: "Users", icon: Users },
    { id: "cache", label: "Cache / System", icon: Database },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all">
              <ArrowLeft size={16} />
            </Link>
            <div className="flex items-center gap-2">
              <Shield size={18} className="text-amber-400" />
              <span className="font-bold">Admin Dashboard</span>
            </div>
          </div>
          <span className="text-sm text-slate-400">{user?.email}</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Tab nav */}
        <div className="flex gap-1 mb-6 bg-white/5 border border-white/10 rounded-xl p-1 w-fit">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.id ? "bg-indigo-500 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview tab */}
        {tab === "overview" && stats && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Links", value: formatNumber(stats.totalUrls), icon: Link2, color: "text-indigo-400" },
                { label: "Total Clicks", value: formatNumber(stats.totalClicks), icon: MousePointerClick, color: "text-purple-400" },
                { label: "Total Users", value: formatNumber(stats.totalUsers), icon: Users, color: "text-emerald-400" },
                { label: "Clicks 24h", value: formatNumber(stats.clicksLast24h), icon: TrendingUp, color: "text-amber-400" },
              ].map((s) => (
                <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-slate-400">{s.label}</span>
                    <s.icon size={16} className={s.color} />
                  </div>
                  <p className="text-3xl font-bold">{s.value}</p>
                </div>
              ))}
            </div>

            {/* Redis status */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Database size={16} className="text-red-400" /> Redis Status
              </h3>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${stats.redis.status === "connected" ? "bg-green-400" : "bg-red-400"}`} />
                  <span className="text-slate-300">{stats.redis.status}</span>
                </div>
                <div className="text-slate-400">Memory: <span className="text-white">{stats.redis.memory}</span></div>
              </div>
            </div>
          </div>
        )}

        {/* URLs tab */}
        {tab === "urls" && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={urlSearch}
                  onChange={(e) => { setUrlSearch(e.target.value); setUrlPage(1); }}
                  placeholder="Search URLs..."
                  className="w-full pl-9 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
              <button onClick={loadUrls} className="p-2.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all">
                <RefreshCw size={14} />
              </button>
              <span className="text-sm text-slate-400">{formatNumber(urlTotal)} total</span>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-slate-400">
                    <th className="px-4 py-3">Short Code</th>
                    <th className="px-4 py-3">Original URL</th>
                    <th className="px-4 py-3">Clicks</th>
                    <th className="px-4 py-3">Owner</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {urls.map((url) => (
                    <tr key={url.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 font-mono text-indigo-400">/{url.shortCode}</td>
                      <td className="px-4 py-3 max-w-xs">
                        <span className="text-slate-300 text-xs truncate block max-w-[220px]" title={url.originalUrl}>
                          {url.originalUrl}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold">{formatNumber(url.clickCount)}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{url.user?.email || "Anonymous"}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(url.createdAt)}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => deleteUrl(url.id)}
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {urls.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No URLs found</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between text-sm text-slate-400">
              <span>Page {urlPage} of {Math.ceil(urlTotal / 10)}</span>
              <div className="flex gap-2">
                <button onClick={() => setUrlPage((p) => Math.max(1, p - 1))} disabled={urlPage === 1}
                  className="p-2 hover:bg-white/10 rounded-lg disabled:opacity-40 transition-all">
                  <ChevronLeft size={14} />
                </button>
                <button onClick={() => setUrlPage((p) => p + 1)} disabled={urlPage >= Math.ceil(urlTotal / 10)}
                  className="p-2 hover:bg-white/10 rounded-lg disabled:opacity-40 transition-all">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Users tab */}
        {tab === "users" && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={userSearch}
                  onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }}
                  placeholder="Search users..."
                  className="w-full pl-9 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
              <button onClick={loadUsers} className="p-2.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all">
                <RefreshCw size={14} />
              </button>
              <span className="text-sm text-slate-400">{formatNumber(userTotal)} total</span>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-slate-400">
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Links</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Joined</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 text-slate-200">{u.email}</td>
                      <td className="px-4 py-3 text-slate-400">{u.name || "—"}</td>
                      <td className="px-4 py-3">
                        <select
                          value={u.role}
                          onChange={(e) => changeRole(u.id, e.target.value as "USER" | "ADMIN")}
                          className={`text-xs px-2 py-1 rounded-full border bg-transparent cursor-pointer ${
                            u.role === "ADMIN"
                              ? "text-amber-400 border-amber-400/30"
                              : "text-slate-400 border-slate-600"
                          }`}
                        >
                          <option value="USER">USER</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{u._count.urls}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          u.isActive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                        }`}>
                          {u.isActive ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(u.createdAt)}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleUser(u.id)} title={u.isActive ? "Disable" : "Enable"}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all">
                          {u.isActive ? <ToggleRight size={16} className="text-green-400" /> : <ToggleLeft size={16} />}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No users found</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-sm text-slate-400">
              <span>Page {userPage} of {Math.ceil(userTotal / 10)}</span>
              <div className="flex gap-2">
                <button onClick={() => setUserPage((p) => Math.max(1, p - 1))} disabled={userPage === 1}
                  className="p-2 hover:bg-white/10 rounded-lg disabled:opacity-40 transition-all">
                  <ChevronLeft size={14} />
                </button>
                <button onClick={() => setUserPage((p) => p + 1)} disabled={userPage >= Math.ceil(userTotal / 10)}
                  className="p-2 hover:bg-white/10 rounded-lg disabled:opacity-40 transition-all">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cache tab */}
        {tab === "cache" && (
          <div className="space-y-4 animate-fade-in">
            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Database size={16} className="text-red-400" /> Redis Cache
              </h3>
              {stats && (
                <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                  <div className="bg-white/5 rounded-xl p-4">
                    <p className="text-slate-400 mb-1">Status</p>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${stats.redis.status === "connected" ? "bg-green-400" : "bg-red-400"}`} />
                      <span className="font-medium capitalize">{stats.redis.status}</span>
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4">
                    <p className="text-slate-400 mb-1">Memory Used</p>
                    <p className="font-medium">{stats.redis.memory}</p>
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={flushCache}
                  className="flex items-center gap-2 px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 rounded-xl text-sm font-medium transition-all">
                  <Trash2 size={14} /> Flush All Cache
                </button>
                <button onClick={() => { loadStats(); toast.success("Refreshed"); }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-medium transition-all">
                  <RefreshCw size={14} /> Refresh Stats
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-3">
                Flushing cache will temporarily slow down URL lookups while the cache rebuilds. Safe to do anytime.
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Activity size={16} className="text-indigo-400" /> System Info
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                {[
                  { label: "Backend", value: "Node.js 20 + Express" },
                  { label: "Database", value: "PostgreSQL 16" },
                  { label: "Cache", value: "Redis 7" },
                  { label: "ORM", value: "Prisma 5" },
                  { label: "Auth", value: "JWT (15m + 7d refresh)" },
                  { label: "Rate Limit", value: "100 req/min per IP" },
                ].map((item) => (
                  <div key={item.label} className="bg-white/5 rounded-xl p-3">
                    <p className="text-slate-400 text-xs mb-1">{item.label}</p>
                    <p className="font-medium text-sm">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
