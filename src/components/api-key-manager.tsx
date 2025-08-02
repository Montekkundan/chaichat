"use client";

import { useUser } from "@clerk/nextjs";
import { Eye, EyeOff, Key, X, Filter, ChevronDown, ChevronUp, CircleX, ExternalLink } from "lucide-react";
import { useAction, useMutation } from "convex/react";
import { useConvex } from "convex/react";
import { useEffect, useState, useMemo, useRef, useId } from "react";
import { toast } from "sonner";
import { cn } from "~/lib/utils";
import { api } from "~/../convex/_generated/api";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import { Badge } from "~/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import { Pagination, PaginationContent, PaginationItem } from "~/components/ui/pagination";
import {
	type ColumnDef,
	type ColumnFiltersState,
	type FilterFn,
	type PaginationState,
	type Row,
	type SortingState,
	type VisibilityState,
	flexRender,
	getCoreRowModel,
	getFacetedUniqueValues,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable,
} from "@tanstack/react-table";
import {
	type ProviderId,
	getAllKeys,
	removeLocalKey,
	removeSessionKey,
	setLocalKey,
	setSessionKey,
} from "~/lib/secure-local-keys";
import { getProviderConfigs, type ProviderConfig } from "~/lib/models/providers";

type ApiKeyItem = {
	id: ProviderId;
	name: string;
	icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
	placeholder: string;
	currentKey: string;
	hasKey: boolean;
	status: "Active" | "Missing" | "Invalid";
	apiDocs?: string;
};

// Custom filter function for multi-column searching
const multiColumnFilterFn: FilterFn<ApiKeyItem> = (row, columnId, filterValue) => {
	const searchableRowContent = `${row.original.name} ${row.original.id}`.toLowerCase();
	const searchTerm = (filterValue ?? "").toLowerCase();
	return searchableRowContent.includes(searchTerm);
};

const statusFilterFn: FilterFn<ApiKeyItem> = (row, columnId, filterValue: string[]) => {
	if (!filterValue?.length) return true;
	const status = row.getValue(columnId) as string;
	return filterValue.includes(status);
};

export function ApiKeyManager() {
	const { user } = useUser();
	const convex = useConvex();
	const isLoggedIn = !!user?.id;
	const id = useId();
	const inputRef = useRef<HTMLInputElement>(null);

	const [keys, setKeys] = useState<Record<string, string>>({});
	const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
	const [isLoading, setIsLoading] = useState(true);
	const [useSessionStorage, setUseSessionStorage] = useState(false);
	const [providers, setProviders] = useState<ProviderConfig[]>([]);

	// Table state
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
	const [pagination, setPagination] = useState<PaginationState>({
		pageIndex: 0,
		pageSize: 10,
	});
	const [sorting, setSorting] = useState<SortingState>([
		{
			id: "name",
			desc: false,
		},
	]);

	// Convex mutations for logged-in users
	const storeKeyMutation = useMutation(api.userKeys.storeKey);
	const removeKeyMutation = useMutation(api.userKeys.removeKey);
	const getKeysAction = useAction(api.userKeys.getKeys);

	// Load providers from models.json
	useEffect(() => {
		const loadProviders = async () => {
			try {
				const providerConfigs = await getProviderConfigs();
				setProviders(providerConfigs);
			} catch (error) {
				console.error("Failed to load provider configs:", error);
			}
		};

		loadProviders();
	}, []);

	// Load keys on mount
	useEffect(() => {
		const loadKeys = async () => {
			if (isLoggedIn) {
				// For logged users, fetch from Convex
				try {
					// Use the Convex query to get keys
					const convexKeys = await getKeysAction({});
					// Filter out undefined values and convert to Record<string, string>
					const filteredKeys: Record<string, string> = {};
					if (convexKeys) {
						for (const [key, value] of Object.entries(convexKeys)) {
							if (value) {
								const provider = key.replace("Key", "") as ProviderId;
								filteredKeys[provider] = value as string;
							}
						}
					}
					setKeys(filteredKeys);
				} catch (error) {
					console.error("Failed to load keys from Convex:", error);
				}
			} else {
				// For non-logged users, fetch from local storage
				try {
					const localKeys = await getAllKeys();
					const formattedKeys: Record<string, string> = {};
					for (const [key, value] of Object.entries(localKeys)) {
						if (value) {
							const provider = key.replace("Key", "") as ProviderId;
							formattedKeys[provider] = value;
						}
					}
					setKeys(formattedKeys);
				} catch (error) {
					console.error("Failed to load keys from local storage:", error);
				}
			}
			setIsLoading(false);
		};

		loadKeys();
	}, [isLoggedIn, getKeysAction]);

	// Notify other components when keys change
	useEffect(() => {
		// Dispatch a custom event to notify other components
		window.dispatchEvent(new CustomEvent("apiKeysChanged", { detail: keys }));
	}, [keys]);

	// Transform providers to table data
	const data = useMemo((): ApiKeyItem[] => {
		return providers
			.filter((p) => p.requiresApiKey)
			.map((provider) => {
				const currentKey = keys[provider.id] || "";
				const hasKey = Boolean(currentKey);
				const status: "Active" | "Missing" | "Invalid" = hasKey ? "Active" : "Missing";

				return {
					id: provider.id as ProviderId,
					name: provider.name,
					icon: provider.icon,
					placeholder: provider.placeholder,
					currentKey,
					hasKey,
					status,
					apiDocs: provider.apiDocs,
				};
			});
	}, [providers, keys]);

	// Check if any provider has apiDocs URLs
	const hasAnyUrls = useMemo(() => {
		return data.some(item => item.apiDocs);
	}, [data]);

	const handleSaveKey = async (provider: ProviderId, key: string) => {
		const trimmedKey = key.trim();

		if (!trimmedKey) {
			await handleRemoveKey(provider);
			return;
		}

		try {
			const providerConfig = providers.find((p) => p.id === provider);
			const providerName = providerConfig?.name || provider;

			if (isLoggedIn) {
				// Store in Convex for logged users
				await storeKeyMutation({ provider, apiKey: trimmedKey });
				toast.success(`${providerName} API key saved securely`);
			} else {
				// Store in encrypted local/session storage for non-logged users
				if (useSessionStorage) {
					await setSessionKey(provider, trimmedKey);
					toast.success(`${providerName} API key saved for this session`);
				} else {
					await setLocalKey(provider, trimmedKey);
					toast.success(`${providerName} API key saved locally (encrypted)`);
				}
			}

			setKeys((prev) => ({ ...prev, [provider]: trimmedKey }));
		} catch (error) {
			console.error("Failed to save API key:", error);
			toast.error("Failed to save API key");
		}
	};

	const handleRemoveKey = async (provider: ProviderId) => {
		try {
			const providerConfig = providers.find((p) => p.id === provider);
			const providerName = providerConfig?.name || provider;

			if (isLoggedIn) {
				// Remove from Convex for logged users
				await removeKeyMutation({ provider });
			} else {
				// Remove from local storage for non-logged users
				removeLocalKey(provider);
				removeSessionKey(provider);
			}

			setKeys((prev) => {
				const newKeys = { ...prev };
				delete newKeys[provider];
				return newKeys;
			});

			toast.success(`${providerName} API key removed`);
		} catch (error) {
			console.error("Failed to remove API key:", error);
			toast.error("Failed to remove API key");
		}
	};

	const toggleKeyVisibility = (provider: ProviderId) => {
		setShowKeys((prev) => ({ ...prev, [provider]: !prev[provider] }));
	};

	const handleDeleteSelectedRows = () => {
		// This function is no longer used since we removed checkboxes
	};

	// Table columns definition
	const columns: ColumnDef<ApiKeyItem>[] = [
		{
			header: "Provider",
			accessorKey: "name",
			cell: ({ row }) => {
				const IconComponent = row.original.icon;
				return (
					<div className="flex items-center gap-3 font-medium">
						<IconComponent className="h-5 w-5" />
						{row.getValue("name")}
					</div>
				);
			},
			size: 200,
			filterFn: multiColumnFilterFn,
			enableHiding: false,
		},
		{
			header: "Status",
			accessorKey: "status",
			cell: ({ row }) => (
				<Badge
					className={cn(
						row.getValue("status") === "Missing" &&
							"bg-muted-foreground/60 text-primary-foreground",
						row.getValue("status") === "Active" && "bg-green-600 text-white"
					)}
				>
					{row.getValue("status")}
				</Badge>
			),
			size: 100,
			filterFn: statusFilterFn,
		},
		// Conditionally include Links column only if URLs are available
		...(hasAnyUrls ? [{
			header: "Links",
			accessorKey: "apiDocs",
			cell: ({ row }: { row: Row<ApiKeyItem> }) => {
				const apiDocs = row.original.apiDocs;
				
				if (!apiDocs) {
					return (
						<div className="text-muted-foreground text-xs">
							-
						</div>
					);
				}

				return (
					<div className="flex gap-1">
						<Button
							variant="ghost"
							size="sm"
							className="h-8 w-8 p-0"
							onClick={() => window.open(apiDocs, '_blank')}
							title="API Documentation"
						>
							<ExternalLink className="h-4 w-4" />
						</Button>
					</div>
				);
			},
			size: 80,
			enableSorting: false,
		}] : []),
		{
			header: "API Key",
			accessorKey: "currentKey",
			cell: ({ row }) => {
				const provider = row.original.id;
				const currentKey = row.original.currentKey;
				const isVisible = showKeys[provider] || false;

				return (
					<div className="flex gap-2 items-center min-w-0">
						<div className="relative flex-1 min-w-0">
							<Input
								type={isVisible ? "text" : "password"}
								placeholder={row.original.placeholder}
								value={currentKey}
								onChange={(e) => {
									const newValue = e.target.value;
									setKeys((prev) => ({
										...prev,
										[provider]: newValue,
									}));

									const trimmedValue = newValue.trim();
									if (trimmedValue && trimmedValue !== currentKey) {
										// Small delay to avoid saving while user is still typing
										setTimeout(() => {
											handleSaveKey(provider, trimmedValue);
										}, 500);
									}
								}}
								onBlur={(e) => {
									const value = e.target.value.trim();
									if (value !== currentKey) {
										handleSaveKey(provider, value);
									}
								}}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										handleSaveKey(provider, e.currentTarget.value);
									}
								}}
								className="pr-16 text-sm"
							/>
							<div className="absolute top-1/2 right-2 -translate-y-1/2 flex gap-1">
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="h-6 w-6 p-0"
									onClick={() => toggleKeyVisibility(provider)}
								>
									{isVisible ? (
										<EyeOff className="size-3" />
									) : (
										<Eye className="size-3" />
									)}
								</Button>
								{currentKey && (
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="h-6 w-6 p-0 text-destructive hover:text-destructive"
										onClick={() => handleRemoveKey(provider)}
									>
										<X className="size-3" />
									</Button>
								)}
							</div>
						</div>
					</div>
				);
			},
			size: 300,
			enableSorting: false,
		},
	];

	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		onSortingChange: setSorting,
		enableSortingRemoval: false,
		getPaginationRowModel: getPaginationRowModel(),
		onPaginationChange: setPagination,
		onColumnFiltersChange: setColumnFilters,
		onColumnVisibilityChange: setColumnVisibility,
		getFilteredRowModel: getFilteredRowModel(),
		getFacetedUniqueValues: getFacetedUniqueValues(),
		state: {
			sorting,
			pagination,
			columnFilters,
			columnVisibility,
		},
	});

	// Get unique status values
	const uniqueStatusValues = useMemo(() => {
		const statusColumn = table.getColumn("status");
		if (!statusColumn) return [];
		const values = Array.from(statusColumn.getFacetedUniqueValues().keys());
		return values.sort();
	}, [table.getColumn("status")?.getFacetedUniqueValues()]);

	// Get counts for each status
	const statusCounts = useMemo(() => {
		const statusColumn = table.getColumn("status");
		if (!statusColumn) return new Map();
		return statusColumn.getFacetedUniqueValues();
	}, [table.getColumn("status")?.getFacetedUniqueValues()]);

	const selectedStatuses = useMemo(() => {
		const filterValue = table.getColumn("status")?.getFilterValue() as string[];
		return filterValue ?? [];
	}, [table.getColumn("status")?.getFilterValue()]);

	const handleStatusChange = (checked: boolean, value: string) => {
		const filterValue = table.getColumn("status")?.getFilterValue() as string[];
		const newFilterValue = filterValue ? [...filterValue] : [];

		if (checked) {
			newFilterValue.push(value);
		} else {
			const index = newFilterValue.indexOf(value);
			if (index > -1) {
				newFilterValue.splice(index, 1);
			}
		}

		table
			.getColumn("status")
			?.setFilterValue(newFilterValue.length ? newFilterValue : undefined);
	};

	if (isLoading) {
		return (
			<div className="rounded-lg border bg-card p-6">
				<div className="text-center text-muted-foreground">Loading API keys...</div>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="mb-4">
				<div className="mb-2 flex items-center gap-2">
					<Key className="size-5" />
					<h2 className="font-semibold text-xl">API Key Management</h2>
				</div>
				<p className="mb-3 text-foreground text-sm">
					{isLoggedIn
						? "Your API keys are stored securely in your account and synced across devices."
						: "Your API keys are encrypted and stored locally in your browser for privacy."}
				</p>

				{!isLoggedIn && (
					<div className="mt-3 rounded-lg bg-muted/50 p-3">
						<div className="mb-2 flex items-center gap-2">
							<input
								type="checkbox"
								id="session-storage"
								checked={useSessionStorage}
								onChange={(e) => setUseSessionStorage(e.target.checked)}
								className="rounded"
							/>
							<Label htmlFor="session-storage" className="text-sm">
								Use session storage (keys deleted when browser closes)
							</Label>
						</div>
						<p className="text-muted-foreground text-xs">
							Recommended for shared computers. Uncheck to persist keys between sessions.
						</p>
					</div>
				)}
			</div>

			{/* Filters */}
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex items-center gap-3">
					{/* Filter by provider name */}
					<div className="relative">
						<Input
							id={`${id}-input`}
							ref={inputRef}
							className={cn(
								"peer min-w-60 ps-9",
								Boolean(table.getColumn("name")?.getFilterValue()) && "pe-9"
							)}
							value={(table.getColumn("name")?.getFilterValue() ?? "") as string}
							onChange={(e) => table.getColumn("name")?.setFilterValue(e.target.value)}
							placeholder="Filter by provider name..."
							type="text"
							aria-label="Filter by provider name"
						/>
						<div className="pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 text-muted-foreground/80 peer-disabled:opacity-50">
							<Filter size={16} strokeWidth={2} aria-hidden="true" />
						</div>
						{Boolean(table.getColumn("name")?.getFilterValue()) && (
							<button
								className="absolute inset-y-0 end-0 flex h-full w-9 items-center justify-center rounded-e-lg text-muted-foreground/80 outline-offset-2 transition-colors hover:text-foreground focus:z-10 focus-visible:outline-2 focus-visible:outline-ring/70 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
								aria-label="Clear filter"
								onClick={() => {
									table.getColumn("name")?.setFilterValue("");
									if (inputRef.current) {
										inputRef.current.focus();
									}
								}}
							>
								<CircleX size={16} strokeWidth={2} aria-hidden="true" />
							</button>
						)}
					</div>
					{/* Filter by status */}
					<Popover>
						<PopoverTrigger asChild>
							<Button variant="outline">
								<Filter
									className="-ms-1 me-2 opacity-60"
									size={16}
									strokeWidth={2}
									aria-hidden="true"
								/>
								Status
								{selectedStatuses.length > 0 && (
									<span className="-me-1 ms-3 inline-flex h-5 max-h-full items-center rounded border border-border bg-background px-1 font-[inherit] text-[0.625rem] font-medium text-muted-foreground/70">
										{selectedStatuses.length}
									</span>
								)}
							</Button>
						</PopoverTrigger>
						<PopoverContent className="min-w-36 p-3" align="start">
							<div className="space-y-3">
								<div className="text-xs font-medium text-muted-foreground">
									Filters
								</div>
								<div className="space-y-3">
									{uniqueStatusValues.map((value, i) => (
										<div key={value} className="flex items-center gap-2">
											<Checkbox
												id={`${id}-${i}`}
												checked={selectedStatuses.includes(value)}
												onCheckedChange={(checked: boolean) =>
													handleStatusChange(checked, value)
												}
											/>
											<Label
												htmlFor={`${id}-${i}`}
												className="flex grow justify-between gap-2 font-normal"
											>
												{value}{" "}
												<span className="ms-2 text-xs text-muted-foreground">
													{statusCounts.get(value)}
												</span>
											</Label>
										</div>
									))}
								</div>
							</div>
						</PopoverContent>
					</Popover>
				</div>
			</div>

			{/* Table */}
			<div className="overflow-hidden rounded-lg border border-border bg-background">
				<Table className="table-fixed">
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id} className="hover:bg-transparent">
								{headerGroup.headers.map((header) => {
									return (
										<TableHead
											key={header.id}
											style={{ width: `${header.getSize()}px` }}
											className="h-11"
										>
											{header.isPlaceholder ? null : header.column.getCanSort() ? (
												<div
													className={cn(
														header.column.getCanSort() &&
															"flex h-full cursor-pointer select-none items-center justify-between gap-2"
													)}
													onClick={header.column.getToggleSortingHandler()}
													onKeyDown={(e) => {
														// Enhanced keyboard handling for sorting
														if (
															header.column.getCanSort() &&
															(e.key === "Enter" || e.key === " ")
														) {
															e.preventDefault();
															header.column.getToggleSortingHandler()?.(e);
														}
													}}
													tabIndex={header.column.getCanSort() ? 0 : undefined}
												>
													{flexRender(
														header.column.columnDef.header,
														header.getContext()
													)}
													{{
														asc: (
															<ChevronUp
																className="shrink-0 opacity-60"
																size={16}
																strokeWidth={2}
																aria-hidden="true"
															/>
														),
														desc: (
															<ChevronDown
																className="shrink-0 opacity-60"
																size={16}
																strokeWidth={2}
																aria-hidden="true"
															/>
														),
													}[header.column.getIsSorted() as string] ?? null}
												</div>
											) : (
												flexRender(
													header.column.columnDef.header,
													header.getContext()
												)
											)}
										</TableHead>
									);
								})}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{table.getRowModel().rows?.length ? (
							table.getRowModel().rows.map((row) => (
								<TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
									{row.getVisibleCells().map((cell) => (
										<TableCell key={cell.id} className="py-3">
											{flexRender(cell.column.columnDef.cell, cell.getContext())}
										</TableCell>
									))}
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell colSpan={columns.length} className="h-24 text-center">
									No API key providers found.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			{/* Pagination */}
			<div className="flex items-center justify-between gap-8">
				{/* Results per page */}
				<div className="flex items-center gap-3">
					<Label htmlFor={`${id}-pagination`} className="max-sm:sr-only">
						Rows per page
					</Label>
					<Select
						value={table.getState().pagination.pageSize.toString()}
						onValueChange={(value) => {
							table.setPageSize(Number(value));
						}}
					>
						<SelectTrigger id={`${id}-pagination`} className="w-fit whitespace-nowrap">
							<SelectValue placeholder="Select number of results" />
						</SelectTrigger>
						<SelectContent>
							{[5, 10, 25, 50].map((pageSize) => (
								<SelectItem key={pageSize} value={pageSize.toString()}>
									{pageSize}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				{/* Page number information */}
				<div className="flex grow justify-end whitespace-nowrap text-sm text-muted-foreground">
					<p className="whitespace-nowrap text-sm text-muted-foreground" aria-live="polite">
						<span className="text-foreground">
							{table.getState().pagination.pageIndex *
								table.getState().pagination.pageSize +
								1}
							-
							{Math.min(
								Math.max(
									table.getState().pagination.pageIndex *
										table.getState().pagination.pageSize +
										table.getState().pagination.pageSize,
									0
								),
								table.getRowCount()
							)}
						</span>{" "}
						of <span className="text-foreground">{table.getRowCount().toString()}</span>
					</p>
				</div>

				{/* Pagination buttons */}
				<div>
					<Pagination>
						<PaginationContent>
							{/* Previous page button */}
							<PaginationItem>
								<Button
									size="icon"
									variant="outline"
									className="disabled:pointer-events-none disabled:opacity-50"
									onClick={() => table.previousPage()}
									disabled={!table.getCanPreviousPage()}
									aria-label="Go to previous page"
								>
									<ChevronDown
										className="rotate-90"
										size={16}
										strokeWidth={2}
										aria-hidden="true"
									/>
								</Button>
							</PaginationItem>
							{/* Next page button */}
							<PaginationItem>
								<Button
									size="icon"
									variant="outline"
									className="disabled:pointer-events-none disabled:opacity-50"
									onClick={() => table.nextPage()}
									disabled={!table.getCanNextPage()}
									aria-label="Go to next page"
								>
									<ChevronDown
										className="-rotate-90"
										size={16}
										strokeWidth={2}
										aria-hidden="true"
									/>
								</Button>
							</PaginationItem>
						</PaginationContent>
					</Pagination>
				</div>
			</div>
		</div>
	);
}
