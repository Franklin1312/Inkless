"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CONTRACT_ADDRESS,
  CHAIN_ID,
  SEPOLIA_NETWORK_PARAMS,
  INKLESS_ABI,
  BLOCK_EXPLORER,
} from "../lib/contract";

interface WalletState {
  address: string | null;
  chainId: number | null;
  isConnected: boolean;
  isCorrectNetwork: boolean;
}

interface TxState {
  status: "idle" | "pending" | "mining" | "success" | "error";
  txHash: string | null;
  evaluationId: string | null;
  error: string | null;
}

export interface EvaluationData {
  studentRollNumber: string;
  evaluatorId: string;
  subject: string;
  examYear: string;
  questions: { code: string; marksAwarded: number; maxMarks: number; boxColor: string }[];
  totalMarksAwarded: number;
  totalMaxMarks: number;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBlockchain() {
  const [wallet, setWallet] = useState<WalletState>({
    address: null,
    chainId: null,
    isConnected: false,
    isCorrectNetwork: false,
  });

  const [txState, setTxState] = useState<TxState>({
    status: "idle",
    txHash: null,
    evaluationId: null,
    error: null,
  });

  // ─── MetaMask Detection ──────────────────────────────────────────────────────

  const getProvider = () => {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      throw new Error("MetaMask not found. Please install MetaMask.");
    }
    const eth = (window as any).ethereum;
    // Handle case where multiple wallets (like Phantom) overwrite window.ethereum
    if (eth.providers?.length) {
      const mm = eth.providers.find((p: any) => p.isMetaMask);
      if (mm) return mm;
    }
    return eth;
  };

  // ─── Connect Wallet ──────────────────────────────────────────────────────────

  const connect = useCallback(async () => {
    const ethereum = getProvider();
    const accounts = await ethereum.request({ method: "eth_requestAccounts" });
    const address = accounts[0];

    const chainIdHex = await ethereum.request({ method: "eth_chainId" });
    const chainId = parseInt(chainIdHex, 16);
    setWallet({ address, chainId, isConnected: true, isCorrectNetwork: chainId === CHAIN_ID });
    return address;
  }, []);

  // ─── Switch to Sepolia ───────────────────────────────────────────────────────

  const switchToSepolia = useCallback(async () => {
    const ethereum = getProvider();
    try {
      await ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0xaa36a7" }] });
    } catch (err: any) {
      if (err.code === 4902) {
        await ethereum.request({ method: "wallet_addEthereumChain", params: [SEPOLIA_NETWORK_PARAMS] });
      } else throw err;
    }
  }, []);

  // ─── Get Contract Instance ───────────────────────────────────────────────────

  const getContract = useCallback(async (readOnly = false) => {
    const { ethers } = await import("ethers");
    const ethereum = getProvider();
    if (!CONTRACT_ADDRESS) throw new Error("CONTRACT_ADDRESS not set. Deploy the contract and update .env.local");

    if (readOnly) {
      const provider = new ethers.JsonRpcProvider(
        process.env.NEXT_PUBLIC_SEPOLIA_RPC || "https://rpc.sepolia.org"
      );
      return new ethers.Contract(CONTRACT_ADDRESS, INKLESS_ABI, provider);
    }

    const provider = new ethers.BrowserProvider(ethereum);
    const signer = await provider.getSigner();
    return new ethers.Contract(CONTRACT_ADDRESS, INKLESS_ABI, signer);
  }, []);

  // ─── Submit Evaluation ───────────────────────────────────────────────────────

  const submitEvaluation = useCallback(async (evaluationData: EvaluationData) => {
    setTxState({ status: "pending", txHash: null, evaluationId: null, error: null });
    try {
      if (!wallet.isCorrectNetwork) await switchToSepolia();
      const contract = await getContract(false);
      const { studentRollNumber, evaluatorId, subject, examYear, questions, totalMarksAwarded, totalMaxMarks } = evaluationData;

      const tx = await contract.submitEvaluation(
        studentRollNumber, evaluatorId, subject, examYear,
        questions.map(q => q.code),
        questions.map(q => q.marksAwarded),
        questions.map(q => q.maxMarks),
        questions.map(q => q.boxColor),
        totalMarksAwarded,
        totalMaxMarks
      );

      setTxState(s => ({ ...s, status: "mining", txHash: tx.hash }));
      const receipt = await tx.wait(1);

      const { ethers } = await import("ethers");
      const iface = new ethers.Interface(INKLESS_ABI);
      let evaluationId: string | null = null;
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed?.name === "EvaluationSubmitted") { evaluationId = parsed.args[0]; break; }
        } catch (_) {}
      }

      setTxState({ status: "success", txHash: tx.hash, evaluationId, error: null });
      return { txHash: tx.hash, evaluationId, receipt };
    } catch (err: any) {
      const msg = err?.reason || err?.message || "Transaction failed";
      setTxState({ status: "error", txHash: null, evaluationId: null, error: msg });
      throw err;
    }
  }, [wallet, getContract, switchToSepolia]);

  // ─── Read Functions ──────────────────────────────────────────────────────────

  const getEvaluation = useCallback(async (evaluationId: string) => {
    const contract = await getContract(true);
    const [record, questions] = await Promise.all([
      contract.getEvaluation(evaluationId),
      contract.getQuestionMarks(evaluationId),
    ]);
    return { record, questions };
  }, [getContract]);

  const verifyHash = useCallback(async (evaluationId: string) => {
    const contract = await getContract(true);
    const [isValid, storedHash, computedHash] = await contract.verifyHash(evaluationId);
    return { isValid, storedHash, computedHash };
  }, [getContract]);

  const raiseDispute = useCallback(async (evaluationId: string, reason: string) => {
    const contract = await getContract(false);
    const tx = await contract.raiseDispute(evaluationId, reason);
    await tx.wait(1);
    return tx.hash;
  }, [getContract]);

  // ─── Listen for MetaMask changes ─────────────────────────────────────────────

  useEffect(() => {
    if (typeof window === "undefined" || !(window as any).ethereum) return;
    const eth = getProvider();

    const onAccounts = (accounts: string[]) => {
      // If the user manually changes accounts in MetaMask, force them to re-authenticate
      setWallet({ address: null, chainId: null, isConnected: false, isCorrectNetwork: false });
    };
    const onChain = (hex: string) => {
      const chainId = parseInt(hex, 16);
      setWallet(w => ({ ...w, chainId, isCorrectNetwork: chainId === CHAIN_ID }));
    };

    eth.on("accountsChanged", onAccounts);
    eth.on("chainChanged", onChain);

    return () => {
      eth.removeListener("accountsChanged", onAccounts);
      eth.removeListener("chainChanged", onChain);
    };
  }, []);

  const getTxUrl    = (txHash: string)  => `${BLOCK_EXPLORER}/tx/${txHash}`;
  const getContractUrl = ()             => `${BLOCK_EXPLORER}/address/${CONTRACT_ADDRESS}`;
  const resetTxState = ()               => setTxState({ status: "idle", txHash: null, evaluationId: null, error: null });

  return { wallet, connect, switchToSepolia, submitEvaluation, raiseDispute, getEvaluation, verifyHash, txState, resetTxState, getTxUrl, getContractUrl };
}
