import { Telegraf, Markup } from 'telegraf';
import { PrismaClient } from '@prisma/client';
import { BotContext } from '../bot';
import { config } from '../../config/env';

const prisma = new PrismaClient();

export function handleReferral(bot: Telegraf<BotContext>) {
    bot.hears('🤝 Реферальная программа', async (ctx) => {
        if (!ctx.from?.id) return;
        const userId = ctx.from.id.toString();

        const user = await prisma.user.findUnique({
            where: { chatId: userId },
            include: { referrals: true }
        });

        if (!user) {
            await ctx.reply('Пользователь не найден');
            return;
        }

        const referralLink = `https://t.me/${config.BOT_NAME}?start=${user.referralLinkId}`;
        const referralInfo = [
            `🔗 *Реферальная ссылка*`,
            referralLink,
            `Приглашено: ${user.referrals.length}`,
            `Процент со обменов: ${config.REFERRAL_REVENUE_PERCENT}%`
        ];

        const shareText = '💎 Присоединяйтесь к нашему P2P боту!';
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(shareText)}`;

        const keyboard = Markup.inlineKeyboard([
            [Markup.button.url('📬 Поделиться', shareUrl)]
        ]);

        await ctx.reply(referralInfo.join('\n'), {
            parse_mode: 'Markdown',
            reply_markup: keyboard.reply_markup
        });
    });
}