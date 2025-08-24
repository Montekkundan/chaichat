import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const skip = searchParams.get('skip')

    const apiUrl = new URL('https://api.llmgateway.io')
    if (skip) {
      apiUrl.searchParams.set('skip', skip)
    }

    const response = await fetch(apiUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      cache: "no-store",
    })

    if (!response.ok) {
      return NextResponse.json(
        {
          message: "Degraded",
          health: {
            status: "degraded",
          },
        },
        { status: 503 },
      )
    }

    const json = await response.json()

    return NextResponse.json(json)
  } catch (error) {
    console.error('Health check error:', error)
    return NextResponse.json(
      {
        message: "Degraded",
        health: {
          status: "degraded",
        },
      },
      { status: 503 },
    )
  }
}
