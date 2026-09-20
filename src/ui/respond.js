const { MessageFlags } = require('discord.js')

const V2 = MessageFlags.IsComponentsV2

const defer = (interaction, ephemeral) =>
  interaction.deferReply(ephemeral ? { flags: MessageFlags.Ephemeral } : {})

const edit = (interaction, container) =>
  interaction.editReply({ components: [container], flags: V2 })

const reply = (interaction, container, ephemeral = true) =>
  interaction.reply({
    components: [container],
    flags: ephemeral ? V2 | MessageFlags.Ephemeral : V2
  })

async function updateMessage(session, container) {
  const payload = { components: [container], flags: V2 }

  try {
    await session.interaction.editReply(payload)
    return true
  } catch {
    try {
      await session.message.edit(payload)
      return true
    } catch {
      return false
    }
  }
}

module.exports = { defer, edit, reply, updateMessage }
