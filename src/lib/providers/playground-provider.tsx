"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useConvex } from "convex/react";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { getAllKeys } from "~/lib/local-keys";
import { db, type Playground as DBPlayground, type PlaygroundMessage as DBPlaygroundMessage } from "~/db";
import { userSessionManager } from "~/lib/user-session-manager";
import type { UIMessage } from "@ai-sdk/react";
type PlaygroundMessage = UIMessage & {
	content?: string;
	createdAt?: Date;
	model?: string;
	_creationTime?: number;
};

type ModelConfig = {
	temperature: number;
	maxOutputTokens: number;
	topP: number;
	topK: number;
	frequencyPenalty: number;
	presencePenalty: number;
};

export type ChatColumn = {
	id: string;
	modelId: string;
	messages: PlaygroundMessage[];
	input: string;
	synced: boolean;
	config: ModelConfig;
	isStreaming: boolean;
};

type PlaygroundState = {
	columns: ChatColumn[];
	sharedInput: string;
	currentPlaygroundId: string;
    createdAt?: number;
    parentChatId?: string;
    columnChatIds?: Record<string, string>;
};

interface PlaygroundContextType {
	columns: ChatColumn[];
	sharedInput: string;
	playgroundId: string;
	addColumn: () => void;
	removeColumn: (columnId: string) => void;
	updateColumn: (columnId: string, updates: Partial<ChatColumn>) => void;
	clearColumn: (columnId: string) => void;
	moveColumnLeft: (columnId: string) => void;
	moveColumnRight: (columnId: string) => void;
	toggleColumnSync: (columnId: string) => void;
	updateSharedInput: (input: string) => void;
	updateColumnInput: (columnId: string, input: string) => void;
	sendToColumn: (columnId: string, message: string) => Promise<void>;
	sendToSyncedColumns: (message: string) => Promise<void>;
	createNewPlayground: () => void;
	savePlayground: () => Promise<void>;
	loadPlayground: (playgroundId: string) => Promise<void>;
}

const PlaygroundContext = createContext<PlaygroundContextType | null>(null);

export function usePlayground() {
	const context = useContext(PlaygroundContext);
	if (!context) {
		throw new Error("usePlayground must be used within a PlaygroundProvider");
	}
	return context;
}

interface PlaygroundProviderProps {
	children: ReactNode;
	playgroundId?: string | null;
}

const createDefaultConfig = (): ModelConfig => ({
	temperature: 0.7,
	maxOutputTokens: 1024,
	topP: 1,
	topK: 0,
	frequencyPenalty: 0,
	presencePenalty: 0,
});

let columnCounter = 0;

const createDefaultColumn = (modelId?: string): ChatColumn => {
	const defaultModel = modelId || "openai/gpt-4o-mini";
	return {
		id: `column-${++columnCounter}`,
		modelId: defaultModel,
		messages: [],
		input: "",
		synced: false,
		config: createDefaultConfig(),
		isStreaming: false,
	};
};

const createTextParts = (content: string): UIMessage["parts"] => [
	{
		type: "text" as const,
		text: content,
	}
];

const PLAYGROUND_LIST_KEY = "chaichat_playground_list";
const PLAYGROUND_PREFIX = "chaichat_playground_";

function savePlaygroundToStorage(playgroundId: string, state: PlaygroundState) {
	if (typeof window === "undefined") return;
	try {
        const payload: PlaygroundState = {
            ...state,
            createdAt: state.createdAt ?? Date.now(),
        };
        localStorage.setItem(PLAYGROUND_PREFIX + playgroundId, JSON.stringify(payload));
        let list: string[] = [];
        let listChanged = false;
        try {
            list = JSON.parse(localStorage.getItem(PLAYGROUND_LIST_KEY) || "[]");
        } catch {}
        if (!list.includes(playgroundId)) {
            list.unshift(playgroundId);
            if (list.length > 10) list = list.slice(0, 10);
            localStorage.setItem(PLAYGROUND_LIST_KEY, JSON.stringify(list));
            listChanged = true;
        }

        if (listChanged) {
            try {
                const minimal = list.map((id) => {
                    try {
                        const raw = localStorage.getItem(PLAYGROUND_PREFIX + id);
                        const parsed = raw ? JSON.parse(raw) : {};
                        return {
                            id,
                            name: parsed.name || id,
                            createdAt: parsed.createdAt || Date.now(),
                        };
                    } catch {
                        return { id, name: id, createdAt: Date.now() };
                    }
                });
                const value = encodeURIComponent(JSON.stringify(minimal.slice(0, 20)));
                document.cookie = `cc_playgrounds=${value}; path=/; max-age=604800; SameSite=Lax`;
            } catch {}
        }
	} catch {}
}

function loadPlaygroundFromStorage(playgroundId: string): PlaygroundState | null {
	if (typeof window === "undefined") return null;
	try {
		const raw = localStorage.getItem(PLAYGROUND_PREFIX + playgroundId);
		if (!raw) return null;
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

export function PlaygroundProvider({
	children,
	playgroundId,
}: PlaygroundProviderProps) {
    const { user } = useUser();
    const currentUserId = user?.id ?? userSessionManager.getStorageUserId();
    const convex = useConvex();
    const router = useRouter();
	
    const [hasLoadedFromStorage, setHasLoadedFromStorage] = useState(false);
    const autoSaveTimerRef = useRef<number | null>(null);
    const inFlightControllersRef = useRef<Map<string, Set<AbortController>>>(new Map());

    const [state, setState] = useState<PlaygroundState>(() => {
		columnCounter = 0;
        if (playgroundId?.includes(",")) {
            const modelIds = playgroundId.split(",").map((s) => s.trim()).filter(Boolean);
            const columnsFromModels = modelIds.map((m) => createDefaultColumn(m));
            return {
                columns: columnsFromModels.length > 0 ? columnsFromModels : [createDefaultColumn(), createDefaultColumn()],
                sharedInput: "",
                currentPlaygroundId: "",
                createdAt: undefined,
                parentChatId: undefined,
                columnChatIds: {},
            };
        }
        return {
			columns: [createDefaultColumn(), createDefaultColumn()],
			sharedInput: "",
            currentPlaygroundId: playgroundId || "",
            createdAt: undefined,
            parentChatId: undefined,
            columnChatIds: {},
		};
	});

    useEffect(() => {
        if (!playgroundId) return;
        if (playgroundId.includes(",")) {
            columnCounter = 0;
            const modelIds = playgroundId.split(",").map((s) => s.trim()).filter(Boolean);
            const columnsFromModels = modelIds.map((m) => createDefaultColumn(m));
            setState({
                columns: columnsFromModels.length > 0 ? columnsFromModels : [createDefaultColumn(), createDefaultColumn()],
                sharedInput: "",
                currentPlaygroundId: "",
                createdAt: undefined,
                parentChatId: undefined,
                columnChatIds: {},
            });
            return;
        }
        setTimeout(() => {
            if (typeof window !== "undefined") {
                const loaded = loadPlaygroundFromStorage(playgroundId);
                if (loaded) {
                    setState(loaded);
                }
            }
            setHasLoadedFromStorage(true);
        }, 0);
    }, [playgroundId]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!hasLoadedFromStorage) return;
        if (!state.currentPlaygroundId || !state.currentPlaygroundId.startsWith("playground-")) return;

        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
        }
        autoSaveTimerRef.current = window.setTimeout(() => {
            savePlaygroundToStorage(state.currentPlaygroundId, state);
        }, 400);

        return () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
                autoSaveTimerRef.current = null;
            }
        };
    }, [state, hasLoadedFromStorage]);

    useEffect(() => {
        return () => {
            for (const controllers of inFlightControllersRef.current.values()) {
                for (const c of controllers) {
                    try { c.abort(); } catch {}
                }
            }
            inFlightControllersRef.current.clear();
        };
    }, []);

    const ensurePlaygroundId = useCallback((): { id: string; created: boolean } => {
        let id = state.currentPlaygroundId;
        let created = false;
        if (!id || !id.startsWith("playground-")) {
            id = `playground-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            const createdAt = Date.now();
            setState(prev => ({
                ...prev,
                currentPlaygroundId: id,
                createdAt,
            }));
            setHasLoadedFromStorage(true);
            created = true;
        }
        return { id, created };
    }, [state.currentPlaygroundId]);

    const getUserApiKeys = useCallback(async () => {
        if (user?.id) {
            return {};
        }
        try {
            return await getAllKeys();
        } catch (error) {
            console.error("Failed to get API keys:", error);
            return {};
        }
    }, [user?.id]);

	// Column management
    const addColumn = useCallback(() => {
        setState(prev => {
            const newId = `column-${Date.now()}-${prev.columns.length}`;
			const newColumn: ChatColumn = {
				id: newId,
                modelId: "openai/gpt-4o-mini",
				messages: [],
				input: "",
				synced: false,
				config: createDefaultConfig(),
				isStreaming: false,
			};
			return {
				...prev,
				columns: [...prev.columns, newColumn],
			};
		});
	}, []);

	const removeColumn = useCallback((columnId: string) => {
		setState(prev => ({
			...prev,
			columns: prev.columns.filter(col => col.id !== columnId),
		}));
	}, []);

	const updateColumn = useCallback((columnId: string, updates: Partial<ChatColumn>) => {
		setState(prev => ({
			...prev,
			columns: prev.columns.map(col =>
				col.id === columnId ? { ...col, ...updates } : col
			),
		}));
	}, []);

    const clearColumn = useCallback((columnId: string) => {
        // Abort any in-flight streaming for this specific column
        const controllers = inFlightControllersRef.current.get(columnId);
        if (controllers) {
            for (const c of controllers) {
                try { c.abort(); } catch {}
            }
            inFlightControllersRef.current.delete(columnId);
        }
        setState(prev => ({
            ...prev,
            columns: prev.columns.map(col =>
                col.id === columnId ? { ...col, messages: [], isStreaming: false } : col
            ),
        }));
    }, []);

    const moveColumnLeft = useCallback((columnId: string) => {
        setState(prev => {
            const index = prev.columns.findIndex(col => col.id === columnId);
            if (index <= 0) return prev;
            const newColumns = [...prev.columns];
            const leftIndex = index - 1;
            const current = newColumns[index];
            const left = newColumns[leftIndex];
            if (!current || !left) return prev;
            newColumns[leftIndex] = current;
            newColumns[index] = left;
            return { ...prev, columns: newColumns };
        });
    }, []);

    const moveColumnRight = useCallback((columnId: string) => {
        setState(prev => {
            const index = prev.columns.findIndex(col => col.id === columnId);
            if (index >= prev.columns.length - 1) return prev;
            const newColumns = [...prev.columns];
            const rightIndex = index + 1;
            const current = newColumns[index];
            const right = newColumns[rightIndex];
            if (!current || !right) return prev;
            newColumns[index] = right;
            newColumns[rightIndex] = current;
            return { ...prev, columns: newColumns };
        });
    }, []);

	// Sync management
    const toggleColumnSync = useCallback((columnId: string) => {
		setState(prev => ({
			...prev,
			columns: prev.columns.map(col =>
				col.id === columnId ? { ...col, synced: !col.synced } : col
			),
		}));
	}, []);

	const updateSharedInput = useCallback((input: string) => {
		setState(prev => ({ ...prev, sharedInput: input }));
	}, []);

	const updateColumnInput = useCallback((columnId: string, input: string) => {
		setState(prev => ({
			...prev,
			columns: prev.columns.map(col =>
				col.id === columnId ? { ...col, input } : col
			),
		}));
	}, []);

	// Helper function to update streaming status
    const setColumnStreaming = useCallback((columnId: string, isStreaming: boolean) => {
		setState(prev => ({
			...prev,
			columns: prev.columns.map(col =>
				col.id === columnId ? { ...col, isStreaming } : col
			),
		}));
	}, []);

	// Message sending
    const sendToColumn = useCallback(async (columnId: string, messageText: string) => {
		const column = state.columns.find(col => col.id === columnId);
		if (!column) return;

		try {
			// Set streaming status to true
			setColumnStreaming(columnId, true);

			const userApiKeys = await getUserApiKeys();
			const messageTimestamp = Date.now();

            // Create a saved playground id on first send and navigate
            const ensured = ensurePlaygroundId();

            // Ensure a Dexie playground record exists
            try {
                const pgRecord: DBPlayground = {
                    _id: ensured.id,
                    userId: currentUserId || "local_user",
                    name: `Playground (${new Date(ensured.created ? messageTimestamp : (state.createdAt || Date.now())).toLocaleTimeString()})`,
                    createdAt: state.createdAt || messageTimestamp,
                    columns: state.columns.map(c => ({ id: c.id, modelId: c.modelId })),
                };
                await db.playgrounds.put(pgRecord);
            } catch {}

			// Create user message
			const userMessage: PlaygroundMessage = {
				id: `user-${messageTimestamp}-${columnId}`,
				role: "user",
				content: messageText,
				parts: createTextParts(messageText),
				createdAt: new Date(),
				model: column.modelId,
			};

			// Add user message immediately
			updateColumn(columnId, {
				messages: [...column.messages, userMessage],
			});

            // Persist user message into playgroundMessages (Dexie)
            try {
                const dbMessage: DBPlaygroundMessage = {
                    _id: `pmsg-${messageTimestamp}-${Math.random()}`,
                    playgroundId: ensured.id,
                    columnId,
                    userId: currentUserId || "local_user",
                    role: "user",
                    content: messageText,
                    model: column.modelId,
                    createdAt: messageTimestamp,
                    _creationTime: messageTimestamp,
                };
                await db.playgroundMessages.put(dbMessage);
            } catch {}

            // Authenticated users: also persist playground + messages to Convex tables
            if (user?.id) {
                try {
                    // Create Convex playground record on first send per session
                    if (!state.parentChatId) {
                        const pgColumns = state.columns.map(c => ({ id: c.id, modelId: c.modelId }));
                        // @ts-expect-error: using string ref until codegen includes playground endpoints
                        const convexPlaygroundId = await convex.mutation("playground:createPlayground", {
                            userId: user.id,
                            name: `Playground ${new Date().toLocaleTimeString()}`,
                            columns: pgColumns,
                        });
                        setState(prev => ({ ...prev, parentChatId: convexPlaygroundId }));
                    }
                    if (state.parentChatId) {
                        // @ts-expect-error: using string ref until codegen includes playground endpoints
                        await convex.mutation("playground:addPlaygroundMessage", {
                            playgroundId: state.parentChatId as unknown as string,
                            columnId: columnId,
                            userId: user.id,
                            role: "user",
                            content: messageText,
                            model: column.modelId,
                        });
                    }
                } catch {}
            }

			// Prepare messages for API
			const messagesForAPI = [...column.messages, userMessage];

            // Make API call with abort support and track per column
            const controller = new AbortController();
            const setForColumn = inFlightControllersRef.current.get(columnId) ?? new Set<AbortController>();
            setForColumn.add(controller);
            inFlightControllersRef.current.set(columnId, setForColumn);
            const response = await fetch('/api/chat', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					messages: messagesForAPI,
					model: column.modelId,
					temperature: column.config.temperature,
					userApiKeys,
                }),
                signal: controller.signal,
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			// Handle streaming response
			const reader = response.body?.getReader();
			if (!reader) throw new Error('No reader available');

            const decoder = new TextDecoder();
            let assistantContent = '';
            let scheduled = false;
            let pendingContent = '';
			
			// Create assistant message
			const assistantMessage: PlaygroundMessage = {
				id: `assistant-${messageTimestamp}-${columnId}`,
				role: "assistant",
				content: '',
				parts: createTextParts(''),
				createdAt: new Date(),
				model: column.modelId,
			};

			// Add assistant message placeholder
			setState(prev => {
				const currentColumn = prev.columns.find(col => col.id === columnId);
				if (!currentColumn) return prev;
				
				return {
					...prev,
					columns: prev.columns.map(col =>
						col.id === columnId
							? {
								...col,
								messages: [...col.messages.filter(m => m.id !== assistantMessage.id), assistantMessage],
							}
							: col
					),
				};
			});

			// Read stream
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const chunk = decoder.decode(value, { stream: true });
				const lines = chunk.split('\n');
				
				for (const line of lines) {
					if (line.startsWith('data: ')) {
						try {
							const jsonStr = line.slice(6);
							if (jsonStr === '[DONE]') break;
							
							const data = JSON.parse(jsonStr);
							
                            if (data.type === 'text-delta' && data.delta) {
                                assistantContent += data.delta;
                                pendingContent = assistantContent;
                                if (!scheduled) {
                                    scheduled = true;
                                    requestAnimationFrame(() => {
                                        const content = pendingContent;
                                        scheduled = false;
                                        setState(prev => ({
                                            ...prev,
                                            columns: prev.columns.map(col =>
                                                col.id === columnId
                                                    ? {
                                                        ...col,
                                                        messages: col.messages.map(msg =>
                                                            msg.id === assistantMessage.id
                                                                ? {
                                                                    ...msg,
                                                                    content,
                                                                    parts: createTextParts(content)
                                                                }
                                                                : msg
                                                        )
                                                    }
                                                    : col
                                            ),
                                        }));
                                    });
                                }
                            }
                        } catch {
							// Ignore parse errors
						}
					}
				}
			}

            // Final flush to ensure the latest content is committed
            if (assistantContent) {
                setState(prev => ({
                    ...prev,
                    columns: prev.columns.map(col =>
                        col.id === columnId
                            ? {
                                ...col,
                                messages: col.messages.map(msg =>
                                    msg.id === assistantMessage.id
                                        ? {
                                            ...msg,
                                            content: assistantContent,
                                            parts: createTextParts(assistantContent)
                                        }
                                        : msg
                                )
                            }
                            : col
                    ),
                }));
            }

            // Set streaming status to false when done
            setColumnStreaming(columnId, false);
            // Remove controller from tracking
            try {
                const setForCol = inFlightControllersRef.current.get(columnId);
                if (setForCol) {
                    setForCol.delete(controller);
                    if (setForCol.size === 0) inFlightControllersRef.current.delete(columnId);
                }
            } catch {}

            // Persist assistant message after stream completes
            if (assistantContent) {
                try {
                    const ts = Date.now();
                    const dbMessage: DBPlaygroundMessage = {
                        _id: `pmsg-${ts}-${Math.random()}`,
                        playgroundId: ensured.id,
                        columnId: column.id,
                        userId: currentUserId || "local_user",
                        role: "assistant",
                        content: assistantContent,
                        model: column.modelId,
                        createdAt: ts,
                        _creationTime: ts,
                    };
                    await db.playgroundMessages.put(dbMessage);
                } catch {}
            }

            if (user?.id && state.parentChatId && assistantContent) {
                try {
                    // @ts-expect-error: using string ref until codegen includes playground endpoints
                    await convex.mutation("playground:addPlaygroundMessage", {
                        playgroundId: state.parentChatId as unknown as string,
                        columnId: column.id,
                        userId: user.id,
                        role: "assistant",
                        content: assistantContent,
                        model: column.modelId,
                    });
                } catch {}
            }

            // Navigate to the saved playground ID after streaming completes (avoid remount during stream)
            if (ensured.created) {
                try {
                    router.replace(`/playground/${ensured.id}`);
                } catch {}
            }

		} catch (error) {
			console.error(`Failed to send message to column ${columnId}:`, error);
			
			// Set streaming status to false on error
			setColumnStreaming(columnId, false);
			
			// Add error message
			const errorMessage: PlaygroundMessage = {
				id: `error-${Date.now()}-${columnId}`,
				role: "assistant",
				content: "Sorry, I encountered an error while processing your message. Please try again.",
				parts: createTextParts("Sorry, I encountered an error while processing your message. Please try again."),
				createdAt: new Date(),
				model: column.modelId,
			};

			setState(prev => {
				const currentColumn = prev.columns.find(col => col.id === columnId);
				if (!currentColumn) return prev;
				
				return {
					...prev,
					columns: prev.columns.map(col =>
						col.id === columnId
							? {
								...col,
								messages: [...col.messages, errorMessage],
							}
							: col
					),
				};
			});
		}
    }, [state.columns, getUserApiKeys, updateColumn, setColumnStreaming, user?.id, currentUserId, ensurePlaygroundId, router.replace, convex, state.parentChatId, state.createdAt]);

	const sendToSyncedColumns = useCallback(async (message: string) => {
		const syncedColumns = state.columns.filter(col => col.synced);
		
		if (syncedColumns.length === 0) return;

		console.log(`🚀 Sending to ${syncedColumns.length} synced columns in parallel`);

        // Create a saved playground id on first send and navigate
        const ensured = ensurePlaygroundId();

        // Set all synced columns to streaming
        for (const column of syncedColumns) {
            setColumnStreaming(column.id, true);
        }

		try {
			const userApiKeys = await getUserApiKeys();
			const messageTimestamp = Date.now();

			// 1. Add user messages to all synced columns immediately
			const userMessages = syncedColumns.map(column => ({
				column,
				userMessage: {
					id: `user-${messageTimestamp}-${column.id}`,
					role: "user" as const,
					content: message,
					parts: createTextParts(message),
					createdAt: new Date(),
					model: column.modelId,
				}
			}));

			// Add all user messages at once
			setState(prev => ({
				...prev,
				columns: prev.columns.map(col => {
					const syncedColumn = userMessages.find(um => um.column.id === col.id);
					if (syncedColumn) {
						return {
							...col,
							messages: [...col.messages, syncedColumn.userMessage],
						};
					}
					return col;
				}),
			}));

			// 2. Make parallel API calls for all models
			const apiPromises = userMessages.map(async ({ column, userMessage }) => {
				const messagesForAPI = [...column.messages, userMessage];
				
				// Create assistant message placeholder
				const assistantMessage = {
					id: `assistant-${messageTimestamp}-${column.id}`,
					role: "assistant" as const,
					content: '',
					parts: createTextParts(''),
					createdAt: new Date(),
					model: column.modelId,
				};

				try {
					// Add assistant placeholder
					setState(prev => ({
						...prev,
						columns: prev.columns.map(col =>
							col.id === column.id
								? {
									...col,
									messages: [...col.messages.filter(m => m.id !== assistantMessage.id), assistantMessage],
								}
								: col
						),
					}));

                    // Make API call with abort support and track per column
                    const controller = new AbortController();
                    const setForCol = inFlightControllersRef.current.get(column.id) ?? new Set<AbortController>();
                    setForCol.add(controller);
                    inFlightControllersRef.current.set(column.id, setForCol);
                    const response = await fetch('/api/chat', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							messages: messagesForAPI,
							model: column.modelId,
							temperature: column.config.temperature,
							userApiKeys,
                        }),
                        signal: controller.signal,
					});

					if (!response.ok) {
						throw new Error(`HTTP error! status: ${response.status}`);
					}

					// Handle streaming response
					const reader = response.body?.getReader();
					if (!reader) throw new Error('No reader available');

                    const decoder = new TextDecoder();
                    let assistantContent = '';
                    let scheduled = false;
                    let pendingContent = '';

					// Read stream
					while (true) {
						const { done, value } = await reader.read();
						if (done) break;

						const chunk = decoder.decode(value, { stream: true });
						const lines = chunk.split('\n');
						
						for (const line of lines) {
							if (line.startsWith('data: ')) {
								try {
									const jsonStr = line.slice(6);
									if (jsonStr === '[DONE]') break;
									
									const data = JSON.parse(jsonStr);
									
                                    if (data.type === 'text-delta' && data.delta) {
                                        assistantContent += data.delta;
                                        pendingContent = assistantContent;
                                        if (!scheduled) {
                                            scheduled = true;
                                            requestAnimationFrame(() => {
                                                const content = pendingContent;
                                                scheduled = false;
                                                setState(prev => ({
                                                    ...prev,
                                                    columns: prev.columns.map(col =>
                                                        col.id === column.id
                                                            ? {
                                                                ...col,
                                                                messages: col.messages.map(msg =>
                                                                    msg.id === assistantMessage.id
                                                                        ? {
                                                                            ...msg,
                                                                            content,
                                                                            parts: createTextParts(content)
                                                                        }
                                                                        : msg
                                                                )
                                                            }
                                                            : col
                                                    ),
                                                }));
                                            });
                                        }
                                    }
                                } catch {
									// Ignore parse errors
								}
							}
						}
					}

                    // Final flush to ensure the latest content is committed
                    if (assistantContent) {
                        setState(prev => ({
                            ...prev,
                            columns: prev.columns.map(col =>
                                col.id === column.id
                                    ? {
                                        ...col,
                                        messages: col.messages.map(msg =>
                                            msg.id === assistantMessage.id
                                                ? {
                                                    ...msg,
                                                    content: assistantContent,
                                                    parts: createTextParts(assistantContent)
                                                }
                                                : msg
                                        )
                                    }
                                    : col
                            ),
                        }));
                    }

                    // Remove controller from tracking
                    try {
                        const setForC = inFlightControllersRef.current.get(column.id);
                        if (setForC) {
                            setForC.delete(controller);
                            if (setForC.size === 0) inFlightControllersRef.current.delete(column.id);
                        }
                    } catch {}

                    return { columnId: column.id, success: true };

				} catch (error) {
					console.error(`Failed to send message to column ${column.id}:`, error);
					
					// Add error message for this specific column
					const errorMessage = {
						id: `error-${Date.now()}-${column.id}`,
						role: "assistant" as const,
						content: "Sorry, I encountered an error while processing your message. Please try again.",
						parts: createTextParts("Sorry, I encountered an error while processing your message. Please try again."),
						createdAt: new Date(),
						model: column.modelId,
					};

					setState(prev => ({
						...prev,
						columns: prev.columns.map(col =>
							col.id === column.id
								? {
									...col,
									messages: [...col.messages.filter(m => m.id !== assistantMessage.id), errorMessage],
								}
								: col
						),
					}));

					return { columnId: column.id, success: false, error };
				}
			});

			// Wait for all API calls to complete
            const results = await Promise.all(apiPromises);
			
			console.log(`✅ Completed ${results.length} parallel requests:`, results);

            // Set all synced columns streaming status to false
            for (const column of syncedColumns) {
                setColumnStreaming(column.id, false);
            }

		} catch (error) {
			console.error('Failed to send to synced columns:', error);
			
            // Set all synced columns streaming status to false on error
            for (const column of syncedColumns) {
                setColumnStreaming(column.id, false);
            }
		}
		
		// Clear shared input after sending
		updateSharedInput("");

        // Navigate to the saved playground ID after all streams complete
        if (ensured.created) {
            try {
                router.replace(`/playground/${ensured.id}`);
            } catch {}
        }
    }, [state.columns, getUserApiKeys, updateSharedInput, setColumnStreaming, ensurePlaygroundId, router.replace]);

	// Playground management
    const createNewPlayground = useCallback(() => {
        const newId = `playground-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const newState: PlaygroundState = {
            columns: [createDefaultColumn(), createDefaultColumn()],
            sharedInput: "",
            currentPlaygroundId: newId,
            createdAt: Date.now(),
        };
        setState(newState);
        savePlaygroundToStorage(newId, newState);
    }, []);

    const savePlayground = useCallback(async () => {
        if (state.currentPlaygroundId?.startsWith("playground-")) {
            savePlaygroundToStorage(state.currentPlaygroundId, state);
        }
    }, [state]);

	const loadPlayground = useCallback(async (targetPlaygroundId: string) => {
		const loaded = loadPlaygroundFromStorage(targetPlaygroundId);
		if (loaded) {
			setState(loaded);
		}
	}, []);

	return (
		<PlaygroundContext.Provider
			value={{
				// State
				columns: state.columns,
				sharedInput: state.sharedInput,
				playgroundId: state.currentPlaygroundId,
				
				// Column management
				addColumn,
				removeColumn,
				updateColumn,
				clearColumn,
				moveColumnLeft,
				moveColumnRight,
				
				// Sync management
				toggleColumnSync,
				updateSharedInput,
				updateColumnInput,
				
				// Message sending
				sendToColumn,
				sendToSyncedColumns,
				
				// Playground management
				createNewPlayground,
				savePlayground,
				loadPlayground,
			}}
		>
			{children}
		</PlaygroundContext.Provider>
	);
}
