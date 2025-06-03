import { Search, Settings, Bookmark, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Link } from "react-router-dom";

export default function Header() {
    return (
        <header className="bg-zinc-900 text-white border-b border-zinc-800 shadow-sm px-4 py-3">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                {/* Left: Logo and Nav */}
                <div className="flex items-center gap-6">
                    <Link to="/" className="text-xl font-bold tracking-tight">
                        UBB Market
                    </Link>
                    <nav className="hidden md:flex gap-4 text-sm font-medium text-zinc-300">
                        <Link to="#" className="hover:text-white">Trending</Link>
                        <Link to="#">Politics</Link>
                        <Link to="#">Sports</Link>
                        <Link to="#">Crypto</Link>
                        <Link to="#">Tech</Link>
                        <Link to="#">World</Link>
                        <Link to="#">More</Link>
                    </nav>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-4 ml-auto">

                    <div className="hidden md:flex items-center gap-2 bg-zinc-800 px-3 py-1.5 rounded-full w-64">
                        <Search className="w-4 h-4 text-zinc-400" />
                        <input
                            type="text"
                            placeholder="Search markets"
                            className="bg-transparent focus:outline-none text-sm w-full text-white"
                        />
                    </div>
                    <WalletMultiButton className={"Hey"} />
                </div>
            </div>
        </header>
    );
};
