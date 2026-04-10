import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '@/lib/axiosInstance';
import { Message, MessageType } from '@/lib/types';
import { useUserStore } from './user';
 
interface MessagesState {
    messages: Message[];
    currentChatId: string | null;
    sidebarRefreshKey: number;
    setMessages: (messages: Message[]) => void;
    addMessage: (message: Message) => void;
    clearMessages: () => void;
    startNewChat: () => Promise<void>;
    setCurrentChatId: (chatId: string | null) => void;
    saveMessage: (message: Message, response: any) => Promise<void>;
    createNewChat: (message: Message) => Promise<string>;
    loadChatHistory: (chatId: string) => Promise<void>;
}
 
export const useMessagesStore = create<MessagesState>()(
    persist(
        (set, get) => ({
            messages: [],
            currentChatId: null,
            sidebarRefreshKey: 0,
            setMessages: (messages) => set({ messages }),
            addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
            clearMessages: () => set({ messages: [], currentChatId: null }),
            startNewChat: async () => {
                const { messages, currentChatId, sidebarRefreshKey } = get();
                if (messages.length > 0 && currentChatId) {
                    try {
                        let currentUser = useUserStore.getState().user;
                        if (!currentUser?.id) {
                            currentUser = { id: 1, email: 'demo@example.com' };
                        }
                        await api.post('/chat/refresh_session_title', {
                            user_id: currentUser.id,
                            chat_id: currentChatId,
                        });
                    } catch (e) {
                        console.warn('refresh_session_title failed:', e);
                    }
                }
                set({
                    messages: [],
                    currentChatId: null,
                    sidebarRefreshKey: sidebarRefreshKey + 1,
                });
            },
            setCurrentChatId: (chatId) => set({ currentChatId: chatId }),
 
            saveMessage: async (message, response) => {
                const { currentChatId } = get();
                if (!currentChatId) return;

                try {
                    let currentUser = useUserStore.getState().user; // Get current user
                    if (!currentUser || !currentUser.id) {
                        console.warn('User ID not available for saving message. Using demo user id=1.');
                        currentUser = { id: 1, email: 'demo@example.com' };
                        useUserStore.getState().update(currentUser);
                    }
                    const responseGraphPayload =
                        response?.chartData != null
                            ? JSON.stringify(response.chartData)
                            : response?.tableData != null
                              ? JSON.stringify({
                                    columns: response.tableData.columns,
                                    rows: response.tableData.rows,
                                })
                              : null;

                    await api.post('/chat/save_message', {
                        user_id: currentUser.id,
                        chat_id: currentChatId,
                        question: message.content,
                        response: response?.content ?? '',
                        response_graph: responseGraphPayload,
                        graph_type:
                            response?.type != null
                                ? String(response.type).toLowerCase()
                                : MessageType.TEXT,
                        insightful_questions:
                            Array.isArray(response.insightful_questions) && response.insightful_questions.length > 0
                                ? JSON.stringify(response.insightful_questions)
                                : typeof response.insightful_questions === 'string' && response.insightful_questions.trim() !== ''
                                  ? JSON.stringify([response.insightful_questions])
                                  : null
                    });
                } catch (error) {
                    console.error('Error saving message:', error);
                    // Do not throw; chat flow should continue even if saving fails.
                }
            },

            createNewChat: async (message) => {
                try {
                    let currentUser = useUserStore.getState().user;
                    if (!currentUser || !currentUser.id) {
                        console.warn('User ID not available for creating new chat. Falling back to demo user id=1.');
                        currentUser = { id: 1, email: 'demo@example.com' };
                        useUserStore.getState().update(currentUser);
                    }

                    // If backend chat session creation fails or is unavailable, fallback to local session ID.
                    try {
                        const response = await api.post('/chat/create_chat', {
                            user_id: currentUser.id,
                            initial_message_content: message.content,
                        });

                        if (response?.data?.chat_id) {
                            const chatId = response.data.chat_id;
                            set({ currentChatId: chatId });
                            return chatId;
                        }
                    } catch (error) {
                        console.warn('Falling back to local chat session creation due to backend error:', error);
                    }

                    const localChatId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                    set({ currentChatId: localChatId });
                    return localChatId;
                } catch (error) {
                    console.error('Error creating new chat:', error);
                    throw error;
                }
            },
 
            loadChatHistory: async (chatId: string) => {
                try {
                    const currentUser = useUserStore.getState().user; // Get current user
                    if (!currentUser || !currentUser.id) {
                        console.error('User ID not available for loading chat history.');
                        set({ messages: [], currentChatId: null });
                        throw new Error('User ID not found');
                    }
                    const apiCallResponse = await api.get(`/chat/get_chat/${chatId}?user_id=${currentUser.id}`);
                    console.log('Chat history API response:', apiCallResponse.data);
 
                    // Ensure conversation_history exists and is an array
                    const conversationHistory = apiCallResponse.data?.conversation_history;
                    if (!Array.isArray(conversationHistory)) {
                        console.error('Invalid conversation history format:', conversationHistory);
                        set({ messages: [], currentChatId: chatId }); // Reset messages or handle error appropriately
                        return;
                    }
 
                    const loadedMessages: Message[] = [];
                    conversationHistory.forEach((item: any, idx: number) => {
                        let chartData = null;
                        let tableData = null;
                        if (item.response_graph) {
                            try {
                                const parsed =
                                    typeof item.response_graph === "string"
                                        ? JSON.parse(item.response_graph)
                                        : item.response_graph;
                                if (parsed && Array.isArray(parsed.columns) && Array.isArray(parsed.rows)) {
                                    tableData = {
                                        columns: parsed.columns,
                                        rows: parsed.rows,
                                    };
                                } else {
                                    chartData = parsed;
                                }
                            } catch {
                                chartData = null;
                            }
                        }
                        if (item.graph_type === "data-table" && !tableData && item.response_graph) {
                            try {
                                const parsed =
                                    typeof item.response_graph === "string"
                                        ? JSON.parse(item.response_graph)
                                        : item.response_graph;
                                if (parsed?.columns && parsed?.rows) {
                                    tableData = { columns: parsed.columns, rows: parsed.rows };
                                    chartData = null;
                                }
                            } catch {
                                /* ignore */
                            }
                        }
 
                        // Ensure insightful_questions is always an array
                        let insightfulQuestions: string[] = [];
                        if (Array.isArray(item.insightful_questions)) {
                            insightfulQuestions = item.insightful_questions;
                        } else if (typeof item.insightful_questions === "string" && item.insightful_questions.trim() !== "") {
                            // Try to split numbered list (e.g., "1. ...\n2. ...")
                            insightfulQuestions = item.insightful_questions
                                .split(/\n\d+\.\s*/)
                                .map(q => q.trim())
                                .filter(q => q && !q.toLowerCase().includes("insightful questions"));
                        }
 
                        // User Message
                        loadedMessages.push({
                            id: (item.id || item.message_id || idx) + '_user',
                            content: item.question,
                            type: MessageType.TEXT,
                            role: 'user',
                            timestamp: new Date(item.timestamp),
                        });
 
                        const graphTypeKey = item.graph_type
                            ? (item.graph_type.toUpperCase().replace('-', '_') as keyof typeof MessageType)
                            : null;
                        const resolvedType =
                            tableData != null
                                ? MessageType.DATA_TABLE
                                : graphTypeKey && MessageType[graphTypeKey] != null
                                  ? MessageType[graphTypeKey]
                                  : MessageType.TEXT;

                        loadedMessages.push({
                            id: (item.id || item.message_id || idx) + '_assistant',
                            content: item.response || "",
                            type: resolvedType,
                            role: 'assistant',
                            timestamp: new Date(item.timestamp),
                            chartData: tableData ? undefined : chartData,
                            tableData: tableData || undefined,
                            chartType: item.graph_type || undefined,
                            chartTitle: '',
                            insightful_questions: insightfulQuestions,
                            response: item.response || "",
                        });
                    });
 
                    // Sort messages by timestamp just in case
                    loadedMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
 
                    set({ messages: loadedMessages, currentChatId: chatId });
                } catch (error) {
                    console.error('Error loading chat history:', error);
                    set({ messages: [], currentChatId: null });
                    throw error;
                }
            },
        }),
        {
            name: 'messages-storage',
        }
    )
);