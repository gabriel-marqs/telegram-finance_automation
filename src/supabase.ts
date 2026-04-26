import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

if (!supabaseUrl || !supabaseKey) {
  console.warn('Variáveis do Supabase não encontradas. Verifique o arquivo .env ou as variáveis de ambiente da Vercel.');
}

export const supabase = createClient(supabaseUrl || '', supabaseKey || '');

export interface ExpenseData {
  data: string;
  valor: number;
  categoria: string;
  descricao: string;
}

export async function insertExpense(expense: ExpenseData) {
  // Converte a data de DD/MM/AAAA para formato aceito pelo PostgreSQL (YYYY-MM-DD) se necessário,
  // ou deixa o banco lidar com isso se for texto. Vamos assumir que a coluna no banco
  // se chama "date" (date), "amount" (numeric), "category" (text), "description" (text).
  
  // Tratamento basico da data se vier como DD/MM/AAAA
  let isoDate = new Date().toISOString().split('T')[0]; // fallback para hoje
  if (expense.data) {
    const parts = expense.data.split('/');
    if (parts.length === 3) {
      isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }

  const { data, error } = await supabase
    .from('expenses')
    .insert([
      {
        date: isoDate,
        amount: expense.valor,
        category: expense.categoria,
        description: expense.descricao,
      },
    ])
    .select();

  if (error) {
    console.error('Erro ao inserir no Supabase:', error);
    throw error;
  }

  return data;
}
