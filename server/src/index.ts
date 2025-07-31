import { bot } from './bot/bot';
import { app } from './server/server';
import { config } from './config/env';

console.log('Starting P2P Crypto Bot...');

bot.launch()
    .then(() => {
        console.log('Telegram bot started!');
    })
    .catch((error) => {
        console.error('Error starting bot:', error);
    });

app.listen(config.PORT, () => {
    console.log(`Server started on port: ${config.PORT}`);
});