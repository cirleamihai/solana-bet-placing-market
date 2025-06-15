import React, { createContext, useContext, useState, ReactNode } from 'react';

// 1. Define the shape of the context
type MarketContextProps = {
    userBalance: number;
    setUserBalance: React.Dispatch<React.SetStateAction<number>>;
    newMarket: number,
    setNewMarket: React.Dispatch<React.SetStateAction<number>>;
};

// 2. Create the context with default (unsafe) values
const MarketContext = createContext<MarketContextProps | undefined>(undefined);

// 3. Create a provider component
export const MarketProvider = ({ children }: { children: ReactNode }) => {
    const [userBalance, setUserBalance] = useState<number>(0);
    const [newMarket, setNewMarket] = useState<number>(0);

    return (
        <MarketContext.Provider value={{ userBalance, setUserBalance, newMarket, setNewMarket }}>
            {children}
        </MarketContext.Provider>
    );
};

// 4. Optional hook to consume context cleanly
export const useMarketContext = () => {
    const context = useContext(MarketContext);
    if (!context) throw new Error("Using MarketContext outside of its Provider");
    return context;
};
