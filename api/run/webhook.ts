import type { VercelRequest, VercelResponse } from '@vercel/node';
import { bot } from '../../src/run_bot';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Configura a URL de Webhook se estivermos em produção.
  // Em produção na Vercel, a URL base vem da variável VERCEL_URL,
  // ou podemos ter configurado o Webhook manualmente no Telegram.

  if (req.method === 'POST') {
    try {
      // O bot processa o evento recebido no Webhook
      await bot.handleUpdate(req.body, res);
    } catch (e) {
      console.error('Erro no webhook:', e);
      res.status(500).send('Error processing update');
    }
  } else {
    // Retorna algo em GET só para teste
    res.status(200).send('Telegram Bot Webhook is running!');
  }
}
