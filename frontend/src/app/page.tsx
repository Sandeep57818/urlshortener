// src/app/page.tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Link2, Copy, QrCode, BarChart3, Zap, Shield, Check, Loader2, ExternalLink } from "lucide-react";
import { api, API_BASE } from "@/lib/api";
import { copyToClipboard } from "@/lib/utils";

interface ShortenResult {
  shortUrl: string;
  shortCode: string;
  qrCode: string;
  originalUrl: string;
}

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ShortenResult | null>(null);
  const [copied, setCopied] = useState(false);

  const handleShorten = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    try {
      const res = await api.post<{ success: boolean; data: ShortenResult }>("/api/shorten", {
        originalUrl: url.trim(),
      });
      setResult(res.data);
      toast.success("URL shortened!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to shorten URL");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    await copyToClipboard(result.shortUrl);
    setCopied(true);
    toast.success("Copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
            <Link2 size={16} />
          </div>
          <span className="font-bold text-lg">LinkSnap</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-slate-300 hover:text-white transition-colors">Sign In</Link>
          <Link href="/register" className="text-sm bg-indigo-500 hover:bg-indigo-600 px-4 py-2 rounded-lg transition-colors font-medium">Get Started</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 rounded-full px-4 py-1.5 text-sm text-indigo-300 mb-6">
          <Zap size={14} /> Real-time analytics + Redis caching
        </div>
        <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
          Shorten URLs.<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
            Track Everything.
          </span>
        </h1>
        <p className="text-xl text-slate-300 mb-12 max-w-xl mx-auto">
          Production-grade URL shortener with real-time click analytics, QR codes, rate limiting, and full admin dashboard.
        </p>

        {/* Shortener box */}
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 max-w-2xl mx-auto">
          <form onSubmit={handleShorten} className="flex gap-3">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-very-long-url.com/paste-here"
              className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="px-6 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 whitespace-nowrap"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
              {loading ? "Shortening..." : "Shorten"}
            </button>
          </form>

          {result && (
            <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-xl animate-fade-in">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-400 mb-1">Short URL</p>
                  <a href={result.shortUrl} target="_blank" rel="noopener noreferrer"
                    className="text-green-400 font-mono font-semibold hover:underline flex items-center gap-1 text-sm">
                    {result.shortUrl} <ExternalLink size={12} />
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  {result.qrCode && (
                    <img src={result.qrCode} alt="QR" className="w-14 h-14 rounded-lg bg-white p-1" />
                  )}
                  <button onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 rounded-lg text-xs font-medium text-green-300 transition-all">
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: BarChart3, color: "text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/20", title: "Real-time Analytics", desc: "Live click tracking via WebSocket with country, browser, and device breakdowns." },
            { icon: QrCode, color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20", title: "QR Code Generation", desc: "Auto-generated QR codes for every short URL, downloadable as PNG." },
            { icon: Shield, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", title: "Rate Limiting + Cache", desc: "Redis-backed 100 req/min rate limiting and 10ms cache layer for blazing speed." },
          ].map((f) => (
            <div key={f.title} className={`border rounded-2xl p-6 ${f.bg}`}>
              <f.icon size={24} className={`${f.color} mb-3`} />
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/10 py-6 text-center text-slate-500 text-sm">
        <p>LinkSnap © {new Date().getFullYear()} · <Link href="/dashboard" className="text-indigo-400 hover:text-indigo-300">Dashboard</Link></p>
      </footer>
    </div>
  );
}
