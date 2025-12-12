"use client";

interface ColumnSystemContextProps {
	columnId: string;
	value: string;
	onChange: (value: string) => void;
}

export function ColumnSystemContext({ columnId, value, onChange }: ColumnSystemContextProps) {
	return (
		<div className="py-2 px-3">
			<label htmlFor={`system-${columnId}`} className="mb-1 block text-xs text-muted-foreground">
				System context for this column
			</label>
			<textarea
				id={`system-${columnId}`}
				value={value}
				onChange={(event) => onChange(event.target.value)}
				placeholder="Add system context (e.g., role, restrictions, preferences)"
				className="w-full resize-none rounded-md border bg-background-100 p-2 text-xs"
				style={{ height: 80 }}
				spellCheck={false}
			/>
		</div>
	);
}
