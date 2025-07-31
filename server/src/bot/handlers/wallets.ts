import { Telegraf, Markup } from 'telegraf';
import { PrismaClient } from '@prisma/client';
import { BotContext } from '../bot';
import { getWalletBalance } from '../../wallet/balance';

const prisma = new PrismaClient();

export function handleWallets(bot: Telegraf<BotContext>) {
    bot.hears('Кошельки', async (ctx) => {
        console.log("+")
        if (!ctx.from?.id) return;
        const userId = ctx.from.id.toString();
        const user = await prisma.user.findUnique({
            where: { chatId: userId },
            include: { wallets: true }
        });
        if (!user) return;

        for (const wallet of user.wallets) {
            const { confirmed, unconfirmed } = await getWalletBalance(wallet.address, wallet.coin, userId);
            await prisma.wallet.update({
                where: { id: wallet.id },
                data: { balance: confirmed, unconfirmedBalance: unconfirmed }
            });
        }

        const updatedUser = await prisma.user.findUnique({
            where: { chatId: userId },
            include: { wallets: true }
        });

        if (!updatedUser) return;

        const walletInfo = await Promise.all(updatedUser.wallets.map(async (wallet) => {
            const pendingTransactions = await prisma.transaction.findMany({
                where: {
                    userId: updatedUser.id,
                    coin: wallet.coin,
                    status: 'pending',
                    type: 'buy'
                },
                select: { amount: true }
            });
            const heldAmount = pendingTransactions.reduce((sum, tx) => sum + tx.amount, 0);

            const pendingAmount = wallet.unconfirmedBalance || 0;

            let balanceText = `${wallet.coin} - кошелёк\nАдрес: ${wallet.address}\nБаланс: ${wallet.balance} ${wallet.coin}`;

            const statusParts = [];
            if (pendingAmount > 0) {
                statusParts.push(`на обработке: ${pendingAmount}`);
            }
            if (heldAmount > 0) {
                statusParts.push(`на удержании: ${heldAmount}`);
            }
            if (statusParts.length > 0) {
                balanceText += ` (${statusParts.join(', ')})`;
            }

            return balanceText;
        }));

        await ctx.reply(walletInfo.join('\n\n'));
    });
}