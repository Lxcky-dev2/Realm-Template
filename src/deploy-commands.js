const { config, requireConfig } = require('./config')
const { loadCommands } = require('./commands')
const { registerCommands } = require('./core/register')

async function main() {
  requireConfig('token', 'clientId')
  const { count, scope } = await registerCommands(config, loadCommands())
  console.log(`Registered ${count} commands ${scope}.`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})