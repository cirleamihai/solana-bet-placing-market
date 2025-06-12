import {Search} from "lucide-react";
import {useEffect, useState} from "react";
import {Button} from "@/components/ui/button";
import {Link} from "react-router-dom";
import ConnectWalletButton from "@/components/ConnectWalletButton";
import {DUMMY_PUBKEY, marketTopics, USD_MINT} from "@/lib/constants";
import CreateMarketModal from "@/components/CreateMarket";
import {useAnchorProgram} from "@/lib/anchor";
import {getAssociatedTokenAddress, getAccount, getMint} from "@solana/spl-token";
import {toast} from "sonner";
import {FiDollarSign} from 'react-icons/fi';
import {listenToAccountChangeHelius} from "@/blockchain/heliusEventListener";
import {createAssociatedTokenAccounts} from "@/blockchain/createAssociatedTokenAccounts";

interface HeaderProps {
    searchQuery?: string;
    setSearchQuery?: (query: string) => void;
}

export default function Header({
                                   searchQuery = "",
                                   setSearchQuery = () => {
                                   },
                               }: HeaderProps) {
    const [modalOpen, setModalOpen] = useState(false);
    const [userBalance, setuserBalance] = useState<number | null>(null);
    const {wallet, connection} = useAnchorProgram()
    const [accountChanged, setAccountChanged] = useState(0);

    // Listen on the blockchain for any balance changes
    listenToAccountChangeHelius(
        setAccountChanged,
        wallet?.publicKey || DUMMY_PUBKEY
    )

    useEffect(() => {
        const fetchBalance = async () => {
            if (!wallet?.publicKey) return;
            const usd_account = (await createAssociatedTokenAccounts(
                USD_MINT,
                wallet.publicKey,
                wallet,
                connection,
                []
            )).account

            if (usd_account) {
                const balance = Number(usd_account.amount.toString()) / 10 ** 9; // Convert from lamports to USD
                setuserBalance(balance);
            } else {
                setuserBalance(0); // No token account found, balance will be set to 0 in that case
            }
        };

        fetchBalance();
    }, [wallet, connection, accountChanged]);

    return (
        <header className="bg-slate-800 text-white shadow-sm px-4 py-5">
            <div className="w-[90%] mx-auto flex items-center justify-between tracking-ti">
                {/* Left: Logo and Nav */}
                <div className="flex items-center gap-6">
                    <Link to="/" className="text-3xl font-bold tracking-tight">
                        UBB Market
                    </Link>
                    <nav className="hidden md:flex gap-4 mt-2 text-sm font-medium text-zinc-300">
                        {marketTopics.map((topic, index) => (
                            <Link to={`/markets/${topic.toLocaleLowerCase()}`} key={index}
                                  className="hover:text-white">{topic}</Link>
                        ))}
                    </nav>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-4 ml-auto">
                    <div
                        className="hidden md:flex items-center mr-10 gap-2 bg-white px-3 py-1.5 rounded-full w-75 ml-4">
                        <Search className="w-5 h-5 text-zinc-800"/>
                        <input
                            type="text"
                            value={searchQuery}
                            placeholder="Search markets"
                            className="bg-transparent focus:outline-none text-sm w-full text-zinc-800"
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    {userBalance !== null && wallet?.publicKey && (
                        <div
                            className="hidden md:flex items-center bg-gray-900 border border-gray-700 rounded-xl px-5 py-3 text-sm font-medium text-white shadow-lg hover:bg-gray-800 transition-colors duration-200">
                            <div className="flex-shrink-0 bg-green-500 rounded-full p-2">
                                <FiDollarSign className="w-4 h-4 text-white" aria-hidden="true"/>
                            </div>

                            {/* Formatted amount */}
                            <span className="ml-3 text-[#27ae60]">
                              {new Intl.NumberFormat(undefined, {
                                  style: 'currency',
                                  currency: 'USD',
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                              }).format(userBalance)}
                            </span>
                        </div>
                    )}
                    <Button
                        className="bg-lime-600 hover:bg-lime-700 cursor-pointer text-white font-semibold px-6 py-2 h-12.5 rounded text-lg flex items-center justify-center"
                        onClick={(e) => {
                            e.preventDefault();
                            if (!wallet?.publicKey) {
                                toast.error("Please connect your wallet to create a market.");
                                return;
                            }
                            setModalOpen(true);
                        }}
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

            <CreateMarketModal open={modalOpen} onClose={() => setModalOpen(false)}/>
        </header>

    );
};
