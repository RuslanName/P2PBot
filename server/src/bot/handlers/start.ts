import { Telegraf, Markup } from 'telegraf';
import { PrismaClient } from '@prisma/client';
import { BotContext } from '../bot';
import { encrypt } from '../../utils/cryptoEncrypted';
import { generateBTCWallet, generateLTCWallet, generateUSDTWallet } from "../../wallet/walletGeneration";
import { clearState, getState, setState } from "../state";

const prisma = new PrismaClient();

function generateMathProblem() {
    const operations = ['+', '-', 'x', '/'];
    const operation = operations[Math.floor(Math.random() * operations.length)];
    let num1 = Math.floor(Math.random() * 10) + 1;
    let num2 = Math.floor(Math.random() * 10) + 1;
    let correctAnswer: number;
    let question: string;

    switch (operation) {
        case '+':
            correctAnswer = num1 + num2;
            question = `${num1} + ${num2}`;
            break;
        case '-':
            correctAnswer = num1 - num2;
            question = `${num1} - ${num2}`;
            break;
        case 'x':
            correctAnswer = num1 * num2;
            question = `${num1} x ${num2}`;
            break;
        case '/':
            num2 = Math.floor(Math.random() * 9) + 1;
            num1 = num2 * (Math.floor(Math.random() * 10) + 1);
            correctAnswer = num1 / num2;
            question = `${num1} / ${num2}`;
            break;
        default:
            break;
    }

    const answers = new Set<number>();
    answers.add(correctAnswer);
    while (answers.size < 4) {
        const offset = Math.floor(Math.random() * 10) - 5;
        const wrongAnswer = correctAnswer + offset;
        if (wrongAnswer !== correctAnswer && wrongAnswer > 0) {
            answers.add(wrongAnswer);
        }
    }

    const answerArray = Array.from(answers).sort(() => Math.random() - 0.5);
    return { question, correctAnswer, answers: answerArray };
}

export function handleStart(bot: Telegraf<BotContext>) {
    bot.start(async (ctx) => {
        if (!ctx.from?.id) return;
        const userId = ctx.from.id.toString();

        const existingUser = await prisma.user.findUnique({
            where: { chatId: userId },
        });

        if (existingUser) {
            await ctx.reply('Добро пожаловать в P2P бот!', Markup.keyboard([
                ['🪪 Профиль', '💳 Кошельки'],
                ['💰 Сделки', '💸 Вывод средств'],
                ['🤝 Реферальная программа']
            ]).resize());
            return;
        }

        await setState(userId, { startPayload: ctx.startPayload });

        const { question, correctAnswer, answers } = generateMathProblem();
        await setState(userId, { captcha: { correctAnswer, attempts: 0, maxAttempts: 3 } });

        const keyboard = Markup.inlineKeyboard(
            answers.map((answer) => [
                Markup.button.callback(
                    answer.toString(),
                    `captcha_${answer}`
                )
            ])
        );

        await ctx.reply(`⏳ Решите ${question} = ?`, keyboard);
    });

    bot.action(/captcha_(.+)/, async (ctx) => {
        const selectedAnswer = parseInt(ctx.match[1]);
        const userId = ctx.from?.id.toString();
        if (!userId) {
            await ctx.reply('Ошибка: попробуйте снова с команды /start');
            return;
        }

        const state = await getState(userId);
        if (!state.captcha) {
            await ctx.reply('Ошибка: попробуйте снова с команды /start');
            return;
        }

        const { correctAnswer, attempts, maxAttempts } = state.captcha;

        if (selectedAnswer === correctAnswer) {
            await ctx.deleteMessage();
            await setState(userId, { action: 'select_fiat' });

            await ctx.reply(
                '✅ Капча пройдена! Выберите фиатную валюту для обмена',
                Markup.inlineKeyboard([
                    [
                        Markup.button.callback('RUB', 'start_fiat_RUB'),
                        Markup.button.callback('UAH', 'start_fiat_UAH'),
                    ],
                    [
                        Markup.button.callback('KZT', 'start_fiat_KZT'),
                        Markup.button.callback('BYN', 'start_fiat_BYN'),
                    ],
                    [
                        Markup.button.callback('USD', 'start_fiat_USD'),
                        Markup.button.callback('EUR', 'start_fiat_EUR'),
                    ]
                ])
            );
        } else {
            await setState(userId, { captcha: { ...state.captcha, attempts: attempts + 1 } });
            await ctx.deleteMessage();

            if (attempts + 1 >= maxAttempts) {
                await ctx.reply('🚫 Слишком много неверных попыток. Попробуйте снова через минуту.');
                await clearState(userId);
                return;
            }

            const { question, correctAnswer, answers } = generateMathProblem();
            await setState(userId, { captcha: { ...state.captcha, correctAnswer } });

            const keyboard = Markup.inlineKeyboard(
                answers.map((answer) => [
                    Markup.button.callback(
                        answer.toString(),
                        `captcha_${answer}`
                    )
                ])
            );

            await ctx.reply(`❌ Неверный ответ. Решите: ${question} = ?`, keyboard);
        }
    });

    bot.action(/start_fiat_(RUB|UAH|KZT|BYN|USD|EUR)/, async (ctx) => {
        const fiatCurrency = ctx.match[1];
        const userId = ctx.from?.id.toString();
        if (!userId) {
            await ctx.reply('Ошибка: попробуйте снова с команды /start');
            return;
        }

        await ctx.deleteMessage();

        const state = await getState(userId);
        const payload = state.startPayload as string | undefined;
        let referrerId: number | undefined;
        let referrerChatId: string | undefined;

        if (payload) {
            const referrer = await prisma.user.findFirst({
                where: { referralLinkId: payload },
            });
            if (referrer) {
                referrerId = referrer.id;
                referrerChatId = referrer.chatId;
            }
        }

        const btcWallet = generateBTCWallet();
        const ltcWallet = generateLTCWallet();
        const usdtWallet = await generateUSDTWallet();

        await prisma.user.create({
            data: {
                chatId: userId,
                username: ctx.from?.username,
                firstName: ctx.from?.first_name || '',
                lastName: ctx.from?.last_name || '',
                fiatCurrency,
                referrerId,
                wallets: {
                    create: [
                        {
                            coin: 'BTC',
                            address: btcWallet.address,
                            privateKey: encrypt(btcWallet.privateKey),
                        },
                        {
                            coin: 'LTC',
                            address: ltcWallet.address,
                            privateKey: encrypt(ltcWallet.privateKey),
                        },
                        {
                            coin: 'USDT',
                            address: usdtWallet.address,
                            privateKey: encrypt(usdtWallet.privateKey),
                        }
                    ]
                }
            }
        });

        if (referrerChatId) {
            await bot.telegram.sendMessage(
                referrerChatId,
                `🎉 Пользователь @${ctx.from?.username} зарегистрировался по вашей реферальной ссылке!`
            );
        }

        await clearState(userId);

        await ctx.reply('Добро пожаловать в P2P бот!', Markup.keyboard([
            ['🪪 Профиль', '💳 Кошельки'],
            ['💰 Сделки', '💸 Вывод средств'],
            ['🤝 Реферальная программа']
        ]).resize());
    });
}