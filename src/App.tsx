import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import NavBar from "@/src/components/NavBar";
import MarketList from "@/src/components/MarketList";
// import MarketDetails from "@/src/components/MarketDetails";
import "./styles/globals.css";

export default function App() {
    return (
        <Router>
            <NavBar />
            <Routes>
                <Route path="/" element={<MarketList />} />
                {/*<Route path="/market/:id" element={<MarketDetails />} />*/}
            </Routes>
        </Router>
    );
}