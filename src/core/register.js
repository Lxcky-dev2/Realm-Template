const { REST, Routes } = require('discord.js')

async function registerCommands({ token, clientId, guildId }, commands) {
  const body = [...commands.values()].map(command => command.data.toJSON())
  const rest = new REST({ version: '10' }).setToken(token)

  const route = guildId
    ? Routes.applicationGuildCommands(clientId, guildId)
    : Routes.applicationCommands(clientId)

  await rest.put(route, { body })
  return { count: body.length, scope: guildId ? `guild ${guildId}` : 'globally' }
}

module.exports = { registerCommands }