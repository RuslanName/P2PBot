export interface BotState {
    offerId?: number;
    dealId?: number;
    action?: string;
    coin?: string;
    fiatCurrency?: string;
    amount?: number;
    withdrawAmount?: number;
    page?: number;
    paymentDetails?: string;
}

export interface CreateOfferDto {
    type: string;
    coin: string;
    fiatCurrency: string[];
    minDealAmount: number;
    maxDealAmount: number;
    markupPercent: number;
    warrantHolderPaymentDetails: string;
}

export interface UpdateOfferDto {
    fiatCurrency?: string[];
    minDealAmount?: number;
    maxDealAmount?: number;
    markupPercent?: number;
    warrantHolderPaymentDetails?: string;
    status?: string;
}

export interface CreateWarrantHolderDto {
    username?: string;
    chatId?: string;
}

export interface UpdateWarrantHolderDto {
    password?: boolean;
    isBlocked?: boolean;
}

export interface UpdateUserDto {
    isBlocked?: boolean;
}