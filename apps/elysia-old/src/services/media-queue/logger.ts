import { c } from "../../utils/colors.js"

export function logQueue(msg: string): void {
  const d = new Date()
  const pad = (n: number) => n.toString().padStart(2, "0")
  const time = c.gray(
    `[${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}]`
  )
  process.stdout.write(`${time} ${msg}\n`)
}
