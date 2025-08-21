import { type Dispatch, type ReactNode, type SetStateAction } from "react";

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

export interface SupportTicket {
    id: number;
    user: UserShort;
    reason: string;
    description: string;
    imagesPath: string[];
    status: string;
    createdAt: string;
}

export interface AmlVerification {
    id: number;
    user: UserShort;
    reason: string;
    verificationImagesPath: string[];
    status: string;
    createdAt: string;
}

export interface TooltipProps {
    content: ReactNode;
    children: ReactNode;
}

export interface SidebarProps {
    activeTab: 'users' | 'offers' | 'deals' | 'warrant-holders' | 'support-tickets' | 'aml-verifications';
    setActiveTab: (tab: 'users' | 'offers' | 'deals' | 'warrant-holders' | 'support-tickets' | 'aml-verifications') => void;
    role: string;
}

export interface UsersTableBodyProps {
    users: User[];
    role: string;
    setUsers: Dispatch<SetStateAction<User[]>>;
    setError: Dispatch<SetStateAction<string | null>>;
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

export interface CreateWarrantHolderFormProps {
    onSubmit: (input: string) => void;
    setError: (error: string | null) => void;
}

export interface WarrantHoldersTableBodyProps {
    warrantHolders: WarrantHolder[];
    role: string;
    setWarrantHolders: Dispatch<SetStateAction<WarrantHolder[]>>;
}

export interface SupportTicketsTableBodyProps {
    tickets: SupportTicket[];
    role: string;
    statusFilter: string;
    onComplete: (id: number) => void;
}

export interface AmlVerificationsTableBodyProps {
    verifications: AmlVerification[];
    role: string;
    statusFilter: string;
    onApprove: (id: number) => void;
    onReject: (id: number) => void;
}

export interface SearchFilterProps {
    filterFields: FilterField[];
    onSearch: (params: SearchFilterParams) => void;
}

export interface TableWrapperProps<T> {
    items: T[];
    fetchItems: (page: number, append?: boolean, query?: Record<string, any>) => Promise<void>;
    renderTableBody: (items: T[], isMobile: boolean) => ReactNode;
    loading: boolean;
    error: string;
    hasMore: boolean;
    pageSize?: number;
    searchParams?: Record<string, any>;
}

export interface FilterField {
    field: string;
    label: string;
    type: 'select' | 'dateRange' | 'text';
    options?: { value: string; label: string }[];
}

export interface SearchFilterParams {
    search?: string;
    status?: string;
    isBlocked?: boolean;
    type?: string;
    fiatCurrency?: string;
    createdAtStart?: string;
    createdAtEnd?: string;
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