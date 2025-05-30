import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export default function NavBar() {
    return (
        <nav>
            <WalletMultiButton />
        </nav>
    );
}