import React from "react";
import {BrowserRouter as Router, Route, Routes} from "react-router-dom";
import ConnectWalletButton from "@/components/ConnectWalletButton";
import MarketGrid from "@/components/MarketGrid";
import Header from "@/components/Header";
import MarketDetails from "@/components/MarketDetails";
import "./styles/globals.css";
import {Toaster} from "sonner";

export default function App() {
    const [searchQuery, setSearchQuery] = React.useState("");

    return (
        <>
            <Toaster position={"top-right"}/>
            <Router>
                <div className={"bg-slate-800 min-h-screen overflow-x-hidden"}>
                    <Header
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                    />
                    <Routes>
                        <Route path="/" element={<MarketGrid searchQuery={searchQuery}/>}/>
                        <Route path="/markets/:market_category" element={<MarketGrid searchQuery={searchQuery}/>}/>
                        <Route path="/market/:marketPubkey" element={<MarketDetails />} />
                    </Routes>
                </div>
            </Router>
        </>
    );
}