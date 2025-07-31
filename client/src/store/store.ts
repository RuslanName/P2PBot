import { create } from 'zustand';
import axios from 'axios';

interface Store {
    isAuthenticated: boolean;
    role: string;
    userId?: number;
    login: (username: string, password: string) => Promise<boolean>;
    logout: () => Promise<void>;
    initializeAuth: () => Promise<void>;
}

export const useStore = create<Store>((set) => ({
    isAuthenticated: false,
    role: '',
    userId: undefined,
    login: async (username: string, password: string) => {
        try {
            const response = await axios.post('/api/login', { username, password });
            set({
                isAuthenticated: response.data.success,
                role: response.data.role,
                userId: response.data.id
            });
            return response.data.success;
        } catch (error) {
            console.error('Authorization error:', error);
            return false;
        }
    },
    logout: async () => {
        try {
            await axios.post('/api/logout');
        } finally {
            set({ isAuthenticated: false, role: '', userId: undefined });
        }
    },
    initializeAuth: async () => {
        try {
            const response = await axios.get('/api/check-auth');
            set({
                isAuthenticated: response.data.isAuthenticated,
                role: response.data.role || 'warrant-holder',
                userId: response.data.id
            });
        } catch (error) {
            console.error('Auth check failed:', error);
            set({ isAuthenticated: false, role: '', userId: undefined });
        }
    }
}));