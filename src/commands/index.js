const fs = require('fs')
const path = require('path')

function loadCommands() {
  const commands = new Map()
  for (const file of fs.readdirSync(__dirname)) {
    if (!file.endsWith('.js') || file === 'index.js') continue
    const command = require(path.join(__dirname, file))
    commands.set(command.data.name, command)
  }
  return commands
}

module.exports = { loadCommands }
