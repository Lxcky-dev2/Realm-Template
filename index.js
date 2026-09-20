const major = Number(process.versions.node.split('.')[0])

if (major < 20) {
  console.error(`Node.js 20 or newer is required. You are running ${process.versions.node}.`)
  process.exit(1)
}

require('./src/index.js')