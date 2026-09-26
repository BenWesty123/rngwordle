import { definitionFor } from "@/lib/definition"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const word = new URL(request.url).searchParams.get("word") ?? ""
  try {
    const definition = await definitionFor(word)
    return NextResponse.json(
      { definition },
      { headers: { "Cache-Control": "public, max-age=86400" } },
    )
  } catch {
    return NextResponse.json({ error: "The definitions didn't load." }, { status: 500 })
  }
}
