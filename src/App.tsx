import React from "react";
import {BrowserRouter as Router, Route, Routes} from "react-router-dom";
import ConnectWalletButton from "@/components/ConnectWalletButton";
import MarketGrid from "@/components/MarketGrid";
import Header from "@/components/Header";
// import MarketDetails from "@/src/components/MarketDetails";
import "./styles/globals.css";

export default function App() {
    return (
        <Router>
            <div className={"bg-slate-800 min-h-screen"}>
            <Header/>
                <Routes>
                    <Route path="/" element={<MarketGrid/>}/>
                    {/*<Route path="/market/:id" element={<MarketDetails />} />*/}
                </Routes>
            </div>
        </Router>
    );
}