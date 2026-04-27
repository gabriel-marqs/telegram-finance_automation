# Documentação Técnica: Telegram Finance Bot 🤖💰

Este documento detalha a arquitetura, as tecnologias escolhidas e a lógica de funcionamento do **Telegram Finance Bot**, uma automação para registro e categorização inteligente de gastos financeiros.

---

## 1. Visão Geral da Arquitetura

O sistema foi desenhado para ser leve, funcionar 100% em infraestrutura Serverless (sem custo de servidor ocioso) e ter inteligência artificial integrada nativamente para processamento multimodal (texto e áudio).

O fluxo de dados segue este caminho:
1. **Usuário** envia uma mensagem (texto ou voz) no Telegram.
2. **Telegram API** dispara um Webhook para a **Vercel**.
3. **Vercel Serverless Function** recebe a requisição e desperta o código do Bot (`telegraf`).
4. O Bot extrai o conteúdo e envia para a **API do Gemini** (`@google/genai`).
5. O Gemini interpreta a mensagem e retorna um **JSON estruturado** com os dados do gasto.
6. O Bot pega esse JSON e faz a persistência (INSERT) no **Supabase** (PostgreSQL).
7. O Bot responde ao usuário no Telegram confirmando a operação.

---

## 2. Stack Tecnológico (Ferramentas Utilizadas)

- **Linguagem:** TypeScript / Node.js
- **Bot Framework:** `telegraf` (Biblioteca madura e excelente para lidar com a API do Telegram e webhooks).
- **Inteligência Artificial:** Google Gemini (`@google/genai` utilizando o modelo `gemini-2.5-flash`).
  - *Motivo da escolha:* O modelo Flash é incrivelmente rápido e barato/gratuito. Além disso, suporta *Multimodalidade*, o que significa que ele entende áudio nativamente sem precisar de uma API de transcrição (Speech-to-Text) intermediária.
- **Banco de Dados:** Supabase (`@supabase/supabase-js`). 
  - *Motivo da escolha:* Oferece um banco PostgreSQL gratuito com uma API simples para chamadas assíncronas.
- **Hospedagem / Infraestrutura:** Vercel (Serverless Functions).
  - *Motivo da escolha:* Permite rodar o bot no modelo Webhook de forma totalmente gratuita, escalável e com deploy facilitado via GitHub.

---

## 3. Estrutura do Projeto

A separação de responsabilidades foi feita da seguinte forma:

```text
telegram_finance/
├── api/
│   └── webhook.ts       # Ponto de entrada (Endpoint) exigido pela Vercel.
├── src/
│   ├── bot.ts           # Configuração do Telegraf e rotas de comandos (text, voice).
│   ├── gemini.ts        # Lógica de comunicação com a IA e formatação de Prompt/Schema.
│   └── supabase.ts      # Conexão com o banco de dados e execução de Queries (Insert).
├── .env                 # Variáveis de ambiente secretas.
├── package.json         # Dependências do projeto Node.js.
└── tsconfig.json        # Configurações do compilador TypeScript.
```

---

## 4. Lógica de Funcionamento (Deep Dive)

### 4.1. O Webhook na Vercel (`api/webhook.ts`)
Diferente de um bot rodando via "Long Polling" (que exige um servidor ligado 24h perguntando ao Telegram se há mensagens novas), usamos **Webhooks**. O Telegram faz um HTTP POST para a rota `/api/webhook` da Vercel. O arquivo exporta uma função de manipulador padrão que repassa o corpo da requisição para o motor do Telegraf: `bot.handleUpdate()`.

### 4.2. Processamento da Inteligência Artificial (`src/gemini.ts`)
Esta é a parte mais sofisticada do código. Usamos uma técnica chamada **Structured Outputs** (Saída Estruturada).
Em vez de pedir para o modelo "responder o gasto", configuramos a requisição enviando um `responseSchema` rígido.

Isso força a IA a devolver um JSON rigorosamente validado, contendo sempre:
- `data` (String - calculada inteligentemente, por ex: se o usuário disser "ontem", a IA deduz a data).
- `valor` (Number - ex: 45.50).
- `categoria` (String - filtrada entre opções pré-definidas no System Prompt).
- `descricao` (String - resumo sucinto gerado pela IA).

Isso elimina a necessidade de usar *Expressões Regulares (Regex)* complexas no código, delegando a responsabilidade de "limpeza de dados" totalmente para a IA.

### 4.3. Lidando com Áudios (Mensagens de Voz)
Quando o usuário envia um áudio, o Telegram entrega um arquivo no formato `.ogg` ou `.oga`.
A lógica executada em `src/bot.ts`:
1. O Telegraf pega o `file_id` do áudio recebido.
2. É feito um pedido à API do Telegram para obter o link temporário de download.
3. O Node.js faz um `fetch` e baixa o arquivo em memória como um `Buffer`.
4. O buffer em base-64 é enviado diretamente para o Gemini (`gemini-2.5-flash`).
5. A IA "ouve" e executa a mesma extração estruturada (JSON) feita no modo texto.

### 4.4. Camada de Persistência (`src/supabase.ts`)
A função `insertExpense` recebe um objeto com a interface TypeScript `ExpenseData` perfeitamente tipada a partir do retorno da IA.
Foi incluído um pequeno tratamento de fallback caso a data venha em formato brasileiro `DD/MM/AAAA` para ser convertida adequadamente para o padrão ISO que o PostgreSQL do Supabase exige (`YYYY-MM-DD`). 
Em caso de erro na inserção (por exemplo, permissões), uma exceção é levantada e o bot notifica o usuário sobre a falha, evitando perda silenciosa de dados.

---

## 5. Conclusão

Esta arquitetura apresenta o equilíbrio perfeito para projetos pessoais. O uso intensivo de managed services no *Free Tier* (Vercel, Supabase e AI Studio) confere um custo operacional de R$ 0,00 mantendo estabilidade, segurança (arquivos `.env` escondidos) e tecnologia de ponta (LLMs Multimodais) encapsulados em um código limpo e manutenível.
