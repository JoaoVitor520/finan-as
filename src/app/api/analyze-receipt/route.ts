import { NextRequest, NextResponse } from 'next/server'
import { analyzeReceiptImage } from '@/lib/gemini'

export async function POST(request: NextRequest) {
  try {
    const { imageBase64, mimeType } = await request.json()

    if (!imageBase64 || !mimeType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 503 })
    }

    const result = await analyzeReceiptImage(imageBase64, mimeType)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Receipt analysis error:', error)
    return NextResponse.json({ error: 'Failed to analyze receipt' }, { status: 500 })
  }
}
