import { BotState } from '../types';

const stateStore: { [key: string]: BotState } = {};

export async function getState(userId: string): Promise<BotState> {
    if (!stateStore[userId]) {
        stateStore[userId] = {};
    }
    return stateStore[userId];
}

export async function setState(userId: string, state: Partial<BotState>): Promise<void> {
    stateStore[userId] = { ...stateStore[userId], ...state };
}

export async function clearState(userId: string): Promise<void> {
    delete stateStore[userId];
}
