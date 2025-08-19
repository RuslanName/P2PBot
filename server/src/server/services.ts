import jwt from 'jsonwebtoken';
import {PrismaClient} from '@prisma/client';
import {v4 as uuidv4} from 'uuid';
import {config} from '../config/env';
import {
    CreateOfferDto,
    CreateWarrantHolderDto,
    UpdateAmlVerificationDto,
    UpdateDealDto,
    UpdateOfferDto,
    UpdateSupportTicketDto,
    UpdateUserDto,
    UpdateWarrantHolderDto
} from '../types';
import {sendP2PTransaction} from "../wallet/transaction";
import {calculateReferralFee} from "../utils/calculateTransaction";

const prisma = new PrismaClient();

export async function login(username: string, password: string) {
    if (username === config.ADMIN_USERNAME && password === config.ADMIN_PASSWORD) {
        const token = jwt.sign({ role: 'admin' }, config.JWT_SECRET, { expiresIn: '1h' });
        return { token, role: 'admin' };
    }

    const warrantHolder = await prisma.warrantHolder.findFirst({
        where: {
            user: { username },
            password
        },
        include: { user: true }
    });

    if (!warrantHolder) {
        throw new Error('Invalid username or password');
    }

    if (warrantHolder.isBlocked) {
        throw new Error('Account is blocked');
    }

    const token = jwt.sign(
        { role: 'warrant-holder', id: warrantHolder.id },
        config.JWT_SECRET,
        { expiresIn: '1h' }
    );
    return { token, role: 'warrant-holder', id: warrantHolder.id };
}

export async function checkAuth(token: string | undefined) {
    if (!token) {
        return { isAuthenticated: false, role: '' };
    }

    try {
        const decoded = jwt.verify(token, config.JWT_SECRET) as { role: string; id?: number };

        if (decoded.role === 'warrant-holder' && decoded.id) {
            const warrantHolder = await prisma.warrantHolder.findUnique({
                where: { id: decoded.id }
            });

            if (warrantHolder?.isBlocked) {
                return { isAuthenticated: false, role: '' };
            }
        }

        return { isAuthenticated: true, role: decoded.role, id: decoded.id };
    } catch (error) {
        console.error('Authentication check error:', error);
        return { isAuthenticated: false, role: '' };
    }
}

export async function getUsers(page: number = 1, pageSize: number = 10) {
    const skip = (page - 1) * pageSize;
    const users = await prisma.user.findMany({
        skip,
        take: pageSize,
        include: {
            wallets: true,
            referrer: { select: { id: true, username: true, isBlocked: true } }
        }
    });

    const total = await prisma.user.count();

    return {
        data: await Promise.all(users.map(async (user) => {
            const wallets = await Promise.all(user.wallets.map(async (wallet) => ({
                ...wallet,
                heldAmount: await getHeldAmount(user.id, undefined, wallet.coin)
            })));
            return {
                ...user,
                referralLink: `https://t.me/${config.BOT_NAME}?start=${user.referralLinkId || user.id}`,
                referralCount: await prisma.user.count({ where: { referrerId: user.id } }),
                wallets,
            };
        })),
        total,
        page,
        pageSize
    };
}

export async function updateUser(id: number, data: UpdateUserDto) {
    const user = await prisma.user.findUnique({
        where: { id },
        include: {
            wallets: true,
            referrer: { select: { id: true, username: true, isBlocked: true } }
        }
    });

    if (!user) {
        const error = new Error('User not found');
        (error as any).status = 404;
        throw error;
    }

    const updateData: any = {};
    if (data.isBlocked !== undefined) {
        updateData.isBlocked = data.isBlocked;
        if (data.isBlocked) {
            await prisma.deal.updateMany({
                where: {
                    userId: id,
                    status: 'pending'
                },
                data: { status: 'blocked' }
            });
        } else {
            await prisma.deal.updateMany({
                where: {
                    userId: id,
                    status: 'blocked'
                },
                data: { status: 'pending' }
            });
        }
    }

    const updatedUser = await prisma.user.update({
        where: { id },
        data: updateData,
        include: {
            wallets: true,
            referrer: { select: { id: true, username: true, isBlocked: true } }
        }
    });

    const wallets = await Promise.all(updatedUser.wallets.map(async (wallet) => ({
        ...wallet,
        heldAmount: await getHeldAmount(updatedUser.id, undefined, wallet.coin)
    })));

    return {
        ...updatedUser,
        referralLink: `https://t.me/${config.BOT_NAME}?start=${updatedUser.referralLinkId || updatedUser.id}`,
        wallets,
    };
}

export async function getOffers(token: string, page: number = 1, pageSize: number = 10) {
    const decoded = jwt.verify(token, config.JWT_SECRET) as { role: string; id?: number };
    let offers;
    const skip = (page - 1) * pageSize;

    if (decoded.role === 'admin') {
        offers = await prisma.offer.findMany({
            skip,
            take: pageSize,
            include: {
                warrantHolder: true
            },
            orderBy: { createdAt: 'desc' }
        });
    } else {
        if (!decoded.id) throw new Error('User ID not found');
        const warrantHolder = await prisma.warrantHolder.findUnique({
            where: { id: decoded.id }
        });
        if (warrantHolder?.isBlocked) {
            const error = new Error('Account is blocked');
            (error as any).status = 403;
            throw error;
        }
        offers = await prisma.offer.findMany({
            where: { userId: decoded.id },
            skip,
            take: pageSize,
            include: {
                warrantHolder: true
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    const total = await prisma.offer.count({
        where: decoded.role === 'admin' ? {} : { userId: decoded.id }
    });

    return { data: offers, total, page, pageSize };
}

export async function createOffer(token: string, data: CreateOfferDto) {
    if (!data.type || !data.coin || !data.fiatCurrency?.length || !data.minDealAmount ||
        !data.maxDealAmount || data.markupPercent === undefined) {
        const error = new Error('All required fields must be provided');
        (error as any).status = 400;
        throw error;
    }

    if (!['buy', 'sell'].includes(data.type)) {
        const error = new Error('Invalid offer type. Must be "buy" or "sell"');
        (error as any).status = 400;
        throw error;
    }

    if (data.type === 'buy' && (!data.warrantHolderPaymentDetails?.length ||
        data.fiatCurrency.length !== data.warrantHolderPaymentDetails.length)) {
        const error = new Error('Number of payment details must match number of fiat currencies for buy offers');
        (error as any).status = 400;
        throw error;
    }

    if (data.type === 'sell' && data.warrantHolderPaymentDetails?.length) {
        const error = new Error('Payment details are not required for sell offers');
        (error as any).status = 400;
        throw error;
    }

    const decoded = jwt.verify(token, config.JWT_SECRET) as { role: string; id?: number };
    if (decoded.role !== 'warrant-holder' || !decoded.id) {
        const error = new Error('Only warrant holders can create offers');
        (error as any).status = 403;
        throw error;
    }

    const warrantHolder = await prisma.warrantHolder.findUnique({
        where: { id: decoded.id }
    });
    if (warrantHolder?.isBlocked) {
        const error = new Error('Account is blocked');
        (error as any).status = 403;
        throw error;
    }

    return prisma.offer.create({
        data: {
            type: data.type,
            coin: data.coin,
            fiatCurrency: data.fiatCurrency,
            minDealAmount: data.minDealAmount,
            maxDealAmount: data.maxDealAmount,
            markupPercent: data.markupPercent,
            warrantHolderPaymentDetails: data.type === 'buy' ? data.warrantHolderPaymentDetails : [],
            warrantHolder: {connect: {id: decoded.id}}
        },
        include: {warrantHolder: true}
    });
}

export async function updateOffer(token: string, id: number, data: UpdateOfferDto) {
    const decoded = jwt.verify(token, config.JWT_SECRET) as { role: string; id?: number };

    const offer = await prisma.offer.findUnique({
        where: { id },
        include: { warrantHolder: true }
    });

    if (!offer) {
        const error = new Error('Offer not found');
        (error as any).status = 404;
        throw error;
    }

    if (decoded.role !== 'admin' && offer.userId !== decoded.id) {
        const error = new Error('No permission to edit this offer');
        (error as any).status = 403;
        throw error;
    }

    if (decoded.role !== 'admin') {
        const warrantHolder = await prisma.warrantHolder.findUnique({
            where: { id: decoded.id }
        });
        if (warrantHolder?.isBlocked) {
            const error = new Error('Account is blocked');
            (error as any).status = 403;
            throw error;
        }
    }

    if (data.fiatCurrency && data.warrantHolderPaymentDetails && offer.type === 'buy' &&
        data.fiatCurrency.length !== data.warrantHolderPaymentDetails.length) {
        const error = new Error('Number of payment details must match number of fiat currencies for buy offers');
        (error as any).status = 400;
        throw error;
    }

    if (data.warrantHolderPaymentDetails && offer.type === 'sell') {
        const error = new Error('Payment details are not required for sell offers');
        (error as any).status = 400;
        throw error;
    }

    return prisma.offer.update({
        where: { id },
        data: {
            fiatCurrency: data.fiatCurrency,
            minDealAmount: data.minDealAmount,
            maxDealAmount: data.maxDealAmount,
            markupPercent: data.markupPercent,
            warrantHolderPaymentDetails: offer.type === 'buy' ? data.warrantHolderPaymentDetails : [],
            status: data.status
        },
        include: { warrantHolder: true }
    });
}

export async function getDeals(page: number = 1, pageSize: number = 10) {
    const skip = (page - 1) * pageSize;
    const deals = await prisma.deal.findMany({
        skip,
        take: pageSize,
        include: {
            client: {
                select: {
                    id: true,
                    username: true,
                    isBlocked: true,
                    referrer: {
                        select: {
                            id: true,
                            username: true,
                            isBlocked: true
                        }
                    }
                }
            },
            offer: {
                select: {
                    id: true,
                    type: true,
                    coin: true,
                    status: true,
                    warrantHolder: {
                        select: {
                            id: true,
                            isBlocked: true
                        }
                    }
                }
            }
        }
    });

    const total = await prisma.deal.count();

    return { data: deals, total, page, pageSize };
}

export async function getDealsFiltered(params: { userId?: number; warrantHolderId?: number; status?: string; offerType?: string }, page: number = 1, pageSize: number = 10) {
    const skip = (page - 1) * pageSize;
    const deals = await prisma.deal.findMany({
        where: {
            userId: params.userId,
            status: params.status,
            offer: {
                type: params.offerType,
                userId: params.warrantHolderId,
            },
        },
        skip,
        take: pageSize,
        include: {
            client: { select: { id: true, username: true, isBlocked: true } },
            offer: { select: { id: true, type: true, coin: true, status: true, userId: true } },
        },
    });

    const total = await prisma.deal.count({
        where: {
            userId: params.userId,
            status: params.status,
            offer: {
                type: params.offerType,
                userId: params.warrantHolderId,
            },
        }
    });

    return { data: deals, total, page, pageSize };
}

export async function updateDeal(dealId: number, data: UpdateDealDto = {}) {
    const validStatuses = ['open', 'pending', 'completed', 'closed', 'cancelled', 'blocked', 'expired'];
    if (data.status && !validStatuses.includes(data.status)) {
        const error = new Error('Invalid status value');
        (error as any).status = 400;
        throw error;
    }

    const deal = await prisma.deal.findUnique({
        where: { id: dealId },
        include: {
            client: { include: { referrer: true } },
            offer: { include: { warrantHolder: { include: { user: true } } } }
        }
    });

    if (!deal) {
        const error = new Error('Deal not found');
        (error as any).status = 404;
        throw error;
    }

    if (data.status === 'completed' && deal.status !== 'blocked') {
        const error = new Error('Only blocked deals can be completed');
        (error as any).status = 400;
        throw error;
    }

    if (data.status === 'completed' && deal.offer?.type === 'buy' && deal.clientConfirmed) {
        if (!deal.client?.chatId || !deal.offer?.warrantHolder?.user.chatId || !deal.clientPaymentDetails) {
            const error = new Error('Missing client or warrant holder data');
            (error as any).status = 400;
            throw error;
        }

        const txId = await sendP2PTransaction(
            deal.amount,
            deal.offer.coin,
            deal.offer.warrantHolder.user.id,
            deal.clientPaymentDetails,
            "buy"
        );

        if (!txId) {
            const error = new Error('Failed to process transaction');
            (error as any).status = 500;
            throw error;
        }

        const referralFee = deal.client?.referrer
            ? calculateReferralFee(deal.amount, "buy")
            : 0;

        return prisma.deal.update({
            where: { id: dealId },
            data: {
                status: 'completed',
                txId,
                ...(referralFee > 0 && deal.client?.referrer && {
                    referralFee,
                    referrer: { connect: { id: deal.client.referrer.id } }
                })
            },
            include: {
                client: { include: { referrer: true } },
                offer: { include: { warrantHolder: { include: { user: true } } } }
            }
        });
    } else if (data.status === 'completed' && (!deal.clientConfirmed || deal.offer?.type !== 'buy')) {
        const error = new Error('Deal cannot be completed: client confirmation missing or invalid offer type');
        (error as any).status = 400;
        throw error;
    }

    const newStatus = data.status || 'expired';
    return prisma.deal.update({
        where: { id: dealId },
        data: { status: newStatus },
        include: {
            client: { include: { referrer: true } },
            offer: { include: { warrantHolder: { include: { user: true } } } }
        }
    });
}

export async function getWarrantHolders(role: string, warrantHolderId?: number, page: number = 1, pageSize: number = 10) {
    const skip = (page - 1) * pageSize;
    const warrantHolders = await prisma.warrantHolder.findMany({
        where: role === 'admin' ? {} : { id: warrantHolderId },
        skip,
        take: pageSize,
        include: {
            user: {
                select: {
                    id: true,
                    username: true,
                    wallets: true,
                }
            },
            offers: {
                select: {
                    id: true,
                    type: true,
                    coin: true,
                    status: true,
                }
            }
        }
    });

    const total = await prisma.warrantHolder.count({
        where: role === 'admin' ? {} : { id: warrantHolderId }
    });

    return {
        data: await Promise.all(warrantHolders.map(async (holder) => {
            const wallets = await Promise.all(holder.user.wallets.map(async (wallet) => ({
                ...wallet,
                heldAmount: await getHeldAmount(
                    holder.user.id,
                    role === 'admin' ? holder.id : undefined,
                    wallet.coin
                )
            })));
            return {
                ...holder,
                username: holder.user.username,
                wallets,
            };
        })),
        total,
        page,
        pageSize
    };
}

export async function createWarrantHolder(data: CreateWarrantHolderDto) {
    if (!data.username && !data.chatId) {
        const error = new Error('Either username or chatId is required');
        (error as any).status = 400;
        throw error;
    }

    let user = await prisma.user.findFirst({
        where: {
            OR: [
                data.username ? { username: data.username } : {},
                data.chatId ? { chatId: data.chatId } : {}
            ].filter(Boolean)
        }
    });

    if (!user) {
        const error = new Error('User not found');
        (error as any).status = 404;
        throw error;
    }

    const existingHolder = await prisma.warrantHolder.findUnique({
        where: { userId: user.id }
    });
    if (existingHolder) {
        const error = new Error('User is already a warrant holder');
        (error as any).status = 400;
        throw error;
    }

    const warrantHolder = await prisma.warrantHolder.create({
        data: {
            user: {connect: {id: user.id }},
            isBlocked: false,
            password: uuidv4(),
        },
        include: { user: { select: { id: true, username: true, wallets: true } } }
    });

    const wallets = await Promise.all(warrantHolder.user.wallets.map(async (wallet) => ({
        ...wallet,
        heldAmount: await getHeldAmount(warrantHolder.user.id, warrantHolder.id, wallet.coin)
    })));

    return {
        ...warrantHolder,
        username: warrantHolder.user.username,
        wallets,
    };
}

export async function updateWarrantHolder(id: number, data: UpdateWarrantHolderDto) {
    const warrantHolder = await prisma.warrantHolder.findUnique({
        where: { id },
        include: {
            user: { select: { id: true, username: true, wallets: true } },
            offers: { select: { id: true, status: true } }
        }
    });

    if (!warrantHolder) {
        const error = new Error('Warrant holder not found');
        (error as any).status = 404;
        throw error;
    }

    if (warrantHolder.isBlocked && data.password) {
        const error = new Error('Cannot update password for blocked account');
        (error as any).status = 403;
        throw error;
    }

    const updateData: any = {};
    if (data.password === true) {
        updateData.password = uuidv4();
    }
    if (data.isBlocked !== undefined) {
        updateData.isBlocked = data.isBlocked;

        await prisma.user.update({
            where: { id: warrantHolder.userId },
            data: { isBlocked: data.isBlocked }
        });

        if (data.isBlocked) {
            await prisma.deal.updateMany({
                where: {
                    userId: warrantHolder.userId,
                    status: 'pending'
                },
                data: { status: 'blocked' }
            });
            await prisma.offer.updateMany({
                where: {
                    userId: warrantHolder.userId,
                    status: 'open'
                },
                data: { status: 'blocked' }
            });
        } else {
            await prisma.deal.updateMany({
                where: {
                    userId: warrantHolder.userId,
                    status: 'blocked'
                },
                data: { status: 'pending' }
            });
            await prisma.offer.updateMany({
                where: {
                    userId: warrantHolder.userId,
                    status: 'blocked'
                },
                data: { status: 'open' }
            });
        }
    }

    const updatedWarrantHolder = await prisma.warrantHolder.update({
        where: { id },
        data: updateData,
        include: { user: { select: { id: true, username: true, wallets: true } } }
    });

    const wallets = await Promise.all(updatedWarrantHolder.user.wallets.map(async (wallet) => ({
        ...wallet,
        heldAmount: await getHeldAmount(updatedWarrantHolder.user.id, updatedWarrantHolder.id, wallet.coin)
    })));

    return {
        ...updatedWarrantHolder,
        username: updatedWarrantHolder.user.username,
        wallets,
    };
}

export async function getSupportTickets(page: number = 1, pageSize: number = 10) {
    const skip = (page - 1) * pageSize;
    const tickets = await prisma.supportTicket.findMany({
        skip,
        take: pageSize,
        include: {
            user: {select: {id: true, username: true, isBlocked: true}}
        },
        orderBy: {createdAt: 'desc'}
    });

    const total = await prisma.supportTicket.count();

    return { data: tickets, total, page, pageSize };
}

export async function updateSupportTicket(id: number, data: UpdateSupportTicketDto) {
    const ticket = await prisma.supportTicket.findUnique({
        where: { id },
        include: { user: { select: { id: true, username: true, isBlocked: true } } }
    });

    if (!ticket) {
        const error = new Error('Support ticket not found');
        (error as any).status = 404;
        throw error;
    }

    return prisma.supportTicket.update({
        where: {id},
        data: {status: data.status},
        include: {user: {select: {id: true, username: true, isBlocked: true}}}
    });
}

export async function getAmlVerifications(page: number = 1, pageSize: number = 10) {
    const skip = (page - 1) * pageSize;
    const verifications = await prisma.amlVerification.findMany({
        skip,
        take: pageSize,
        include: {
            user: {select: {id: true, username: true, isBlocked: true}}
        },
        orderBy: {createdAt: 'desc'}
    });

    const total = await prisma.amlVerification.count();

    return { data: verifications, total, page, pageSize };
}

export async function updateAmlVerification(id: number, data: UpdateAmlVerificationDto) {
    const verification = await prisma.amlVerification.findUnique({
        where: { id },
        include: { user: { select: { id: true, username: true, isBlocked: true } } }
    });

    if (!verification) {
        const error = new Error('AML verification not found');
        (error as any).status = 404;
        throw error;
    }

    return prisma.amlVerification.update({
        where: {id},
        data: {status: data.status},
        include: {user: {select: {id: true, username: true, isBlocked: true}}}
    });
}

export async function getHeldAmount(userId: number, warrantHolderId?: number, coin?: string) {
    let heldAmount = 0;

    const clientPendingDeals = await prisma.deal.findMany({
        where: {
            userId,
            status: 'pending',
            offer: { type: 'sell' },
            ...(coin ? { offer: { coin } } : {})
        },
    });
    heldAmount += clientPendingDeals.reduce(
        (sum, deal) => sum + deal.amount * (1 + deal.markupPercent / 100),
        0
    );

    if (warrantHolderId) {
        const warrantHolderPendingDeals = await prisma.deal.findMany({
            where: {
                status: 'pending',
                offer: {
                    type: 'buy',
                    userId: warrantHolderId,
                    ...(coin ? { coin } : {})
                }
            },
        });
        heldAmount += warrantHolderPendingDeals.reduce(
            (sum, deal) => sum + deal.amount * (1 + deal.markupPercent / 100),
            0
        );
    }

    return heldAmount;
}