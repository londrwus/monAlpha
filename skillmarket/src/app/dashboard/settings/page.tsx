"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { Settings, Wifi, Key, Wallet, Trash2, Loader2, CheckCircle2 } from "lucide-react";

interface SettingsData {
  wallet: string;
  settings: {
    theme: string;
    notifications: boolean;
    defaultModel: string;
  };
  network: string;
  hasApiKey: boolean;
}

export default function SettingsPage() {
  const { address, isConnected } = useAccount();
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [saving, setSaving] = useState(false);
  const [defaultModel, setDefaultModel] = useState("rug-detector");

  useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }
    fetch(`/api/settings?wallet=${address}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setDefaultModel(d.settings?.defaultModel || "rug-detector");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [address]);

  const handleSave = async () => {
    if (!address) return;
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: address,
          settings: { defaultModel },
        }),
      });
    } catch {}
    setSaving(false);
  };

  const handleClearCache = async () => {
    setClearing(true);
    setCleared(false);
    try {
      await fetch("/api/settings?action=clear-cache", { method: "POST" });
      setCleared(true);
      setTimeout(() => setCleared(false), 3000);
    } catch {}
    setClearing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-text-tertiary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-text-tertiary">Manage your account and preferences</p>
      </div>

      {/* Network */}
      <div className="bg-bg-secondary border border-border rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Wifi className="w-4 h-4 text-text-tertiary" />
          Network
        </h3>
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">Chain</span>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse-live" />
            <span className="text-sm font-mono">Monad {data?.network || "mainnet"}</span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">RPC</span>
          <span className="text-xs font-mono text-text-tertiary">QuickNode (via env)</span>
        </div>
      </div>

      {/* API Key */}
      <div className="bg-bg-secondary border border-border rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Key className="w-4 h-4 text-text-tertiary" />
          nad.fun API
        </h3>
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">API Key</span>
          <span className={`text-sm font-mono ${data?.hasApiKey ? "text-accent-green-light" : "text-accent-red"}`}>
            {data?.hasApiKey ? "nadfun_***configured***" : "Not set"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">Rate Limit</span>
          <span className="text-sm font-mono text-text-secondary">
            {data?.hasApiKey ? "100 req/min" : "10 req/min"}
          </span>
        </div>
      </div>

      {/* Wallet */}
      <div className="bg-bg-secondary border border-border rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Wallet className="w-4 h-4 text-text-tertiary" />
          Wallet
        </h3>
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">Address</span>
          <span className="text-sm font-mono text-text-secondary">
            {isConnected && address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Not connected"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">Status</span>
          <span className={`text-sm ${isConnected ? "text-accent-green-light" : "text-text-tertiary"}`}>
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>

      {/* Preferences */}
      <div className="bg-bg-secondary border border-border rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Settings className="w-4 h-4 text-text-tertiary" />
          Preferences
        </h3>
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">Default Model</span>
          <select
            value={defaultModel}
            onChange={(e) => setDefaultModel(e.target.value)}
            className="px-3 py-1.5 bg-bg-tertiary border border-border rounded-lg text-sm font-mono focus:outline-none focus:border-accent-green/40"
          >
            <option value="rug-detector">Rug Detector</option>
            <option value="whale-tracker">Whale Tracker</option>
            <option value="liquidity-scout">Liquidity Scout</option>
          </select>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2.5 text-sm font-medium text-accent-green-light bg-accent-green/10 hover:bg-accent-green/20 border border-accent-green/20 rounded-xl transition-all disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Preferences"}
        </button>
      </div>

      {/* Cache */}
      <div className="bg-bg-secondary border border-border rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Trash2 className="w-4 h-4 text-text-tertiary" />
          Data & Cache
        </h3>
        <p className="text-xs text-text-tertiary">
          Clear all cached analysis results. This cannot be undone.
        </p>
        <button
          onClick={handleClearCache}
          disabled={clearing}
          className="w-full py-2.5 text-sm font-medium text-accent-red bg-accent-red/10 hover:bg-accent-red/20 border border-accent-red/20 rounded-xl transition-all disabled:opacity-50"
        >
          {clearing ? "Clearing..." : cleared ? "Cache Cleared" : "Clear Analysis Cache"}
        </button>
        {cleared && (
          <div className="flex items-center gap-2 text-xs text-accent-green-light">
            <CheckCircle2 className="w-3 h-3" />
            Analysis cache cleared successfully
          </div>
        )}
      </div>
    </div>
  );
}
