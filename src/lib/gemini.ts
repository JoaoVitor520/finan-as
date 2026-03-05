import { GoogleGenerativeAI, Part } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function analyzeReceiptImage(imageBase64: string, mimeType: string): Promise<{
  description: string
  amount: number | null
  category: string | null
  date: string | null
  type: 'income' | 'expense'
}> {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

  const imagePart: Part = {
    inlineData: {
      data: imageBase64,
      mimeType: mimeType as 'image/jpeg' | 'image/png' | 'image/webp',
    },
  }

  const prompt = `Analise esta imagem de comprovante/recibo/nota fiscal e extraia as seguintes informações em formato JSON:

  {
    "description": "descrição curta e clara da transação",
    "amount": valor numérico total (apenas o número, sem R$ ou símbolos),
    "category": "categoria mais adequada entre: Alimentação, Transporte, Moradia, Saúde, Educação, Lazer, Roupas, Mercado, Pets, Viagem, Salário, Freelance, Investimentos, Outros",
    "date": "data no formato YYYY-MM-DD se encontrada, ou null",
    "type": "expense para despesa ou income para receita"
  }

  Se não conseguir identificar algum campo, use null.
  Responda APENAS com o JSON, sem markdown ou texto adicional.`

  const result = await model.generateContent([prompt, imagePart])
  const text = result.response.text().trim()

  try {
    const parsed = JSON.parse(text)
    return {
      description: parsed.description || 'Transação sem descrição',
      amount: parsed.amount ? Number(parsed.amount) : null,
      category: parsed.category || null,
      date: parsed.date || null,
      type: parsed.type === 'income' ? 'income' : 'expense',
    }
  } catch {
    return {
      description: text.substring(0, 100),
      amount: null,
      category: null,
      date: null,
      type: 'expense',
    }
  }
}

export async function generateFinancialInsights(data: {
  transactions: Array<{ type: string; amount: number; description: string; category?: string; date: string; scope: string }>
  goals: Array<{ title: string; target_amount: number; current_amount: number; deadline?: string; scope: string }>
  totalIncome: number
  totalExpenses: number
  scope: 'individual' | 'joint'
  partnerName?: string
}): Promise<string> {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

  const scopeText = data.scope === 'joint' ? 'do casal' : 'individual'
  const partnerText = data.partnerName ? ` (você e ${data.partnerName})` : ''

  const prompt = `Você é um consultor financeiro especializado em finanças pessoais e casais. Analise os dados financeiros ${scopeText}${partnerText} e forneça insights detalhados em português do Brasil.

DADOS FINANCEIROS (${data.scope === 'joint' ? 'Conjunto' : 'Individual'}):
- Total de receitas: R$ ${data.totalIncome.toFixed(2)}
- Total de despesas: R$ ${data.totalExpenses.toFixed(2)}
- Saldo: R$ ${(data.totalIncome - data.totalExpenses).toFixed(2)}
- Taxa de poupança: ${data.totalIncome > 0 ? (((data.totalIncome - data.totalExpenses) / data.totalIncome) * 100).toFixed(1) : 0}%

ÚLTIMAS TRANSAÇÕES:
${data.transactions.slice(0, 15).map(t => `- ${t.date}: ${t.type === 'income' ? '+' : '-'}R$ ${Number(t.amount).toFixed(2)} - ${t.description} (${t.category || 'Sem categoria'})`).join('\n')}

METAS ${scopeText.toUpperCase()}:
${data.goals.length > 0 ? data.goals.map(g => `- ${g.title}: R$ ${g.current_amount.toFixed(2)} / R$ ${g.target_amount.toFixed(2)} (${((g.current_amount / g.target_amount) * 100).toFixed(0)}%)${g.deadline ? ` - prazo: ${g.deadline}` : ''}`).join('\n') : 'Nenhuma meta cadastrada'}

Forneça uma análise completa com:
1. **Resumo da situação financeira** - avalie se está positiva, negativa ou equilibrada
2. **Principais gastos e padrões** - identifique onde o dinheiro está indo
3. **Pontos de atenção** - alertas importantes
4. **Sugestões de melhoria** - pelo menos 3 dicas práticas e específicas
5. **Análise das metas** - progresso e sugestões para alcançá-las mais rápido
6. **Dica do mês** - uma dica especial e prática

Seja direto, prático e use linguagem acessível. Formate com markdown para melhor leitura.`

  const result = await model.generateContent(prompt)
  return result.response.text()
}
