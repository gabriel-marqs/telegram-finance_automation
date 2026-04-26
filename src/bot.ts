import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import dotenv from 'dotenv';
import { processExpenseWithGemini } from './gemini';
import { insertExpense } from './supabase';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN deve ser fornecido!');
}

export const bot = new Telegraf(token);

bot.start((ctx) => {
  ctx.reply('Olá! Sou seu assistente financeiro. Mande uma mensagem de texto ou áudio falando sobre um gasto e eu registrarei na sua planilha/banco de dados.');
});

bot.on(message('text'), async (ctx) => {
  const userText = ctx.message.text;
  
  try {
    const msg = await ctx.reply('⏳ Analisando gasto...');
    
    // Processa com Gemini
    const expenseData = await processExpenseWithGemini(userText);
    
    // Salva no Supabase
    await insertExpense(expenseData);
    
    // Responde ao usuário
    const resposta = `✅ Gasto registrado com sucesso!\n\n` +
      `📅 Data: ${expenseData.data}\n` +
      `💰 Valor: R$ ${expenseData.valor.toFixed(2)}\n` +
      `📂 Categoria: ${expenseData.categoria}\n` +
      `📝 Descrição: ${expenseData.descricao}`;
      
    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, resposta);
    
  } catch (error) {
    console.error(error);
    await ctx.reply('❌ Ocorreu um erro ao processar seu gasto. Tente novamente.');
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
    const expenseData = await processExpenseWithGemini('', buffer, 'audio/ogg');
    
    // Salva no Supabase
    await insertExpense(expenseData);
    
    // Responde ao usuário
    const resposta = `✅ Áudio processado e gasto registrado!\n\n` +
      `📅 Data: ${expenseData.data}\n` +
      `💰 Valor: R$ ${expenseData.valor.toFixed(2)}\n` +
      `📂 Categoria: ${expenseData.categoria}\n` +
      `📝 Descrição: ${expenseData.descricao}`;
      
    await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, resposta);
    
  } catch (error) {
    console.error(error);
    await ctx.reply('❌ Ocorreu um erro ao processar seu áudio. Tente novamente.');
  }
});
