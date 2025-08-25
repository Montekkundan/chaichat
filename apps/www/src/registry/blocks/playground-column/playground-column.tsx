"use client";

import { PlaygroundProvider, usePlayground } from "~/lib/providers/playground-provider";

function Inner() {
    const { columns, addColumn, maxColumns } = usePlayground();
    if (!columns || columns.length === 0) return null;
    return (
        <div className="w-full space-y-2">
            <div className="flex justify-end">
                <button
                    type="button"
                    onClick={addColumn}
                    disabled={columns.length >= maxColumns}
                    className="rounded-md border px-2 py-1 text-xs hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Add Column
                </button>
            </div>
            <div className="w-full overflow-x-auto">
                <div className="flex min-w-full gap-3">
                    {columns.map((col, idx) => (
                        <div key={col.id} className="min-w-[360px] max-w-[480px] flex-1">
                            <div className="flex h-[420px] flex-col rounded-lg border bg-background">
                                <div className="flex items-center justify-between border-b p-2">
                                    <div className="font-medium text-sm">Column {idx + 1}</div>
                                </div>
                                <div className="flex flex-1 items-center justify-center p-4 text-muted-foreground text-sm">
                                    Preview-only column (no chat UI)
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function PlaygroundColumnBlock() {
    return (
        <PlaygroundProvider playgroundId={"registry-preview"}>
            <Inner />
        </PlaygroundProvider>
    );
}

