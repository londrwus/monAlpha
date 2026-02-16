import { http, createConfig } from "wagmi";
import { injected, walletConnect } from "@wagmi/connectors";
import { monadChain } from "./monad";

const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID;

export const wagmiConfig = createConfig({
  chains: [monadChain],
  connectors: [
    injected(),
    ...(projectId
      ? [walletConnect({ projectId })]
      : []),
  ],
  transports: {
    [monadChain.id]: http(monadChain.rpcUrls.default.http[0]),
  },
  ssr: true,
});
