const { SlashCommandBuilder } = require('discord.js')
const { panels } = require('../ui/panels')
const { defer, edit, updateMessage } = require('../ui/respond')
const { UserError } = require('../utils/errors')
const log = require('../utils/logger')

const data = new SlashCommandBuilder()
  .setName('account')
  .setDescription('Manage the Microsoft account the bot uses to join Realms')
  .addSubcommand(sub => sub
    .setName('link')
    .setDescription('Link a Microsoft account for the bot to use'))
  .addSubcommand(sub => sub
    .setName('unlink')
    .setDescription('Remove your linked account and its saved sign in data'))

const linking = new Set()

function prefillCode(uri, code) {
  if (!/^[A-Za-z0-9]{6,12}$/.test(code)) return uri
  try {
    const url = new URL(uri)
    url.searchParams.set('otc', code)
    return url.toString()
  } catch {
    return uri
  }
}

function readDeviceCode(response) {
  const message = response.message ?? ''
  const code = response.userCode ?? response.user_code ?? message.match(/enter the code (\S+)/i)?.[1] ?? 'See the link'
  const uri = response.verificationUri ?? response.verification_uri ?? 'https://www.microsoft.com/link'

  return {
    code,
    uri: prefillCode(uri, code),
    minutes: Math.max(1, Math.round((response.expiresIn ?? response.expires_in ?? 900) / 60))
  }
}

async function link(interaction, { accounts }) {
  const userId = interaction.user.id

  await defer(interaction, true)

  const existing = accounts.get(userId)
  if (existing) return edit(interaction, panels.alreadyLinked(existing))
  if (linking.has(userId)) return edit(interaction, panels.linkInProgress())

  linking.add(userId)
  try {
    const record = await accounts.link(userId, {
      onCode: response => {
        edit(interaction, panels.linkPrompt(readDeviceCode(response)))
          .catch(error => log.warn('Could not show link code', error.message))
      }
    })
    log.info(`User ${userId} linked an account`)
    await edit(interaction, panels.linked(record))
  } catch (error) {
    if (!(error instanceof UserError)) log.error('Account link failed', error)
    const failure = error instanceof UserError
      ? error
      : new UserError('Link failed', 'The Microsoft sign in could not be completed. Run `/account link` to try again.')
    await edit(interaction, panels.error(failure.title, failure.message))
  } finally {
    linking.delete(userId)
  }
}

async function unlink(interaction, { accounts, sessions }) {
  const userId = interaction.user.id

  await defer(interaction, true)

  if (!accounts.has(userId)) return edit(interaction, panels.notLinked())

  const session = await sessions.end(userId, 'Account unlinked')
  if (session) await updateMessage(session, panels.cancelled(session, Date.now()))
  const record = accounts.unlink(userId)
  log.info(`User ${userId} unlinked an account`)
  return edit(interaction, panels.unlinked(record, Boolean(session)))
}

async function execute(interaction, ctx) {
  const subcommand = interaction.options.getSubcommand()
  if (subcommand === 'link') return link(interaction, ctx)
  if (subcommand === 'unlink') return unlink(interaction, ctx)
}

module.exports = { data, execute }
