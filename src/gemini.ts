import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { TransactionData, RunData } from './supabase';

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
- Caso o usuário peça para desfazer, excluir, remover, cancelar ou apagar o ÚLTIMO lançamento, o tipo será "desfazer".

REGRAS DE DATA:
- Hoje é ${dayOfWeek}, dia ${dateStr}.
- Quando o dia não for especificado, considere a data de hoje (${dateStr}).
- Quando a data for referenciada de forma abstrata ("ontem", "anteontem", "última segunda", "sábado passado"), calcule a data exata no formato DD/MM/AAAA subtraindo os dias a partir de hoje (${dateStr}).
- Retorne SEMPRE a data no formato DD/MM/AAAA.

REGRAS DE CATEGORIA:
- Se for DESPESA, verifique se se enquadra em: Mercado, Hortifruti, Trabalho (despesas relacionadas ao trabalho, independente do tema), Investimento (guardar dinheiro em algum lugar, como poupança, por exemplo), Açougue, Pensão, Creche, Família, Casa, Emergência médica, Dívida (pagamento de empréstimo, empréstimo para terceiros, etc), Entreterimento (jogos, experiências, etc), Delivery, Transporte (cartão de transporte, uber, 99, etc), Streaming, Assinaturas (que não seja streaming), Alimentação (comer fora, restaurante, bares, cafés), Cuidado pessoal (cuidados com a saúde, cosméticos, etc), Outros.
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
            description: "Obrigatório: 'despesa', 'receita' ou 'desfazer'",
            enum: ["despesa", "receita", "desfazer"]
          },
          data: {
            type: Type.STRING,
            description: "Data da transação no formato DD/MM/AAAA. Opcional para desfazer."
          },
          valor: {
            type: Type.NUMBER,
            description: "Valor da transação em formato numérico (ex: 45.50). Opcional para desfazer."
          },
          categoria: {
            type: Type.STRING,
            description: "Categoria da transação. Opcional para desfazer."
          },
          descricao: {
            type: Type.STRING,
            description: "Breve descrição da transação. Opcional para desfazer."
          }
        },
        required: ["tipo"]
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

export async function processRunWithGemini(
  text: string,
  audioBuffer?: Buffer,
  mimeType?: string
): Promise<RunData> {

  const hoje = new Date();
  const dateStr = hoje.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const dayOfWeek = hoje.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long' });

  const SYSTEM_INSTRUCTION = `Você é um assistente de treinos de corrida.
Sua tarefa é ler ou ouvir a mensagem do usuário e extrair os dados do treino de corrida.

REGRAS DE CLASSIFICAÇÃO E TIPO:
- Identifique se é o registro de um treino novo ou se o usuário quer desfazer.
- Caso o usuário peça para desfazer, excluir, remover, cancelar ou apagar o ÚLTIMO treino, o tipo será "desfazer". Caso contrário, será "treino".

REGRAS DE DATA:
- Hoje é ${dayOfWeek}, dia ${dateStr}.
- Quando o dia não for especificado, considere a data de hoje (${dateStr}).
- Quando a data for referenciada de forma abstrata, calcule a data exata no formato DD/MM/AAAA.
- Retorne SEMPRE a data no formato DD/MM/AAAA.

REGRAS DE DISTÂNCIA E DURAÇÃO:
- Extraia a distância em quilômetros (ex: se falou "10k" ou "10,54", extraia 10.54 como número).
- Extraia a duração e converta TODO o tempo para SEGUNDOS exatos. (ex: "59 minutos e 37 segundos" = 3577).

REGRAS DE TIPO DE TREINO:
- Identifique qual o tipo do treino com base no texto. Pode ser: 'livre', 'regenerativo', 'velocidade', 'longão'.
- Se não for especificado, assuma 'livre'.`;

  const contents: any[] = [];

  if (audioBuffer && mimeType) {
    contents.push({
      inlineData: {
        data: audioBuffer.toString("base64"),
        mimeType: mimeType
      }
    });
  }

  if (text) {
    contents.push(text);
  } else if (audioBuffer) {
    contents.push("Extraia os dados deste treino de corrida.");
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
            description: "Obrigatório: 'treino' ou 'desfazer'",
            enum: ["treino", "desfazer"]
          },
          data: {
            type: Type.STRING,
            description: "Data do treino no formato DD/MM/AAAA. Opcional para desfazer."
          },
          distancia_km: {
            type: Type.NUMBER,
            description: "Distância percorrida em quilômetros (número). Opcional para desfazer."
          },
          duracao_segundos: {
            type: Type.INTEGER,
            description: "Duração total do treino em segundos. Opcional para desfazer."
          },
          tipo_treino: {
            type: Type.STRING,
            description: "Tipo do treino. Opcional para desfazer.",
            enum: ["livre", "regenerativo", "velocidade", "longão"]
          }
        },
        required: ["tipo"]
      }
    }
  });

  const responseText = response.text;

  if (!responseText) {
    throw new Error("Resposta vazia do Gemini");
  }

  const runData = JSON.parse(responseText) as RunData;
  return runData;
}
