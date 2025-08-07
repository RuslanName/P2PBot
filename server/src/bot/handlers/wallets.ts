import { Telegraf } from 'telegraf';
import { PrismaClient } from '@prisma/client';
import { BotContext } from '../bot';
import { getWalletBalance } from '../../wallet/balance';
import { getHeldAmount } from '../../server/services';

const prisma = new PrismaClient();

export function handleWallets(bot: Telegraf<BotContext>) {
    bot.hears('💳 Кошельки', async (ctx) => {
        if (!ctx.from?.id) return;
        const userId = ctx.from.id.toString();

        const user = await prisma.user.findUnique({
            where: { chatId: userId },
            include: { wallets: true }
        });
        if (!user) return;

        const walletInfo = await Promise.all(user.wallets.map(async (wallet) => {
            const { confirmed, unconfirmed } = await getWalletBalance(user.id, wallet.coin);
            const heldAmount = await getHeldAmount(user.id, undefined, wallet.coin); // Используем getHeldAmount

            await prisma.wallet.update({
                where: { id: wallet.id },
                data: {
                    balance: confirmed,
                    unconfirmedBalance: unconfirmed
                }
            });

            const pendingAmount = Math.abs(unconfirmed || 0);
            let balanceText = `💸 *${wallet.coin} - кошелёк*\nАдрес: ${wallet.address}\nБаланс: ${wallet.balance} ${wallet.coin}`;

            const statusParts = [];
            if (pendingAmount > 0) statusParts.push(`на обработке: ${pendingAmount}`);
            if (heldAmount > 0) statusParts.push(`на удержании: ${heldAmount}`);
            if (statusParts.length > 0) balanceText += ` (${statusParts.join(', ')})`;

            return balanceText;
        }));

        await ctx.reply(walletInfo.join('\n\n') || 'Кошельки не найдены', { parse_mode: 'Markdown' });
    });
}