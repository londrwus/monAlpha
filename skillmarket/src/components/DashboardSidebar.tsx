"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useBalance } from "wagmi";
import { formatUnits } from "viem";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Search,
  Store,
  PlusCircle,
  Trophy,
  Settings,
  BarChart3,
  CandlestickChart,
  Wallet,
  Briefcase,
  Bot,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Overview" },
  { href: "/analyze", icon: Search, label: "Analyze" },
  { href: "/portfolio", icon: Briefcase, label: "Portfolio" },
  { href: "/trading", icon: Bot, label: "Trading Agent" },
  { href: "/charts", icon: CandlestickChart, label: "Charts" },
  { href: "/marketplace", icon: Store, label: "Marketplace" },
  { href: "/create", icon: PlusCircle, label: "Create Model" },
  { href: "/dashboard/leaderboard", icon: Trophy, label: "Leaderboard" },
  { href: "/dashboard/analytics", icon: BarChart3, label: "My Analytics" },
];

export default function DashboardSidebar() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address });
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const truncated = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "";
  const formattedBalance = balance
    ? `${parseFloat(formatUnits(balance.value, balance.decimals)).toFixed(3)} ${balance.symbol}`
    : "";

  return (
    <aside className="hidden lg:flex flex-col w-64 border-r border-border bg-bg-secondary/50 h-[calc(100vh-64px)] sticky top-16">
      {/* Wallet section */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3 p-3 bg-bg-tertiary rounded-xl border border-border">
          <div className="w-8 h-8 rounded-lg bg-accent-green/20 flex items-center justify-center">
            <Wallet className="w-4 h-4 text-accent-green-light" />
          </div>
          <div className="flex-1 min-w-0">
            {isConnected ? (
              <>
                <p className="text-xs font-medium truncate">{truncated}</p>
                <p className="text-[10px] text-text-tertiary font-mono">{formattedBalance || "0 MON"}</p>
              </>
            ) : (
              <>
                <p className="text-xs font-medium text-text-tertiary">Not connected</p>
                <p className="text-[10px] text-text-tertiary font-mono">Connect wallet</p>
              </>
            )}
          </div>
          {isConnected && (
            <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse-live" />
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item, i) => {
          const isActive = pathname === item.href;
          return (
            <div
              key={item.href}
              style={!hasMounted ? { opacity: 0, transform: "translateX(-12px)" } : undefined}
              className={!hasMounted ? `animate-fade-in` : undefined}
            >
              <Link
                href={item.href}
                className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors group"
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 bg-accent-green/10 border border-accent-green/20 rounded-xl"
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  />
                )}
                <span className="relative flex items-center gap-3">
                  <item.icon className={`w-4 h-4 ${isActive ? "text-accent-green-light" : "text-text-secondary group-hover:text-text-primary"} transition-colors`} />
                  <span className={`${isActive ? "text-accent-green-light" : "text-text-secondary group-hover:text-text-primary"} transition-colors`}>
                    {item.label}
                  </span>
                </span>
              </Link>
            </div>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="p-3 border-t border-border space-y-1">
        <div>
          <Link
            href="/dashboard/settings"
            className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors group"
          >
            {pathname === "/dashboard/settings" && (
              <motion.div
                layoutId="sidebar-active"
                className="absolute inset-0 bg-accent-green/10 border border-accent-green/20 rounded-xl"
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
              />
            )}
            <span className="relative flex items-center gap-3">
              <Settings className={`w-4 h-4 ${pathname === "/dashboard/settings" ? "text-accent-green-light" : "text-text-secondary group-hover:text-text-primary"} transition-colors`} />
              <span className={`${pathname === "/dashboard/settings" ? "text-accent-green-light" : "text-text-secondary group-hover:text-text-primary"} transition-colors`}>
                Settings
              </span>
            </span>
          </Link>
        </div>
        <div className="px-3 py-2 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse-live" />
          <span className="text-[10px] text-text-tertiary font-mono">Monad</span>
        </div>
      </div>
    </aside>
  );
}
