export interface Wallet {
    address: string;
    privateKey: string;
    walletPath?: string;
}

export interface BotState {
    coin?: string;
    offerId?: number;
    action?: string;
    amount?: number;
    platformFee?: number;
    withdrawAmount?: number;
    page?: number;
}