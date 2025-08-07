import { Telegraf } from 'telegraf';
import { PrismaClient } from '@prisma/client';
import { BotContext } from '../bot';

const prisma = new PrismaClient();

export function handleProfile(bot: Telegraf<BotContext>) {
    bot.hears('🪪 Профиль', async (ctx) => {
        if (!ctx.from?.id) return;
        const userId = ctx.from.id.toString();

        const user = await prisma.user.findUnique({
            where: { chatId: userId },
            include: {
                wallets: true,
                referrals: true,
                deals: true,
                warrantHolder: true
            }
        });

        if (!user) {
            await ctx.reply('Пользователь не найден');
            return;
        }

        const completedDealsCount = user.deals.filter(deal => deal.status === 'completed').length;

        const profileInfo = [
            `📖 *Общая информация*`,
            `Имя: @${user.username}`,
            `ID: ${user.chatId}`,
            `Количество рефералов: ${user.referrals.length}`,
            `Количество сделок: ${completedDealsCount}`,
            `Дата регистрации: ${user.createdAt.toLocaleDateString('ru-RU')}`,
            `\n💸 *Кошельки*`,
            ...user.wallets.map(wallet =>
                `${wallet.coin}: ${wallet.balance}`
            )
        ];

        await ctx.reply(profileInfo.join('\n'), { parse_mode: 'Markdown' });
    });
}