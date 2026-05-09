import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { TransactionData } from './supabase';

dotenv.config();

// Inicializa o cliente do Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function processTransactionWithGemini(
  text: string,
  audioBuffer?: Buffer,
  mimeType?: string
): Promise<TransactionData> {

  // Descobre a data e dia da semana atual no fuso do Brasil
  const hoje = new Date();
  const dateStr = hoje.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const dayOfWeek = hoje.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long' });

  const SYSTEM_INSTRUCTION = `Você é um assistente financeiro pessoal.
Sua tarefa é ler ou ouvir a mensagem do usuário e extrair os dados da transação financeira.

REGRAS DE CLASSIFICAÇÃO E TIPO:
- Identifique se a transação é uma "receita" (recebimentos, ganhos, salários, "me pagaram") ou uma "despesa" (gastos, compras, pagamentos).

REGRAS DE DATA:
- Hoje é ${dayOfWeek}, dia ${dateStr}.
- Quando o dia não for especificado, considere a data de hoje (${dateStr}).
- Quando a data for referenciada de forma abstrata ("ontem", "anteontem", "última segunda", "sábado passado"), calcule a data exata no formato DD/MM/AAAA subtraindo os dias a partir de hoje (${dateStr}).
- Retorne SEMPRE a data no formato DD/MM/AAAA.

REGRAS DE CATEGORIA:
- Se for DESPESA, verifique se se enquadra em: Mercado, Hortifruti, Açougue, Pensão, Creche, Família, Casa, Emergência médica, Entreterimento, Delivery, Transporte, Streaming, Alimentação, Cuidado pessoal.
- Se for RECEITA, verifique se se enquadra em: Salário, Bonificação, Empréstimo, Outros.
- Se não se encaixar em nenhuma, crie uma categoria nova descritiva e curta, mas SEMPRE PRIORIZE as opções acima se houver adequação.`;

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
    contents.push("Extraia os dados financeiros deste áudio.");
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
          tipo: {
            type: Type.STRING,
            description: "Obrigatório: 'despesa' ou 'receita'",
            enum: ["despesa", "receita"]
          },
          data: {
            type: Type.STRING,
            description: "Data da transação no formato DD/MM/AAAA"
          },
          valor: {
            type: Type.NUMBER,
            description: "Valor da transação em formato numérico (ex: 45.50)"
          },
          categoria: {
            type: Type.STRING,
            description: "Categoria da transação"
          },
          descricao: {
            type: Type.STRING,
            description: "Breve descrição da transação"
          }
        },
        required: ["tipo", "data", "valor", "categoria", "descricao"]
      }
    }
  });

  const responseText = response.text;

  if (!responseText) {
    throw new Error("Resposta vazia do Gemini");
  }

  // Faz o parse do JSON garantido pelo Gemini
  const transactionData = JSON.parse(responseText) as TransactionData;
  return transactionData;
}
