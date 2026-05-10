import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import dotenv from 'dotenv';
import { processRunWithGemini } from './gemini';
import { insertRun, deleteLastRun, RunData } from './supabase';

dotenv.config();

const token = process.env.TELEGRAM_RUN_BOT_TOKEN;
if (!token) {
  throw new Error('TELEGRAM_RUN_BOT_TOKEN deve ser fornecido!');
}

export const bot = new Telegraf(token);

bot.start((ctx) => {
  ctx.reply('🏃‍♂️ Olá! Sou seu assistente de corridas. Mande uma mensagem de texto ou áudio informando a distância e o tempo do seu treino, e eu registrarei no seu banco de dados.');
});

function formatSeconds(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${h}h ${m}m ${s}s`;
  }
  return `${m}m ${s}s`;
}

function formatPace(paceDecimal: number): string {
  const m = Math.floor(paceDecimal);
  const s = Math.round((paceDecimal - m) * 60);
  return `${m}'${s.toString().padStart(2, '0')}"/km`;
}

async function handleRun(ctx: any, runData: RunData, originalMessageId: number) {
  let resposta = '';

  if (runData.tipo === 'desfazer') {
    const deleted = await deleteLastRun();
    if (deleted) {
      resposta = `✅ Último treino removido com sucesso!`;
    } else {
      resposta = `⚠️ Nenhum treino encontrado para remover.`;
    }
    await ctx.telegram.editMessageText(ctx.chat.id, originalMessageId, undefined, resposta);
    return;
  }

  // Cálculo de pace (min/km)
  if (runData.distancia_km && runData.duracao_segundos) {
    runData.pace = (runData.duracao_segundos / 60) / runData.distancia_km;
  }

  await insertRun(runData);
  resposta = `✅ Treino registrado com sucesso!\n\n`;

  resposta += `📅 Data: ${runData.data}\n` +
    `🏃‍♂️ Distância: ${runData.distancia_km} km\n` +
    `⏱️ Duração: ${formatSeconds(runData.duracao_segundos!)}\n` +
    `⚡ Pace: ${formatPace(runData.pace!)}\n` +
    `🏷️ Tipo: ${runData.tipo_treino}`;
    
  await ctx.telegram.editMessageText(ctx.chat.id, originalMessageId, undefined, resposta);
}

bot.on(message('text'), async (ctx) => {
  const userText = ctx.message.text;
  
  try {
    const msg = await ctx.reply('⏳ Analisando seu treino...');
    
    // Processa com Gemini
    const runData = await processRunWithGemini(userText);
    
    // Salva no banco e responde
    await handleRun(ctx, runData, msg.message_id);
    
  } catch (error) {
    console.error(error);
    await ctx.reply('❌ Ocorreu um erro ao processar sua mensagem. Tente novamente.');
  }
});

bot.on(message('voice'), async (ctx) => {
  try {
    const msg = await ctx.reply('⏳ Ouvindo e analisando seu treino...');
    
    const fileId = ctx.message.voice.file_id;
    const fileLink = await ctx.telegram.getFileLink(fileId);
    
    // Faz o download do arquivo de áudio
    const response = await fetch(fileLink.toString());
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Processa o áudio com Gemini
    const runData = await processRunWithGemini('', buffer, 'audio/ogg');
    
    // Salva no banco e responde
    await handleRun(ctx, runData, msg.message_id);
    
  } catch (error) {
    console.error(error);
    await ctx.reply('❌ Ocorreu um erro ao processar seu áudio. Tente novamente.');
  }
});
