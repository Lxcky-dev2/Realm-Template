const { Client, Events, GatewayIntentBits, MessageFlags } = require('discord.js')
const { config, requireConfig } = require('./config')
const { loadCommands } = require('./commands')
const { AccountManager } = require('./core/accounts')
const { SessionManager } = require('./core/sessions')
const { registerCommands } = require('./core/register')
const { panels } = require('./ui/panels')
const { edit, reply, updateMessage } = require('./ui/respond')
const log = require('./utils/logger')

requireConfig('token')

const client = new Client({ intents: [GatewayIntentBits.Guilds] })
const commands = loadCommands()
const ctx = {
  config,
  client,
  accounts: new AccountManager(config),
  sessions: new SessionManager()
}

async function handleButton(interaction) {
  const [scope, action, ownerId] = interaction.customId.split(':')
  if (scope !== 'realm' || action !== 'leave') return

  if (interaction.user.id !== ownerId) return reply(interaction, panels.notYours())

  await interaction.deferUpdate()
  const session = await ctx.sessions.end(ownerId)
  if (!session) return edit(interaction, panels.notInRealm())

  await updateMessage(session, panels.cancelled(session, Date.now()))
  if (interaction.message.id !== session.message?.id) await edit(interaction, panels.left(session))
}

async function reportFailure(interaction) {
  const container = panels.error('Something went wrong', 'The command failed unexpectedly. Try again in a moment.')
  try {
    if (interaction.deferred || interaction.replied) await edit(interaction, container)
    else await reply(interaction, container)
  } catch (error) {
    log.warn('Could not report failure', error.message)
  }
}

client.once(Events.ClientReady, async ready => {
  panels.setIcon(ready.user.displayAvatarURL({ extension: 'png', size: 256 }))
  log.info(`Logged in as ${ready.user.tag} with ${commands.size} commands loaded`)

  if (!config.autoDeploy) return

  try {
    const { count, scope } = await registerCommands({ ...config, clientId: config.clientId ?? ready.user.id }, commands)
    log.info(`Registered ${count} slash commands ${scope}`)
  } catch (error) {
    log.error('Could not register slash commands', error)
  }
})

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      await commands.get(interaction.commandName)?.execute(interaction, ctx)
    } else if (interaction.isButton()) {
      await handleButton(interaction)
    }
  } catch (error) {
    log.error('Interaction failed', error)
    await reportFailure(interaction)
  }
})

async function shutdown(signal) {
  log.info(`Received ${signal}, disconnecting from Realms`)
  await ctx.sessions.endAll().catch(() => {})
  await client.destroy()
  process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('unhandledRejection', error => log.error('Unhandled rejection', error))
process.on('uncaughtException', error => log.error('Uncaught exception', error))

client.login(config.token)
