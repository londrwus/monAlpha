"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import WalletButton from "./WalletButton";
import Logo from "./Logo";

export default function Navbar({ variant = "landing" }: { variant?: "landing" | "app" }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 backdrop-blur-xl bg-bg-primary/80">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <motion.div whileHover={{ scale: 1.05 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size={32} />
            <span className="font-serif text-xl text-text-primary tracking-tight">monAlpha</span>
          </Link>
        </motion.div>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-1">
          {variant === "landing" ? (
            <>
              <NavLink href="#features">Features</NavLink>
              <NavLink href="#how-it-works">How It Works</NavLink>
              <NavLink href="#models">Models</NavLink>
              <NavLink href="#creators">Creators</NavLink>
            </>
          ) : (
            <>
              <NavLink href="/dashboard">Dashboard</NavLink>
              <NavLink href="/analyze">Analyze</NavLink>
              <NavLink href="/charts">Charts</NavLink>
              <NavLink href="/marketplace">Marketplace</NavLink>
              <NavLink href="/create">Create</NavLink>
            </>
          )}
        </div>

        <div className="hidden md:flex items-center gap-3">
          {variant === "landing" ? (
            <>
              <Link
                href="/dashboard"
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                Launch App
              </Link>
              <Link
                href="/analyze"
                className="px-5 py-2 text-sm font-medium bg-accent-green hover:bg-accent-green-light text-white rounded-lg transition-colors glow-green-subtle"
              >
                Request Analysis
              </Link>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-bg-tertiary rounded-lg border border-border">
                <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse-live" />
                <span className="text-xs text-text-secondary font-mono">Monad</span>
              </div>
              <WalletButton />
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden p-2 text-text-secondary"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.4, 0.25, 1] }}
            className="md:hidden border-t border-border bg-bg-primary/95 backdrop-blur-xl overflow-hidden"
          >
            <div className="px-6 py-4 flex flex-col gap-2">
              {variant === "landing" ? (
                <>
                  <MobileLink href="#features" onClick={() => setMobileOpen(false)}>Features</MobileLink>
                  <MobileLink href="#how-it-works" onClick={() => setMobileOpen(false)}>How It Works</MobileLink>
                  <MobileLink href="#models" onClick={() => setMobileOpen(false)}>Models</MobileLink>
                  <MobileLink href="/dashboard" onClick={() => setMobileOpen(false)}>Launch App</MobileLink>
                </>
              ) : (
                <>
                  <MobileLink href="/dashboard" onClick={() => setMobileOpen(false)}>Dashboard</MobileLink>
                  <MobileLink href="/analyze" onClick={() => setMobileOpen(false)}>Analyze</MobileLink>
                  <MobileLink href="/charts" onClick={() => setMobileOpen(false)}>Charts</MobileLink>
                  <MobileLink href="/marketplace" onClick={() => setMobileOpen(false)}>Marketplace</MobileLink>
                  <MobileLink href="/create" onClick={() => setMobileOpen(false)}>Create</MobileLink>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors rounded-lg hover:bg-bg-tertiary/50"
    >
      {children}
    </Link>
  );
}

function MobileLink({ href, children, onClick }: { href: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="px-3 py-2.5 text-sm text-text-secondary hover:text-text-primary transition-colors rounded-lg hover:bg-bg-tertiary/50"
    >
      {children}
    </Link>
  );
}
