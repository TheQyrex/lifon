// Cloudflare Worker для управления уведомлениями
// Деплой на cupsize-notifications.usvidelsvet.workers.dev

const TELEGRAM_BOT_TOKEN = 'YOUR_BOT_TOKEN'; // Получишь от @BotFather
const ADMIN_CHAT_ID = 'YOUR_CHAT_ID'; // Твой Telegram ID

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const path = url.pathname;

        // CORS headers
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        };

        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        // GET /notification - получить активное уведомление
        if (path === '/notification' && request.method === 'GET') {
            const notification = await env.NOTIFICATIONS.get('active_notification');

            if (!notification) {
                return new Response(JSON.stringify({ notification: null }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            return new Response(notification, {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // POST /webhook - Telegram webhook
        if (path === '/webhook' && request.method === 'POST') {
            const update = await request.json();

            if (update.message) {
                const chatId = update.message.chat.id;
                const text = update.message.text;

                // Только админ может управлять
                if (chatId.toString() !== ADMIN_CHAT_ID) {
                    await sendTelegramMessage(chatId, '❌ У вас нет доступа к этому боту.');
                    return new Response('OK');
                }

                // Команды
                if (text === '/start') {
                    await sendTelegramMessage(chatId,
                        '🎵 CUPSIZE Notifications Bot\n\n' +
                        'Команды:\n' +
                        '/banner <текст> - Показать баннер на весь экран\n' +
                        '/notify <текст> - Показать мини-уведомление\n' +
                        '/clear - Убрать уведомление\n' +
                        '/status - Проверить текущее уведомление'
                    );
                } else if (text.startsWith('/banner ')) {
                    const message = text.replace('/banner ', '').trim();
                    await env.NOTIFICATIONS.put('active_notification', JSON.stringify({
                        type: 'banner',
                        message: message,
                        timestamp: Date.now()
                    }));
                    await sendTelegramMessage(chatId, '✅ Баннер установлен:\n' + message);
                } else if (text.startsWith('/notify ')) {
                    const message = text.replace('/notify ', '').trim();
                    await env.NOTIFICATIONS.put('active_notification', JSON.stringify({
                        type: 'notification',
                        message: message,
                        timestamp: Date.now()
                    }));
                    await sendTelegramMessage(chatId, '✅ Уведомление установлено:\n' + message);
                } else if (text === '/clear') {
                    await env.NOTIFICATIONS.delete('active_notification');
                    await sendTelegramMessage(chatId, '✅ Уведомление удалено');
                } else if (text === '/status') {
                    const notification = await env.NOTIFICATIONS.get('active_notification');
                    if (!notification) {
                        await sendTelegramMessage(chatId, 'ℹ️ Нет активных уведомлений');
                    } else {
                        const data = JSON.parse(notification);
                        await sendTelegramMessage(chatId,
                            `ℹ️ Активное уведомление:\n` +
                            `Тип: ${data.type === 'banner' ? 'Баннер' : 'Мини-уведомление'}\n` +
                            `Текст: ${data.message}`
                        );
                    }
                }
            }

            return new Response('OK');
        }

        return new Response('Not Found', { status: 404 });
    }
};

async function sendTelegramMessage(chatId, text) {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML'
        })
    });
}
