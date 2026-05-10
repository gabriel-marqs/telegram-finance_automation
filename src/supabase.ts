import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

if (!supabaseUrl || !supabaseKey) {
  console.warn('Variáveis do Supabase não encontradas. Verifique o arquivo .env ou as variáveis de ambiente da Vercel.');
}

export const supabase = createClient(supabaseUrl || '', supabaseKey || '');

export interface TransactionData {
  tipo: 'despesa' | 'receita' | 'desfazer';
  data?: string;
  valor?: number;
  categoria?: string;
  descricao?: string;
}

// Função auxiliar para converter data DD/MM/AAAA para YYYY-MM-DD
function parseDate(dateStr?: string): string {
  let isoDate = new Date().toISOString().split('T')[0];
  if (dateStr) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }
  return isoDate;
}

export async function insertExpense(expense: TransactionData) {
  const { data, error } = await supabase
    .from('expenses')
    .insert([{
      date: parseDate(expense.data),
      amount: expense.valor,
      category: expense.categoria,
      description: expense.descricao,
    }])
    .select();

  if (error) {
    console.error('Erro ao inserir na tabela expenses:', error);
    throw error;
  }
  return data;
}

export async function insertIncome(income: TransactionData) {
  const { data, error } = await supabase
    .from('incomes')
    .insert([{
      date: parseDate(income.data),
      amount: income.valor,
      category: income.categoria,
      description: income.descricao,
    }])
    .select();

  if (error) {
    console.error('Erro ao inserir na tabela incomes:', error);
    throw error;
  }
  return data;
}

export async function deleteLastTransaction(): Promise<boolean> {
  const { data: lastExpense, error: errorExpense } = await supabase
    .from('expenses')
    .select('id, created_at')
    .order('created_at', { ascending: false })
    .limit(1);

  const { data: lastIncome, error: errorIncome } = await supabase
    .from('incomes')
    .select('id, created_at')
    .order('created_at', { ascending: false })
    .limit(1);

  const exp = lastExpense?.[0];
  const inc = lastIncome?.[0];

  let tableToDelete = '';
  let idToDelete = null;

  if (exp && inc) {
    const expenseDate = new Date(exp.created_at);
    const incomeDate = new Date(inc.created_at);
    
    if (expenseDate > incomeDate) {
      tableToDelete = 'expenses';
      idToDelete = exp.id;
    } else {
      tableToDelete = 'incomes';
      idToDelete = inc.id;
    }
  } else if (exp) {
    tableToDelete = 'expenses';
    idToDelete = exp.id;
  } else if (inc) {
    tableToDelete = 'incomes';
    idToDelete = inc.id;
  }

  if (tableToDelete && idToDelete) {
    const { error } = await supabase
      .from(tableToDelete)
      .delete()
      .eq('id', idToDelete);
      
    if (error) {
      console.error(`Erro ao deletar de ${tableToDelete}:`, error);
      throw error;
    }
    return true;
  }
  
  return false;
}

export interface RunData {
  tipo: 'treino' | 'desfazer';
  data?: string; // DD/MM/AAAA
  distancia_km?: number;
  duracao_segundos?: number;
  tipo_treino?: string;
  pace?: number;
}

export async function insertRun(run: RunData) {
  const { data, error } = await supabase
    .from('running_workouts')
    .insert([{
      date: parseDate(run.data),
      distance_km: run.distancia_km,
      duration_seconds: run.duracao_segundos,
      pace: run.pace,
      type: run.tipo_treino
    }])
    .select();

  if (error) {
    console.error('Erro ao inserir na tabela running_workouts:', error);
    throw error;
  }
  return data;
}

export async function deleteLastRun(): Promise<boolean> {
  const { data: lastRun, error } = await supabase
    .from('running_workouts')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Erro ao buscar ultimo treino:', error);
    throw error;
  }

  const run = lastRun?.[0];

  if (run) {
    const { error: delError } = await supabase
      .from('running_workouts')
      .delete()
      .eq('id', run.id);
      
    if (delError) {
      console.error('Erro ao deletar de running_workouts:', delError);
      throw delError;
    }
    return true;
  }
  
  return false;
}
