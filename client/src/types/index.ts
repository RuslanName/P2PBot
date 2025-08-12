import type {Dispatch, SetStateAction} from "react";

export interface User {
    id: number;
    chatId: string;
    username: string;
    firstName: string;
    lastName: string;
    fiatCurrency: string;
    referralLink: string;
    referrer?: UserShort;
    referralCount: number;
    wallets: Wallet[];
    isBlocked: boolean;
}

interface Wallet {
    id: number;
    coin: string;
    address: string;
    balance: number;
    unconfirmedBalance: number;
    heldAmount: number;
}

export interface WarrantHolder {
    id: number;
    user: User;
    offers: OfferShort[];
    password: string;
    wallets: Wallet[];
    isBlocked: boolean;
}

export interface Offer {
    id: number;
    type: string;
    coin: string;
    fiatCurrency: string[];
    minDealAmount: number;
    maxDealAmount: number;
    markupPercent: number;
    warrantHolderPaymentDetails: string[];
    warrantHolder: WarrantHolderShort;
    status: string;
    userId: number;
    createdAt: string;
}

export interface Deal {
    id: number;
    client?: {
        id: number;
        username: string;
        isBlocked: boolean;
        referrer?: UserShort;
    };
    offer?: {
        id: number;
        type: string;
        coin: string;
        status: string;
        warrantHolder?: WarrantHolderShort;
    };
    amount: number;
    fiatCurrency: string;
    markupPercent: number;
    clientPaymentDetails?: string;
    txId?: string;
    clientConfirmed: boolean;
    status: string;
    createdAt: string;
}

export interface TooltipProps {
    content: string;
    children: React.ReactNode;
}

export interface SidebarProps {
    activeTab: 'users' | 'offers' | 'deals' | 'warrant-holders';
    setActiveTab: (tab: 'users' | 'offers' | 'deals' | 'warrant-holders') => void;
    role: string;
}

export interface UsersTableBodyProps {
    users: User[];
    role: string;
    setUsers: Dispatch<SetStateAction<User[]>>;
    setError: Dispatch<SetStateAction<string | null>>;
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

export interface CreateOfferFormProps {
    onSubmit: (newOffer: {
        type: string;
        coin: string;
        fiatCurrency: string[];
        minDealAmount: number;
        maxDealAmount: number;
        markupPercent: number;
        warrantHolderPaymentDetails: string[];
    }) => void;
}

export interface OffersTableBodyProps {
    offers: Offer[];
    role: string;
    onUpdate: (id: number, updateData: Partial<Offer>) => void;
    onClose: (id: number) => void;
    statusFilter: string;
}

export interface DealsTableBodyProps {
    deals: Deal[];
    role: string;
    statusFilter: string;
    onComplete: (id: number) => void;
}

export interface WarrantHoldersTableBodyProps {
    warrantHolders: WarrantHolder[];
    role: string;
    setWarrantHolders: Dispatch<SetStateAction<WarrantHolder[]>>;
}

interface UserShort {
    id: number;
    username: string;
    isBlocked: boolean;
}

interface WarrantHolderShort {
    id: number;
    isBlocked: boolean;
}

interface OfferShort {
    id: number;
    type: string;
    coin: string;
    status: string;
}