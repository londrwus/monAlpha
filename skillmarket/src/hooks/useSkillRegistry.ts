"use client";

import { useState, useCallback } from "react";
import { useAccount, useSendTransaction, useWriteContract, useSwitchChain } from "wagmi";
import { parseEther } from "viem";
import { SKILL_REGISTRY_ABI } from "@/lib/abis/skill-registry";
import { SKILL_REGISTRY_ADDRESS, REGISTRATION_FEE_MON, CONFIG } from "@/lib/constants";

const FOUNDATION_WALLET = (process.env.NEXT_PUBLIC_FOUNDATION_WALLET || "0x0000000000000000000000000000000000000000") as `0x${string}`;
const MONAD_CHAIN_ID = CONFIG.chainId;

type PayStatus = "idle" | "pending" | "confirming" | "success" | "error";

export function useSkillRegistry() {
  const { address, isConnected, chainId } = useAccount();
  const [status, setStatus] = useState<PayStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();

  const contractReady = !!SKILL_REGISTRY_ADDRESS;
  const isWrongNetwork = isConnected && chainId !== MONAD_CHAIN_ID;

  /** Prompt wallet to switch to Monad if on wrong chain */
  const ensureMonadChain = useCallback(async (): Promise<boolean> => {
    if (!isConnected) return false;
    if (chainId === MONAD_CHAIN_ID) return true;
    try {
      await switchChainAsync({ chainId: MONAD_CHAIN_ID });
      return true;
    } catch {
      setError("Please switch to Monad network");
      return false;
    }
  }, [isConnected, chainId, switchChainAsync]);

  const resetPayment = useCallback(() => {
    setStatus("idle");
    setError(null);
    setTxHash(null);
  }, []);

  /**
   * Register a new skill on-chain (10 MON fee)
   */
  const registerSkill = useCallback(
    async (name: string, ipfsHash: string, pricePerUse: number): Promise<string | null> => {
      if (!isConnected || !address) {
        setError("Please connect your wallet first");
        return null;
      }

      if (!contractReady) {
        setStatus("success");
        setTxHash("dev-mode");
        return "dev-mode";
      }

      // Ensure Monad network
      const onMonad = await ensureMonadChain();
      if (!onMonad) return null;

      setStatus("pending");
      setError(null);

      try {
        const hash = await writeContractAsync({
          chainId: CONFIG.chainId,
          address: SKILL_REGISTRY_ADDRESS,
          abi: SKILL_REGISTRY_ABI,
          functionName: "registerSkill",
          args: [name, ipfsHash || "pending", parseEther(pricePerUse.toString())],
          value: parseEther(REGISTRATION_FEE_MON.toString()),
        });

        setStatus("confirming");
        setTxHash(hash);

        // Poll for receipt
        const ok = await pollTxReceipt(hash);
        if (ok) {
          setStatus("success");
          return hash;
        } else {
          setStatus("error");
          setError("Transaction reverted");
          return null;
        }
      } catch (err) {
        return handleErr(err, setStatus, setError);
      }
    },
    [isConnected, address, contractReady, writeContractAsync, ensureMonadChain]
  );

  /**
   * Pay for analysis — simple MON transfer to foundation wallet
   */
  const payForAnalysis = useCallback(
    async (totalMon: number): Promise<string | null> => {
      if (!isConnected || !address) {
        setError("Please connect your wallet first");
        return null;
      }

      if (totalMon <= 0) {
        setStatus("success");
        setTxHash("free");
        return "free";
      }

      // Ensure Monad network
      const onMonad = await ensureMonadChain();
      if (!onMonad) return null;

      setStatus("pending");
      setError(null);

      try {
        const hash = await sendTransactionAsync({
          chainId: CONFIG.chainId,
          to: FOUNDATION_WALLET,
          value: parseEther(totalMon.toString()),
        });

        setStatus("confirming");
        setTxHash(hash);

        const ok = await pollTxReceipt(hash);
        if (ok) {
          setStatus("success");
          return hash;
        } else {
          setStatus("error");
          setError("Transaction reverted");
          return null;
        }
      } catch (err) {
        return handleErr(err, setStatus, setError);
      }
    },
    [isConnected, address, sendTransactionAsync, ensureMonadChain]
  );

  return {
    registerSkill,
    payForAnalysis,
    paymentState: { status, txHash, error },
    resetPayment,
    contractReady,
    isConnected,
    isWrongNetwork,
    ensureMonadChain,
    address,
  };
}

async function pollTxReceipt(hash: string, maxWait = 60000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    try {
      const res = await fetch(`/api/tx-status?hash=${hash}`);
      const data = await res.json();
      if (data.status === "success") return true;
      if (data.status === "reverted") return false;
    } catch {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return true; // assume success on timeout
}

function handleErr(
  err: unknown,
  setStatus: (s: PayStatus) => void,
  setError: (e: string | null) => void
): null {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("User rejected") || msg.includes("user rejected") || msg.includes("denied")) {
    setStatus("idle");
    setError(null);
  } else {
    setStatus("error");
    setError(msg.slice(0, 200));
  }
  return null;
}
