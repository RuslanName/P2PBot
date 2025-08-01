import { BotState } from '../types';

const stateStore: { [key: string]: any } = {};

export async function getState(userId: string): Promise<BotState> {
    if (!stateStore[userId]) {
        stateStore[userId] = {};
    }
    return stateStore[userId];
}

export async function setState(userId: string, state: Partial<BotState>): Promise<void> {
    if (!stateStore[userId]) {
        stateStore[userId] = {};
    }
    stateStore[userId] = { ...stateStore[userId], ...state };
}

export async function clearState(userId: string): Promise<void> {
    if (stateStore[userId]) {
        delete stateStore[userId];
    }
}