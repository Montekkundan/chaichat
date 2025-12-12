"use client";

import { useState } from "react";

type PreviewColumn = {
    id: string;
    modelId: string;
    synced: boolean;
    input: string;
    label: number;
};

export default function PlaygroundColumnBlock() {
    const [columns, setColumns] = useState<PreviewColumn[]>([
        { id: "col-1", modelId: "openai/gpt-4o-mini", synced: false, input: "", label: 1 },
        { id: "col-2", modelId: "openai/gpt-4o-mini", synced: false, input: "", label: 2 },
    ]);
    const addColumn = () => {
        setColumns((prev) => {
            const nextLabel = prev.length > 0 ? Math.max(...prev.map((c) => c.label)) + 1 : 1;
            return [
                ...prev,
                {
                    id: `col-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                    modelId: "openai/gpt-4o-mini",
                    synced: false,
                    input: "",
                    label: nextLabel,
                },
            ];
        });
    };

    const removeColumn = (id: string) => {
        setColumns((prev) => prev.filter((c) => c.id !== id));
    };

    const moveLeft = (id: string) => {
        setColumns((prev) => {
            const idx = prev.findIndex((c) => c.id === id);
            if (idx <= 0) return prev;
            const next: PreviewColumn[] = [...prev];
            const current = next[idx];
            const left = next[idx - 1];
            if (!current || !left) return prev;
            next[idx - 1] = current;
            next[idx] = left;
            return next;
        });
    };

    const moveRight = (id: string) => {
        setColumns((prev) => {
            const idx = prev.findIndex((c) => c.id === id);
            if (idx < 0 || idx >= prev.length - 1) return prev;
            const next: PreviewColumn[] = [...prev];
            const current = next[idx];
            const right = next[idx + 1];
            if (!current || !right) return prev;
            next[idx] = right;
            next[idx + 1] = current;
            return next;
        });
    };

    return (
        <div className="h-full min-h-0 w-full flex flex-col">
            <div className="flex h-9 items-center justify-end">
                <button
                    type="button"
                    onClick={addColumn}
                    className="rounded-md border px-2 py-1 text-xs hover:bg-accent"
                >
                    Add Column
                </button>
            </div>
            <div className="w-full flex-1 min-h-0 overflow-x-auto">
                <div className="flex h-full min-h-0 min-w-full gap-3">
                    {columns.map((col, idx) => {
                        const canMoveLeft = idx > 0;
                        const canMoveRight = idx < columns.length - 1;
                        const canRemove = columns.length > 1;
                        return (
                            <div key={col.id} className="min-w-[360px] max-w-[480px] h-full min-h-0 flex-1">
                                <div className="flex h-full min-h-0 flex-col rounded-lg border bg-background">
                                    <div className="m-1 flex items-center justify-end gap-1 py-1 pr-2 pl-2">
                                        <button
                                            type="button"
                                            onClick={() => moveLeft(col.id)}
                                            disabled={!canMoveLeft}
                                            className="rounded border px-2 py-1 text-xs hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            Left
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => moveRight(col.id)}
                                            disabled={!canMoveRight}
                                            className="rounded border px-2 py-1 text-xs hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            Right
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => removeColumn(col.id)}
                                            disabled={!canRemove}
                                            className="rounded border px-2 py-1 text-xs hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                    <div className="flex flex-1 min-h-0 items-center justify-center p-4 text-muted-foreground text-sm">
                                        Column {col.label}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

