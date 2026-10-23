import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

export async function POST(req: Request) {
  try {
    const data = await req.json()
    const logLine = `[${new Date().toISOString()}] ${JSON.stringify(data, null, 2)}\n`
    fs.appendFileSync(path.join(process.cwd(), "debug.log"), logLine)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
