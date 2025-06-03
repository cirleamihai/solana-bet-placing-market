import { Frown } from "lucide-react";

export default function EmptyState() {
    return (
        <div className="bg-slate-800 min-h-screen flex flex-col items-center justify-center text-zinc-400">
            <Frown className="w-20 h-20 mb-4" />
            <h2 className="text-xl font-semibold">No markets yet</h2>
            <p className="text-sm">Once users create markets, they’ll appear here.</p>
        </div>
    );
}