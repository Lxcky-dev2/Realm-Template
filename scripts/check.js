const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : walk(full)
    return full.endsWith('.js') ? [full] : []
  })
}

const root = path.join(__dirname, '..')
const files = [...walk(path.join(root, 'src')), ...walk(path.join(root, 'lib'))]
let failed = 0

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' })
  if (result.status !== 0) {
    failed++
    console.error(result.stderr)
  }
}

console.log(`${files.length - failed} of ${files.length} files passed the syntax check.`)
process.exitCode = failed ? 1 : 0
