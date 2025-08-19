import { Telegraf, Markup } from 'telegraf';
import { PrismaClient } from '@prisma/client';
import { BotContext } from '../bot';
import { setState, getState, clearState } from '../state';

const prisma = new PrismaClient();

export function handleProfile(bot: Telegraf<BotContext>) {
    async function showProfile(ctx: BotContext, userId: string) {
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
            `Фиатная валюта: ${user.fiatCurrency}`,
            `Количество рефералов: ${user.referrals.length}`,
            `Количество обменов: ${completedDealsCount}`,
            `Дата регистрации: ${user.createdAt.toLocaleDateString('ru-RU')}`,
            `\n💸 *Кошельки*`,
            ...user.wallets.map(wallet =>
                `${wallet.coin}: ${wallet.balance}`
            )
        ];

        await ctx.editMessageText(profileInfo.join('\n'), {
            parse_mode: 'Markdown',
            reply_markup: Markup.inlineKeyboard([
                [Markup.button.callback('Обновить фиатную валюту', 'update_fiat')]
            ]).reply_markup
        });
    }

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
            `Фиатная валюта: ${user.fiatCurrency}`,
            `Количество рефералов: ${user.referrals.length}`,
            `Количество обменов: ${completedDealsCount}`,
            `Дата регистрации: ${user.createdAt.toLocaleDateString('ru-RU')}`,
            `\n💸 *Кошельки*`,
            ...user.wallets.map(wallet =>
                `${wallet.coin}: ${wallet.balance}`
            )
        ];

        await ctx.reply(profileInfo.join('\n'), {
            parse_mode: 'Markdown',
            reply_markup: Markup.inlineKeyboard([
                [Markup.button.callback('Обновить фиатную валюту', 'update_fiat')]
            ]).reply_markup
        });
    });

    bot.action('update_fiat', async (ctx) => {
        if (!ctx.from?.id) return;
        const userId = ctx.from.id.toString();
        await setState(userId, { action: 'profile_update_fiat' });

        await ctx.editMessageText(
            'Выберите новую фиатную валюту для обмена',
            Markup.inlineKeyboard([
                [
                    Markup.button.callback('RUB', 'profile_update_fiat_RUB'),
                    Markup.button.callback('UAH', 'profile_update_fiat_UAH'),
                ],
                [
                    Markup.button.callback('KZT', 'profile_update_fiat_KZT'),
                    Markup.button.callback('BYN', 'profile_update_fiat_BYN'),
                ],
                [
                    Markup.button.callback('USD', 'profile_update_fiat_USD'),
                    Markup.button.callback('EUR', 'profile_update_fiat_EUR'),
                ],
                [Markup.button.callback('Отменить', 'profile_update_fiat_cancel')]
            ])
        );
    });

    bot.action(/profile_update_fiat_(RUB|UAH|KZT|BYN|USD|EUR)/, async (ctx) => {
        if (!ctx.from?.id) return;
        const userId = ctx.from.id.toString();
        const fiatCurrency = ctx.match[1];

        await prisma.user.update({
            where: { chatId: userId },
            data: { fiatCurrency }
        });

        await clearState(userId);
        await showProfile(ctx, userId);
    });

    bot.action('profile_update_fiat_cancel', async (ctx) => {
        if (!ctx.from?.id) return;
        const userId = ctx.from.id.toString();
        await clearState(userId);
        await showProfile(ctx, userId);
    });
}