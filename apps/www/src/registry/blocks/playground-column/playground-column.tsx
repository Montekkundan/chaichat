"use client";

import { PlaygroundProvider, usePlayground } from "~/lib/providers/playground-provider";
import { PlaygroundColumn as RealPlaygroundColumn } from "~/components/playground/playground-column";

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
                        <div key={col.id} className="min-w-[420px] max-w-[560px] flex-1">
                            <RealPlaygroundColumn column={col} columnIndex={idx} />
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

export { RealPlaygroundColumn as PlaygroundColumn };


