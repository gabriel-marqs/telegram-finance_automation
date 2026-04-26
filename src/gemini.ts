import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { ExpenseData } from './supabase';

dotenv.config();

// Inicializa o cliente do Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_INSTRUCTION = `Você é um assistente financeiro pessoal. 
Sua tarefa é ler ou ouvir a mensagem do usuário e extrair os dados do gasto.
Retorne SEMPRE a data no formato DD/MM/AAAA. Se o usuário falar "hoje" ou "ontem", calcule a data baseado na data atual.
Se o usuário não especificar uma data, assuma a data de hoje.
As categorias permitidas são: Alimentação, Transporte, Saúde, Lazer, Educação, Moradia, Outros.
Classifique o gasto na categoria que mais fizer sentido.`;

export async function processExpenseWithGemini(
  text: string, 
  audioBuffer?: Buffer, 
  mimeType?: string
): Promise<ExpenseData> {
  
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
