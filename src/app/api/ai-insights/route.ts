import { NextRequest, NextResponse } from 'next/server'
import { generateFinancialInsights } from '@/lib/gemini'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 503 })
    }

    const insight = await generateFinancialInsights(body)
    return NextResponse.json({ insight })
  } catch (error) {
    console.error('AI insights error:', error)
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 })
  }
}
