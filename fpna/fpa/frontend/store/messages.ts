import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '@/lib/axiosInstance';
import { Message, MessageType } from '@/lib/types';
 
interface MessagesState {
    messages: Message[];
    currentChatId: string | null;
    setMessages: (messages: Message[]) => void;
    addMessage: (message: Message) => void;
    clearMessages: () => void;
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
            setMessages: (messages) => set({ messages }),
            addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
            clearMessages: () => set({ messages: [], currentChatId: null }),
            setCurrentChatId: (chatId) => set({ currentChatId: chatId }),
 
            saveMessage: async (message, response) => {
                const { currentChatId } = get();
                if (!currentChatId) return;
 
                try {
                    await api.post('/chat/save_message', {
                        chat_id: currentChatId,
                        question: message.content,
                        response: response.content,
                        response_graph: response.chartData ? JSON.stringify(response.chartData) : null,
                        graph_type: response.type.toLowerCase(),
                        insightful_questions: Array.isArray(response.insightful_questions) && response.insightful_questions.length > 0
                            ? JSON.stringify(response.insightful_questions)
                            : null
                    });
                } catch (error) {
                    console.error('Error saving message:', error);
                    throw error;
                }
            },
 
            createNewChat: async (message) => {
                try {
                    const response = await api.post('/chat/create_chat', {
                        initial_message_content: message.content
                    });
 
                    if (response?.data?.chat_id) {
                        const chatId = response.data.chat_id;
                        set({ currentChatId: chatId });
                        return chatId;
                    } else {
                        console.error('Invalid response format from create_chat endpoint:', response);
                        throw new Error('Invalid response from server');
                    }
                } catch (error) {
                    console.error('Error creating new chat:', error);
                    throw error;
                }
            },
 
            loadChatHistory: async (chatId: string) => {
                try {
                    const apiCallResponse = await api.get(`/chat/get_chat/${chatId}`);
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
                        // Parse chartData from response_graph if it's a stringified JSON
                        let chartData = null;
                        if (item.response_graph) {
                            try {
                                chartData = typeof item.response_graph === "string"
                                    ? JSON.parse(item.response_graph)
                                    : item.response_graph;
                            } catch {
                                chartData = null;
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
 
                        // Assistant Message
                        loadedMessages.push({
                            id: (item.id || item.message_id || idx) + '_assistant',
                            content: item.response || "",
                            type: item.graph_type
                                ? MessageType[item.graph_type.toUpperCase().replace('-', '_') as keyof typeof MessageType]
                                : MessageType.TEXT,
                            role: 'assistant',
                            timestamp: new Date(item.timestamp),
                            chartData,
                            chartType: item.graph_type || undefined,
                            chartTitle: '', // Set if you have a title
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