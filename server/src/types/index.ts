export interface BotState {
    action?: string;
    captcha?: {
        correctAnswer: number;
        attempts: number;
        maxAttempts: number;
    };
    startPayload?: string;
    offerId?: number;
    dealId?: number;
    page?: number;
    coin?: string;
    fiatCurrency?: string;
    amount?: number;
    paymentDetails?: string;
    withdrawAmount?: number;
    support?: {
        category?: string;
        subCategory?: string;
        description?: string;
        images?: string[];
        ticketId?: number;
    };
    amlVerificationId?: number;
}

export interface CreateOfferDto {
    type: string;
    coin: string;
    fiatCurrency: string[];
    minDealAmount: number;
    maxDealAmount: number;
    markupPercent: number;
    warrantHolderPaymentDetails: string[];
}

export interface UpdateOfferDto {
    fiatCurrency?: string[];
    minDealAmount?: number;
    maxDealAmount?: number;
    markupPercent?: number;
    warrantHolderPaymentDetails?: string[];
    status?: string;
}

export interface UpdateDealDto {
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

export interface UpdateSupportTicketDto {
    status?: string;
}

export interface UpdateAmlVerificationDto {
    status?: string;
}