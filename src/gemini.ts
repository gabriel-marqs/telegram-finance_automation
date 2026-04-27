import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { ExpenseData } from './supabase';

dotenv.config();

// Inicializa o cliente do Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function processExpenseWithGemini(
  text: string, 
  audioBuffer?: Buffer, 
  mimeType?: string
): Promise<ExpenseData> {
  
  // Descobre a data e dia da semana atual no fuso do Brasil
  const hoje = new Date();
  const dateStr = hoje.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const dayOfWeek = hoje.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long' });

  const SYSTEM_INSTRUCTION = `Você é um assistente financeiro pessoal.
Sua tarefa é ler ou ouvir a mensagem do usuário e extrair os dados do gasto.

REGRAS DE DATA:
- Hoje é ${dayOfWeek}, dia ${dateStr}.
- Quando o dia não for especificado, considere a data de hoje (${dateStr}).
- Quando a data for referenciada de forma abstrata ("ontem", "anteontem", "última segunda", "sábado passado"), calcule a data exata no formato DD/MM/AAAA subtraindo os dias a partir de hoje (${dateStr}).
- Retorne SEMPRE a data no formato DD/MM/AAAA.

REGRAS DE CATEGORIA:
- Verifique se o gasto se enquadra em uma das seguintes opções: Mercado, Hortifruti, Açougue, Pensão, Creche, Família, Casa, Emergência médica, Delivery, Transporte, Streaming, Cuidado pessoal.
- Se não for o caso, adicione uma nova categoria descritiva e curta. No entanto, sempre PRIORIZE o que melhor se adequar entre as opções acima.`;

  const contents: any[] = [];

  // Se houver áudio, adiciona na requisição
  if (audioBuffer && mimeType) {
    contents.push({
      inlineData: {
        data: audioBuffer.toString("base64"),
        mimeType: mimeType
      }
    });
  }

  // Adiciona o texto (se existir ou se for uma instrução adicional para o áudio)
  if (text) {
    contents.push(text);
  } else if (audioBuffer) {
    contents.push("Extraia o gasto deste áudio.");
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: contents,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          data: {
            type: Type.STRING,
            description: "Data do gasto no formato DD/MM/AAAA"
          },
          valor: {
            type: Type.NUMBER,
            description: "Valor do gasto em formato numérico (ex: 45.50)"
          },
          categoria: {
            type: Type.STRING,
            description: "Categoria do gasto"
          },
          descricao: {
            type: Type.STRING,
            description: "Breve descrição do gasto"
          }
        },
        required: ["data", "valor", "categoria", "descricao"]
      }
    }
  });

  const responseText = response.text;
  
  if (!responseText) {
    throw new Error("Resposta vazia do Gemini");
  }

  // Faz o parse do JSON garantido pelo Gemini
  const expenseData = JSON.parse(responseText) as ExpenseData;
  return expenseData;
}
