import { Buffer } from "buffer";
(window as any).Buffer = Buffer;

import React from "react";
import ReactDOM from "react-dom/client";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./styles.css";
import { RPC } from "./lib/chain";
import { App } from "./App";

const CP: any = ConnectionProvider, WP: any = WalletProvider, MP: any = WalletModalProvider;
const wallets = [new PhantomWalletAdapter(), new SolflareWalletAdapter()];

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <CP endpoint={RPC}>
      <WP wallets={wallets} autoConnect>
        <MP>
          <App />
        </MP>
      </WP>
    </CP>
  </React.StrictMode>
);
