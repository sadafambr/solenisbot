import { create } from "zustand";
import { persist } from 'zustand/middleware'

interface UserStore {
    user: any | null;
    update: (user: any | null) => void;
    // Optionally, you can still have a logout helper:
    logout: () => void;
    getToken: () => string | undefined;

}

const defaultDemoUser = {
    id: 1,
    email: "demo@example.com",
    first_name: "Demo",
    last_name: "User",
    token: "demo-token",
    refToken: "demo-refresh-token",
};

export const useUserStore = create<UserStore>()(
    persist(
        (set, get) => ({
            user: defaultDemoUser,
            update: (user: any | null) => set(() => ({ user })),
            logout: () => set({ user: null }),
            getToken: () => get().user?.token,
        }),
        {
            name: "user-storage", // Unique name for localStorage key
        }
    )
);