import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";

import { useState } from "react";
import { marketTopics } from "@/lib/constants";

interface Props {
    open: boolean;
    onClose: () => void;
}

export default function CreateMarketModal({ open, onClose }: Props) {
    const [marketName, setMarketName] = useState("");
    const [selectedTopic, setSelectedTopic] = useState("");

    const handleSubmit = () => {
        console.log("Market Name:", marketName);
        console.log("Selected Topic:", selectedTopic);
        onModalClose(); // You’ll replace this with actual logic
    };

    const onModalClose = () => {
        setSelectedTopic("");
        onClose();
    }

    return (
        <Dialog open={open} onOpenChange={onModalClose}>
            <DialogContent
                className="bg-zinc-900 text-white border border-zinc-700 shadow-2xl backdrop-blur-lg rounded-xl sm:max-w-md"
            >
                <DialogHeader>
                    <DialogTitle className="text-xl font-semibold text-white">
                        Create a New Market
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 mt-4">
                    <Input
                        placeholder="Market name (e.g. 'Romania President in 2025?')"
                        className="bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-400 focus:ring-2 focus:ring-green-500"
                        value={marketName}
                        onChange={(e) => setMarketName(e.target.value)}
                    />

                    <Select onValueChange={(val) => setSelectedTopic(val)}>
                        <SelectTrigger
                            className={`bg-zinc-800 border border-zinc-700 h-10 ${
                                selectedTopic ? "[&>span]:text-white" : "[&>span]:text-zinc-400"
                            }`}
                        >
                            <SelectValue placeholder="Select Topic" />
                        </SelectTrigger>

                        <SelectContent className="bg-zinc-900 border-zinc-700 text-white">
                            {marketTopics.map((topic) => (
                                <SelectItem
                                    key={topic}
                                    value={topic}
                                    className="hover:bg-zinc-700 focus:bg-zinc-700"
                                >
                                    {topic}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <DialogFooter className="mt-6 flex justify-end gap-2">
                    <Button
                        variant="secondary"
                        onClick={onModalClose}
                        className="bg-zinc-700 text-white hover:bg-zinc-600"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        className="bg-lime-600 hover:bg-lime-700 text-white"
                    >
                        Submit
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
