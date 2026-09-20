const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  ThumbnailBuilder,
  escapeMarkdown
} = require('discord.js')

const COLORS = {
  primary: 0x5865f2,
  success: 0x57f287,
  warning: 0xfee75c,
  danger: 0xed4245,
  neutral: 0x99aab5
}

const brand = { iconUrl: null }

const text = content => new TextDisplayBuilder().setContent(content)
const divider = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
const bold = value => `**${escapeMarkdown(String(value))}**`
const code = value => `\`${String(value).replace(/`/g, "'").slice(0, 80)}\``

function panel({ color, title, description, fields = [], rows = [], thumbnail }) {
  const icon = thumbnail ?? brand.iconUrl
  const container = new ContainerBuilder().setAccentColor(color)
  const header = [text(`## ${title}`)]
  if (description) header.push(text(description))

  if (icon) {
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(...header)
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(icon))
    )
  } else {
    container.addTextDisplayComponents(...header)
  }

  if (fields.length) {
    container.addSeparatorComponents(divider())
    container.addTextDisplayComponents(
      text(fields.map(field => `**${field.name}**\n${field.value}`).join('\n\n'))
    )
  }

  if (rows.length) {
    container.addSeparatorComponents(divider())
    for (const row of rows) container.addActionRowComponents(row)
  }

  return container
}

const leaveButton = userId => new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId(`realm:leave:${userId}`)
    .setLabel('Leave Realm')
    .setStyle(ButtonStyle.Danger)
)

const panels = {
  setIcon(url) {
    brand.iconUrl = url
  },

  error(title, message) {
    return panel({ color: COLORS.danger, title, description: message })
  },

  notYours() {
    return panel({
      color: COLORS.danger,
      title: 'Not your session',
      description: 'Only the person who started this connection can use this button.'
    })
  },

  needsAccount() {
    return panel({
      color: COLORS.warning,
      title: 'No account linked',
      description: 'Link a Microsoft account before joining a Realm. The bot uses it to connect.',
      fields: [{ name: 'Next step', value: 'Run `/account link` and follow the instructions.' }]
    })
  },

  atCapacity() {
    return panel({
      color: COLORS.warning,
      title: 'Bot is full',
      description: 'Every connection slot is in use right now. Try again in a little while.'
    })
  },

  alreadyInRealm(session) {
    return panel({
      color: COLORS.warning,
      title: 'Already in a Realm',
      description: `You already have an active connection to ${bold(session.info.name)}. Leave it before joining another Realm.`,
      rows: [leaveButton(session.userId)]
    })
  },

  joining(target) {
    return panel({
      color: COLORS.primary,
      title: 'Joining Realm',
      description: 'Looking up the Realm and connecting with your linked account. This can take up to a minute.',
      fields: [{ name: 'Target', value: code(target) }]
    })
  },

  joined(session) {
    return panel({
      color: COLORS.success,
      title: 'Connected',
      description: `The bot is now idling in ${bold(session.info.name)}.`,
      fields: [
        { name: 'Realm ID', value: code(session.info.id) },
        { name: 'Account', value: bold(session.account.gamertag ?? 'Linked account') },
        { name: 'Connected', value: `<t:${Math.floor(session.joinedAt / 1000)}:R>` }
      ],
      rows: [leaveButton(session.userId)]
    })
  },

  left(session) {
    return panel({
      color: COLORS.neutral,
      title: 'Left Realm',
      description: `Disconnected from ${bold(session.info.name)}.`
    })
  },

  cancelled(session, leftAt) {
    const stamp = Math.floor(leftAt / 1000)
    return panel({
      color: COLORS.neutral,
      title: 'Cancelled',
      description: `The bot has left ${bold(session.info.name)} at <t:${stamp}:T> (<t:${stamp}:R>).`,
      fields: [{ name: 'Realm ID', value: code(session.info.id) }]
    })
  },

  notInRealm() {
    return panel({
      color: COLORS.warning,
      title: 'Not in a Realm',
      description: 'You do not have an active Realm connection.'
    })
  },

  disconnected(session, reason) {
    return panel({
      color: COLORS.danger,
      title: 'Disconnected',
      description: `The connection to ${bold(session.info.name)} ended.`,
      fields: reason ? [{ name: 'Reason', value: escapeMarkdown(String(reason).slice(0, 300)) }] : []
    })
  },

  linkPrompt({ code: userCode, uri, minutes }) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Open Microsoft Sign In')
        .setStyle(ButtonStyle.Link)
        .setURL(uri)
    )

    return panel({
      color: COLORS.primary,
      title: 'Link your Microsoft account',
      description: 'Sign in with the account you want the bot to use when it joins Realms.',
      fields: [
        { name: 'Step 1', value: 'Open the sign in page with the button below.' },
        { name: 'Step 2', value: `Enter this code:\n\`\`\`\n${userCode}\n\`\`\`` },
        { name: 'Step 3', value: `Approve the sign in. The code expires in about ${minutes} minutes.` }
      ],
      rows: [row]
    })
  },

  linked(record) {
    return panel({
      color: COLORS.success,
      title: 'Account linked',
      description: `Signed in as ${bold(record.gamertag ?? 'your Xbox account')}. Realm joins will now use this account.`,
      fields: [{ name: 'Next step', value: 'Run `/realm join` with a Realm code or Realm ID.' }],
      thumbnail: record.avatarUrl
    })
  },

  alreadyLinked(record) {
    return panel({
      color: COLORS.warning,
      title: 'Account already linked',
      description: `You are linked as ${bold(record.gamertag ?? 'your Xbox account')}. Run \`/account unlink\` first if you want to switch accounts.`,
      thumbnail: record.avatarUrl
    })
  },

  linkInProgress() {
    return panel({
      color: COLORS.warning,
      title: 'Link already in progress',
      description: 'Finish the sign in you already started, or wait for its code to expire.'
    })
  },

  unlinked(record, leftRealm) {
    return panel({
      color: COLORS.success,
      title: 'Account unlinked',
      description: `Removed ${bold(record.gamertag ?? 'your Xbox account')} and deleted its saved sign in data.`,
      fields: leftRealm ? [{ name: 'Realm', value: 'Your active Realm connection was closed.' }] : [],
      thumbnail: record.avatarUrl
    })
  },

  notLinked() {
    return panel({
      color: COLORS.warning,
      title: 'No account linked',
      description: 'There is no linked account to remove.'
    })
  }
}

module.exports = { panels }
