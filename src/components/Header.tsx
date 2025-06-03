import {Search, Settings, Bookmark, Bell} from "lucide-react";
import {Button} from "@/components/ui/button";
import {WalletMultiButton} from "@solana/wallet-adapter-react-ui";
import {Link} from "react-router-dom";
import ConnectWalletButton from "@/components/ConnectWalletButton";

export default function Header() {
    return (
        <header className="bg-slate-800 text-white shadow-sm px-4 py-5">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                {/* Left: Logo and Nav */}
                <div className="flex items-center gap-6">
                    <Link to="/" className="text-3xl font-bold tracking-tight">
                        UBB Market
                    </Link>
                    <nav className="hidden md:flex gap-4 text-sm font-medium text-zinc-300">
                        <Link to="#" className="hover:text-white">Trending</Link>
                        <Link to="#">Politics</Link>
                        <Link to="#">Sports</Link>
                        <Link to="#">Crypto</Link>
                        <Link to="#">Tech</Link>
                        <Link to="#">World</Link>
                        <Link to="#">Other</Link>
                    </nav>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-4 ml-auto">
                    <div className="hidden md:flex items-center gap-2 bg-white px-3 py-1.5 rounded-full w-64">
                        <Search className="w-6 h-6 text-zinc-800"/>
                        <input
                            type="text"
                            placeholder="Search markets"
                            className="bg-transparent focus:outline-none text-sm w-full text-zinc-800"
                        />
                    </div>
                    <ConnectWalletButton/>
                </div>
            </div>

            <div className="mt-4">
                <div className="border-b-[0.2px] border-gray-200"/>
            </div>
        </header>

    );
};
