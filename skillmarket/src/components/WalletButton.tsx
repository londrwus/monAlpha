"use client";

import { useAccount, useConnect, useDisconnect, useBalance, useSwitchChain } from "wagmi";
import { formatUnits } from "viem";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, ChevronDown, LogOut, Copy, Check, ExternalLink, AlertTriangle } from "lucide-react";
import { CONFIG } from "@/lib/constants";

const MONAD_CHAIN_ID = CONFIG.chainId;

export default function WalletButton() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({ address });
  const { switchChain } = useSwitchChain();
  const isWrongNetwork = isConnected && chainId !== MONAD_CHAIN_ID;
  const [showDropdown, setShowDropdown] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const truncated = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "";

  const formattedBalance = balance
    ? `${parseFloat(formatUnits(balance.value, balance.decimals)).toFixed(3)} ${balance.symbol}`
    : "";

  if (isWrongNetwork) {
    return (
      <motion.button
        className="px-4 py-2 text-sm font-medium bg-accent-red/20 hover:bg-accent-red/30 text-accent-red border border-accent-red/30 rounded-lg transition-colors flex items-center gap-2"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => switchChain({ chainId: MONAD_CHAIN_ID })}
      >
        <AlertTriangle className="w-4 h-4" />
        Switch to Monad
      </motion.button>
    );
  }

  if (!isConnected) {
    return (
      <div className="relative" ref={dropdownRef}>
        <motion.button
          className="px-4 py-2 text-sm font-medium bg-accent-green hover:bg-accent-green-light text-white rounded-lg transition-colors flex items-center gap-2"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowDropdown(!showDropdown)}
          disabled={isPending}
        >
          <Wallet className="w-4 h-4" />
          {isPending ? "Connecting..." : "Connect Wallet"}
        </motion.button>

        <AnimatePresence>
          {showDropdown && (
            <motion.div
              className="absolute right-0 top-full mt-2 w-56 bg-bg-secondary border border-border rounded-xl shadow-xl overflow-hidden z-50"
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
            >
              <div className="p-2">
                <p className="px-3 py-1.5 text-[10px] text-text-tertiary uppercase tracking-wider">
                  Connect with
                </p>
                {connectors.map((connector) => (
                  <button
                    key={connector.uid}
                    onClick={() => {
                      connect({ connector });
                      setShowDropdown(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-text-primary hover:bg-bg-tertiary rounded-lg transition-colors"
                  >
                    <div className="w-6 h-6 rounded-md bg-bg-tertiary border border-border flex items-center justify-center">
                      <Wallet className="w-3.5 h-3.5 text-text-secondary" />
                    </div>
                    {connector.name}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <motion.button
        className="flex items-center gap-2 px-3 py-2 bg-bg-secondary hover:bg-bg-tertiary border border-border hover:border-border-light rounded-lg transition-colors"
        onClick={() => setShowDropdown(!showDropdown)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse-live" />
        <span className="text-sm font-mono text-text-primary">{truncated}</span>
        {formattedBalance && (
          <span className="text-xs text-text-tertiary font-mono hidden sm:inline">
            {formattedBalance}
          </span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 text-text-tertiary transition-transform ${showDropdown ? "rotate-180" : ""}`} />
      </motion.button>

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            className="absolute right-0 top-full mt-2 w-64 bg-bg-secondary border border-border rounded-xl shadow-xl overflow-hidden z-50"
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
          >
            <div className="p-3 border-b border-border">
              <p className="text-xs text-text-tertiary mb-1">Connected</p>
              <p className="text-sm font-mono text-text-primary">{truncated}</p>
              {formattedBalance && (
                <p className="text-xs font-mono text-accent-green-light mt-1">{formattedBalance}</p>
              )}
            </div>
            <div className="p-2">
              <button
                onClick={copyAddress}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-text-secondary hover:bg-bg-tertiary rounded-lg transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-accent-green-light" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied!" : "Copy Address"}
              </button>
              <a
                href={`https://monadexplorer.com/address/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-text-secondary hover:bg-bg-tertiary rounded-lg transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                View on Explorer
              </a>
              <button
                onClick={() => {
                  disconnect();
                  setShowDropdown(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-accent-red hover:bg-bg-tertiary rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Disconnect
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
