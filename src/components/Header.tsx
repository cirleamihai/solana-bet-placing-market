import {Search, Settings, Bookmark, Bell} from "lucide-react";
import {Button} from "@/components/ui/button";
import {WalletMultiButton} from "@solana/wallet-adapter-react-ui";
import {Link} from "react-router-dom";
import ConnectWalletButton from "@/components/ConnectWalletButton";

export default function Header() {
    return (
        <header className="bg-slate-800 text-white shadow-sm px-4 py-5">
            <div className="max-w-2/3 mx-auto flex items-center justify-between tracking-ti">
                {/* Left: Logo and Nav */}
                <div className="flex items-center gap-6">
                    <Link to="/" className="text-3xl font-bold tracking-tight">
                        UBB Market
                    </Link>
                    <nav className="hidden md:flex gap-4 mt-2 text-sm font-medium text-zinc-300">
                        <Link to="#" className="hover:text-white">Trending</Link>
                        <Link to="#" className="hover:text-white">Politics</Link>
                        <Link to="#" className="hover:text-white">Sports</Link>
                        <Link to="#" className="hover:text-white">Crypto</Link>
                        <Link to="#" className="hover:text-white">Tech</Link>
                        <Link to="#" className="hover:text-white">World</Link>
                        <Link to="#" className="hover:text-white">Other</Link>
                    </nav>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-4 ml-auto">
                    <div
                        className="hidden md:flex items-center mr-10 gap-2 bg-white px-3 py-1.5 rounded-full w-75 ml-4">
                        <Search className="w-5 h-5 text-zinc-800"/>
                        <input
                            type="text"
                            placeholder="Search markets"
                            className="bg-transparent focus:outline-none text-sm w-full text-zinc-800"
                        />
                    </div>
                    <Button
                        className="bg-lime-600 hover:bg-lime-700 cursor-pointer text-white font-semibold px-6 py-2 h-13 rounded-xl text-lg flex items-center justify-center"
                    >
                        <div>
                            + Create Market
                        </div>
                    </Button>
                    <ConnectWalletButton/>
                </div>
            </div>

            <div className="mt-4">
                <div className="border-b-[0.2px] border-gray-600"/>
            </div>
        </header>

    );
};
