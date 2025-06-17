'use client';

import { useMemo, useState } from 'react';
import { useChats } from '~/lib/providers/chats-provider';
import { useCache } from '~/lib/providers/cache-provider';
import { Button } from '~/components/ui/button';
import { toast } from '~/components/ui/toast';
import { Save, Trash2 } from 'lucide-react';

export default function HistoryPage() {
	const { chats, deleteChat, isLoading } = useChats();
	const cache = useCache();

	const [filter, setFilter] = useState('');
	const [selected, setSelected] = useState<Set<string>>(new Set());

	const displayed = useMemo(() => {
		if (!filter.trim()) return chats;
		const lower = filter.toLowerCase();
		return chats.filter((c) => c.name.toLowerCase().includes(lower));
	}, [filter, chats]);

	const toggleSelect = (id: string) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const selectAll = () => setSelected(new Set(displayed.map((c) => c._id)));
	const clearSelection = () => setSelected(new Set());

	const handleDelete = async () => {
		if (selected.size === 0) return;
		if (!confirm(`Delete ${selected.size} chat(s)? This cannot be undone.`)) return;
		for (const id of selected) {
			await deleteChat(id);
		}
		toast({ title: 'Chats deleted', status: 'success' });
		clearSelection();
	};

	const handleExport = async () => {
		if (selected.size === 0) return;
		const selectedChats = chats.filter((c) => selected.has(c._id));
		const data = await Promise.all(
			selectedChats.map(async (chat) => {
				try {
					const messages = await cache.getMessages(chat._id);
					return { chat, messages };
				} catch (err) {
					console.error('Failed to fetch messages for export', err);
					return { chat, messages: [] };
				}
			})
		);
		const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'chats.json';
		a.click();
		URL.revokeObjectURL(url);
	};

	return (
		<div className="p-8 space-y-6">
			<h1 className="text-2xl font-semibold">Message History</h1>

			<div className="flex flex-wrap gap-2 items-center">
				<Button variant="secondary" onClick={selectAll}>Select All</Button>
				<Button variant="ghost" onClick={clearSelection}>Clear Selection</Button>
				<input
					value={filter}
					onChange={(e) => setFilter(e.target.value)}
					placeholder="Filter by title…"
					className="ml-auto w-64 rounded-md border px-3 py-2 bg-background text-sm"
				/>
				<Button onClick={handleExport} disabled={selected.size === 0} className="gap-1">
					<Save className="h-4 w-4" /> Export ({selected.size})
				</Button>
				<Button variant="destructive" onClick={handleDelete} disabled={selected.size === 0} className="gap-1">
					<Trash2 className="h-4 w-4" /> Delete ({selected.size})
				</Button>
			</div>

			<div className="border rounded-md max-h-[70vh] overflow-y-auto">
				<table className="w-full text-left text-sm">
					<thead className="sticky top-0 bg-muted/30 backdrop-blur">
						<tr>
							<th className="w-12 px-4 py-2">
								<input
									type="checkbox"
									checked={selected.size > 0 && selected.size === displayed.length}
									ref={(el) => {
										if (el) {
											el.indeterminate = selected.size > 0 && selected.size < displayed.length;
										}
									}}
									onChange={(e) => {
										if (e.target.checked) selectAll(); else clearSelection();
									}}
								/>
							</th>
							<th className="py-2">Title</th>
							<th className="py-2">Created</th>
						</tr>
					</thead>
					<tbody>
						{isLoading ? (
							<tr><td colSpan={3} className="p-4 text-center">Loading…</td></tr>
						) : displayed.length === 0 ? (
							<tr><td colSpan={3} className="p-4 text-center">No chats</td></tr>
						) : (
							displayed.map((chat) => (
								<tr key={chat._id} className="border-t hover:bg-muted/10">
									<td className="px-4 py-2">
										<input
											type="checkbox"
											checked={selected.has(chat._id)}
											onChange={() => toggleSelect(chat._id)}
										/>
									</td>
									<td className="py-2">{chat.name}</td>
									<td className="py-2">{new Date(chat.createdAt).toLocaleString()}</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}
