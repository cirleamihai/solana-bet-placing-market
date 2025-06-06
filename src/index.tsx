import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/globals.css";
import {WalletContextProvider} from "@/WalletContextProvider";

import { Buffer } from "buffer";
if (typeof window !== "undefined" && !(window as any).Buffer) {
    (window as any).Buffer = Buffer;
}

const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(
        <React.StrictMode>
            <WalletContextProvider>
                <App/>
            </WalletContextProvider>
        </React.StrictMode>
);