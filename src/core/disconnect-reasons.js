// Friendly titles/messages for the Bedrock protocol's DisconnectFailReason enum
// (see lib/lxcky/protocol/protocol/protocol.json -> types.DisconnectFailReason).
// protodef decodes the packet's numeric reason into one of these string keys
// automatically, so `data.reason` below is already the mapped name.
const REASONS = {
  no_permissions: ['Access denied', 'The linked account is not allowed to join this Realm. Use an invite code, or ask the owner to invite the account.'],
  not_allowed: ['Access denied', 'The linked account is not allowed to join this Realm. Use an invite code, or ask the owner to invite the account.'],
  server_full: ['Realm full', 'This Realm is currently full. Try again later.'],
  realms_server_disabled: ['Realm closed', 'This Realm is currently closed by its owner. Try again later.'],
  realms_server_disabled_beta: ['Realm closed', 'This Realm is closed for players on this game version.'],
  realms_server_hidden: ['Realm closed', 'This Realm is currently hidden by its owner.'],
  realms_world_unassigned: ['Realm not set up', 'This Realm has not finished being set up yet.'],
  realms_server_cant_connect: ['Realm unavailable', 'The Realm server could not be reached. Try again in a moment.'],
  host_suspended: ['Realm suspended', 'The Realm owner\u2019s subscription is suspended.'],
  session_not_found: ['Realm offline', 'The Realm session could not be found. It may be offline or restarting.'],
  invite_session_not_found: ['Invite invalid', 'That invite session could not be found. Ask the owner for a fresh invite.'],
  conn_session_not_found: ['Realm offline', 'The Realm session could not be found. It may be offline or restarting.'],
  cant_connect: ['Could not connect', 'The bot could not connect to the Realm. Try again in a moment.'],
  cant_connect_no_internet: ['Connection lost', 'The bot lost its network connection while connecting.'],
  third_party_blocked: ['Connection blocked', 'The connection to the Realm was blocked by the network.'],
  third_party_no_internet: ['Connection lost', 'The bot lost its network connection while connecting.'],
  third_party_bad_ip: ['Could not connect', 'The Realm\u2019s address could not be reached.'],
  third_party_no_server_or_server_locked: ['Could not connect', 'The Realm server could not be reached, or is locked.'],
  server_not_found: ['Realm offline', 'The Realm server could not be found. It may be offline.'],
  local_server_not_found: ['Realm offline', 'The Realm server could not be found. It may be offline.'],
  timeout: ['Connection timed out', 'The Realm did not respond in time. Try again.'],
  loading_state_timeout: ['Connection timed out', 'The Realm took too long to load the world. Try again.'],
  connection_lost: ['Connection lost', 'The connection to the Realm was lost.'],
  zombie_connection: ['Connection lost', 'The connection to the Realm stopped responding.'],
  no_wifi: ['Connection lost', 'The bot lost its network connection.'],
  disconnected: ['Disconnected', 'The Realm disconnected the bot.'],
  kicked: ['Kicked', 'The bot was kicked from the Realm.'],
  kicked_for_idle: ['Kicked for being idle', 'The bot was removed from the Realm for being idle.'],
  kicked_for_exploit: ['Kicked', 'The bot was removed from the Realm for suspected exploiting.'],
  logged_in_other_location: ['Already connected', 'This linked account is already connected to the Realm somewhere else.'],
  version_mismatch: ['Version mismatch', 'The bot\u2019s Minecraft version does not match this Realm.'],
  outdated_client: ['Version mismatch', 'The bot\u2019s Minecraft version is older than what this Realm requires.'],
  outdated_server: ['Version mismatch', 'This Realm is running an older Minecraft version than the bot supports.'],
  edition_mismatch: ['Wrong edition', 'This Realm is not a Bedrock Edition Realm.'],
  edition_version_mismatch: ['Version mismatch', 'This Realm requires a different game version than the bot supports.'],
  level_newer_than_exe_version: ['Version mismatch', 'This Realm\u2019s world was created with a newer Minecraft version than the bot supports.'],
  banned_skin: ['Skin rejected', 'The Realm rejected the bot\u2019s skin.'],
  platform_locked_skins_error: ['Skin rejected', 'The Realm rejected the bot\u2019s skin.'],
  invalid_platform_skin: ['Skin rejected', 'The Realm rejected the bot\u2019s skin.'],
  resource_pack_problem: ['Resource pack error', 'The Realm requires a resource pack the bot could not load.'],
  incompatible_pack: ['Resource pack error', 'The Realm requires a resource pack the bot is not compatible with.'],
  resource_pack_loading_failed: ['Resource pack error', 'The Realm requires a resource pack the bot could not load.'],
  world_corruption: ['World error', 'The Realm reported that its world is corrupted.'],
  block_mismatch: ['World error', 'The Realm\u2019s world data does not match what the bot supports.'],
  invalid_heights: ['World error', 'The Realm\u2019s world data does not match what the bot supports.'],
  invalid_widths: ['World error', 'The Realm\u2019s world data does not match what the bot supports.'],
  shutdown: ['Realm shutting down', 'The Realm server is shutting down.'],
  multiplayer_disabled: ['Multiplayer disabled', 'Multiplayer is disabled for this account or Realm.'],
  not_authenticated: ['Sign in rejected', 'Microsoft rejected the linked account. Run `/account unlink` and then `/account link` again.'],
  invalid_tenant: ['Sign in rejected', 'Microsoft rejected the linked account. Run `/account unlink` and then `/account link` again.'],
  expired_auth_from_discovery: ['Sign in expired', 'The linked account\u2019s sign in expired. Run `/account unlink` and then `/account link` again.'],
  empty_auth_from_discovery: ['Sign in rejected', 'Microsoft rejected the linked account. Run `/account unlink` and then `/account link` again.'],
  xbl_join_lobby_failure: ['Could not connect', 'Xbox Live rejected the attempt to join this Realm.']
}

const titleCase = value => String(value ?? '')
  .replace(/_/g, ' ')
  .replace(/\b\w/g, char => char.toUpperCase())

const isTranslationKey = value => /^[a-zA-Z]+(\.[a-zA-Z0-9]+)+$/.test(value)

// data comes from the protocol's `disconnect` packet params: { reason, message, filtered_message }
function describeDisconnect(data) {
  const reason = typeof data?.reason === 'string' ? data.reason.toLowerCase() : null
  const rawMessage = typeof data?.message === 'string' ? data.message.trim() : ''

  const known = reason ? REASONS[reason] : null
  if (known) return { title: known[0], message: known[1] }

  // A readable, non-translation-key message from the Realm is worth showing as-is.
  if (rawMessage && !isTranslationKey(rawMessage)) {
    return { title: 'Disconnected by the Realm', message: rawMessage }
  }

  if (reason && !['no_reason', 'unknown', 'reason_not_set', 'no_fail_occurred'].includes(reason)) {
    return { title: titleCase(reason), message: `The Realm disconnected the bot (${titleCase(reason).toLowerCase()}).` }
  }

  return { title: 'Disconnected by the Realm', message: 'The Realm refused the connection.' }
}

module.exports = { describeDisconnect }
