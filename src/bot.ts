import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import dotenv from 'dotenv';
import { processTransactionWithGemini } from './gemini';
import { insertExpense, insertIncome, deleteLastTransaction, TransactionData } from './supabase';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN deve ser fornecido!');
}

export const bot = new Telegraf(token);

bot.start((ctx) => {
  ctx.reply('Olá! Sou seu assistente financeiro. Mande uma mensagem de texto ou áudio falando sobre um gasto ou recebimento e eu registrarei no seu banco de dados.');
});

async function handleTransaction(ctx: any, transactionData: TransactionData, originalMessageId: number) {
  let resposta = '';

  if (transactionData.tipo === 'desfazer') {
    const deleted = await deleteLastTransaction();
    if (deleted) {
      resposta = `✅ Último lançamento removido com sucesso!`;
    } else {
      resposta = `⚠️ Nenhum lançamento encontrado para remover.`;
    }
    await ctx.telegram.editMessageText(ctx.chat.id, originalMessageId, undefined, resposta);
    return;
  }

  if (transactionData.tipo === 'receita') {
    await insertIncome(transactionData);
    resposta = `✅ Recebimento registrado com sucesso!\n\n`;
  } else {
    await insertExpense(transactionData);
    resposta = `✅ Gasto registrado com sucesso!\n\n`;
  }

  resposta += `📅 Data: ${transactionData.data}\n` +
    `💰 Valor: R$ ${transactionData.valor?.toFixed(2)}\n` +
    `📂 Categoria: ${transactionData.categoria}\n` +
    `📝 Descrição: ${transactionData.descricao}`;
    
  await ctx.telegram.editMessageText(ctx.chat.id, originalMessageId, undefined, resposta);
}

bot.on(message('text'), async (ctx) => {
  const userText = ctx.message.text;
  
  try {
    const msg = await ctx.reply('⏳ Analisando transação...');
    
    // Processa com Gemini
    const transactionData = await processTransactionWithGemini(userText);
    
    // Salva no banco e responde
    await handleTransaction(ctx, transactionData, msg.message_id);
    
  } catch (error) {
    console.error(error);
    await ctx.reply('❌ Ocorreu um erro ao processar sua mensagem. Tente novamente.');
  }
});

bot.on(message('voice'), async (ctx) => {
  try {
    const msg = await ctx.reply('⏳ Ouvindo e analisando seu áudio...');
    
    const fileId = ctx.message.voice.file_id;
    const fileLink = await ctx.telegram.getFileLink(fileId);
    
    // Faz o download do arquivo de áudio
    const response = await fetch(fileLink.toString());
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Telegram voice messages usually come in OGG format (audio/ogg)
    const transactionData = await processTransactionWithGemini('', buffer, 'audio/ogg');
    
    // Salva no banco e responde
    await handleTransaction(ctx, transactionData, msg.message_id);
    
  } catch (error) {
    console.error(error);
    await ctx.reply('❌ Ocorreu um erro ao processar seu áudio. Tente novamente.');
  }
});
