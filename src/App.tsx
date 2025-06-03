import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import NavBar from "@/components/NavBar";
import MarketGrid from "@/components/MarketGrid";
// import MarketDetails from "@/src/components/MarketDetails";
import "./styles/globals.css";

export default function App() {
    return (
        <Router>
            <NavBar />
            <Routes>
                <Route path="/" element={<MarketGrid />} />
                {/*<Route path="/market/:id" element={<MarketDetails />} />*/}
            </Routes>
        </Router>
    );
}