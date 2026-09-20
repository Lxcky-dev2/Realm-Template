const { MessageFlags, SlashCommandBuilder } = require('discord.js')
const { panels } = require('../ui/panels')
const { defer, edit, updateMessage } = require('../ui/respond')
const { connectRealm } = require('../core/connector')
const { UserError } = require('../utils/errors')
const log = require('../utils/logger')

const data = new SlashCommandBuilder()
  .setName('realm')
  .setDescription('Control the Realm connection')
  .addSubcommand(sub => sub
    .setName('join')
    .setDescription('Join a Realm with your linked account and idle there')
    .addStringOption(option => option
      .setName('realm')
      .setDescription('Realm invite code, invite link, or Realm ID')
      .setRequired(true)))
  .addSubcommand(sub => sub
    .setName('leave')
    .setDescription('Leave the Realm you are currently in'))

async function notifyEnded({ session, reason }) {
  const container = panels.disconnected(session, reason)
  if (await updateMessage(session, container)) return

  await session.interaction.user
    .send({ components: [container], flags: MessageFlags.IsComponentsV2 })
    .catch(() => {})
}

async function join(interaction, { config, accounts, sessions }) {
  const userId = interaction.user.id
  const input = interaction.options.getString('realm', true)

  await defer(interaction, config.ephemeral)

  if (!accounts.has(userId)) return edit(interaction, panels.needsAccount())

  const existing = sessions.get(userId)
  if (existing) return edit(interaction, panels.alreadyInRealm(existing))

  if (sessions.size >= config.maxSessions) return edit(interaction, panels.atCapacity())
  if (!sessions.claim(userId)) {
    return edit(interaction, panels.error('Join in progress', 'A join request from you is already running. Wait for it to finish.'))
  }

  try {
    await edit(interaction, panels.joining(input))
    const session = await connectRealm({ userId, input, accounts, config })
    session.interaction = interaction
    sessions.add(userId, session, notifyEnded)
    session.message = await edit(interaction, panels.joined(session))
    log.info(`User ${userId} joined Realm ${session.info.id}`)
  } catch (error) {
    const failure = error instanceof UserError
      ? error
      : new UserError('Something went wrong', 'The join failed unexpectedly. Check the bot logs for details.')
    if (!(error instanceof UserError)) log.error('Unexpected join error', error)
    await edit(interaction, panels.error(failure.title, failure.message))
  } finally {
    sessions.release(userId)
  }
}

async function leave(interaction, { config, sessions }) {
  await defer(interaction, config.ephemeral)

  const session = await sessions.end(interaction.user.id)
  if (!session) return edit(interaction, panels.notInRealm())

  log.info(`User ${interaction.user.id} left Realm ${session.info.id}`)
  await updateMessage(session, panels.cancelled(session, Date.now()))
  return edit(interaction, panels.left(session))
}

async function execute(interaction, ctx) {
  const subcommand = interaction.options.getSubcommand()
  if (subcommand === 'join') return join(interaction, ctx)
  if (subcommand === 'leave') return leave(interaction, ctx)
}

module.exports = { data, execute }
