/** Split a script on semicolons. Comments and quoted text stay intact. */
export function sqlStatements(sql: string): string[] {
  const statements: string[] = []
  let current = ""
  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index]
    if (char === "-" && sql[index + 1] === "-") {
      const end = sql.indexOf("\n", index)
      index = end === -1 ? sql.length : end
      continue
    }
    if (char === "'") {
      const end = sql.indexOf("'", index + 1)
      if (end === -1) {
        current += sql.slice(index)
        break
      }
      current += sql.slice(index, end + 1)
      index = end
      continue
    }
    if (char === ";") {
      const statement = current.trim()
      if (statement) statements.push(statement)
      current = ""
      continue
    }
    current += char
  }
  const tail = current.trim()
  if (tail) statements.push(tail)
  return statements
}
