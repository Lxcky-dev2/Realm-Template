const { UserError } = require('../utils/errors')
const { sleep } = require('../utils/async')

const BASE_URL = 'https://pocket.realms.minecraft.net'
const RELYING_PARTY = 'https://pocket.realms.minecraft.net/'
const MAX_JOIN_ATTEMPTS = 6

function parseRealmInput(input) {
  const raw = String(input ?? '').trim()
  const value = raw.split(/[?#]/)[0].split('/').filter(Boolean).pop() ?? ''

  if (/^\d+$/.test(value)) return { type: 'id', value }
  if (/^[\w-]{5,}$/.test(value)) return { type: 'code', value }

  throw new UserError('Invalid Realm', 'Enter a Realm invite code, a Realm invite link, or a numeric Realm ID.')
}

function failFromStatus(status, action) {
  if (status === 401) throw new UserError('Sign in rejected', 'Microsoft rejected the linked account. Run `/account unlink` and then `/account link` again.')
  if (status === 403) throw new UserError('Access denied', 'The linked account is not allowed to join this Realm. Use an invite code, or ask the owner to invite the account.')
  if (status === 404) throw new UserError('Realm not found', 'No Realm matches that code or ID for the linked account.')
  if (status === 410) throw new UserError('Realm expired', 'This Realm\u2019s subscription has expired. Ask the owner to renew it.')
  if (status === 429) throw new UserError('Rate limited', 'Realms is rate limiting requests. Wait a moment and try again.')
  if (status >= 500) throw new UserError('Realms unavailable', 'The Realms service is having problems right now. Try again in a few minutes.')
  throw new UserError('Realms error', `${action} failed with status ${status}.`)
}

const stripFormatting = value => String(value ?? '').replace(/\u00a7./g, '').trim()

function normalizeRealm(data) {
  if (!data?.id) throw new UserError('Realm not found', 'The Realms service returned no Realm for that code or ID.')
  return {
    id: String(data.id),
    name: stripFormatting(data.name) || `Realm ${data.id}`,
    owner: data.owner ?? null,
    state: typeof data.state === 'string' ? data.state.toUpperCase() : null,
    expired: Boolean(data.expired),
    expiredTrial: Boolean(data.expiredTrial)
  }
}

// Catches the common, friendly-nameable failures up front instead of letting
// them fall through to a generic HTTP-status error later in the join flow.
// NOTE: "full" is deliberately not checked here. The Realms API's `players`
// field is the Realm's member/allowlist, not who is currently online, so it
// can't tell us that reliably. The accurate, real-time signal for a full
// Realm is the game protocol's `server_full` disconnect reason, which is
// already handled in disconnect-reasons.js once the bot actually connects.
function assertJoinable(realm) {
  if (realm.expired || realm.expiredTrial) {
    throw new UserError('Realm expired', 'This Realm\u2019s subscription has expired. Ask the owner to renew it.')
  }
  if (realm.state === 'CLOSED') {
    throw new UserError('Realm closed', 'This Realm is currently closed by its owner. Try again later, or ask them to open it.')
  }
  if (realm.state === 'UNINITIALIZED') {
    throw new UserError('Realm not set up', 'This Realm has not finished being set up by its owner yet.')
  }
}

function normalizeConnection(data) {
  const address = String(data?.address ?? '')
  const transport = String(data?.networkProtocol ?? (/^nethernet:\/\//i.test(address) ? 'NETHERNET' : 'RAKNET')).toUpperCase()

  if (!transport.includes('NETHERNET')) {
    throw new UserError('Unsupported Realm', 'This Realm does not use NetherNet, which is the only transport this bot supports.')
  }

  const networkId = address.replace(/^nethernet:\/\//i, '').trim()
  if (!networkId) throw new UserError('Realm unavailable', 'The Realms service did not return a connection address.')

  return { transport, networkId, address }
}

class RealmsClient {
  constructor(authflow, version) {
    this.authflow = authflow
    this.version = version
  }

  async #request(method, route) {
    let auth
    try {
      auth = await this.authflow.getXboxToken(RELYING_PARTY)
    } catch (error) {
      if (error instanceof UserError) throw error
      throw new UserError('Sign in rejected', 'Microsoft rejected the linked account. Run `/account unlink` and then `/account link` again.')
    }

    try {
      return await fetch(`${BASE_URL}${route}`, {
        method,
        headers: {
          Authorization: `XBL3.0 x=${auth.userHash};${auth.XSTSToken}`,
          'Client-Version': this.version,
          'User-Agent': 'MCPE/UWP',
          Accept: '*/*',
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      })
    } catch (error) {
      throw new UserError('Realms unreachable', 'Could not reach the Minecraft Realms service. Check the network connection and try again.')
    }
  }

  async resolve(target) {
    if (target.type === 'code') {
      const code = encodeURIComponent(target.value)
      const response = await this.#request('GET', `/worlds/v1/link/${code}`)
      if (!response.ok) failFromStatus(response.status, 'Looking up the invite code')
      const realm = normalizeRealm(await response.json())
      assertJoinable(realm)
      await this.#request('POST', `/invites/v1/link/accept/${code}`).catch(() => null)
      return realm
    }

    const response = await this.#request('GET', `/worlds/${target.value}`)
    if (!response.ok) failFromStatus(response.status, 'Looking up the Realm')
    const realm = normalizeRealm(await response.json())
    assertJoinable(realm)
    return realm
  }

  async getConnection(realmId) {
    for (let attempt = 1; attempt <= MAX_JOIN_ATTEMPTS; attempt++) {
      const response = await this.#request('GET', `/worlds/${realmId}/join`)

      if (response.status === 503) {
        const wait = Number(response.headers.get('retry-after')) || 5
        await sleep(Math.min(wait, 15) * 1000)
        continue
      }

      if (!response.ok) failFromStatus(response.status, 'Requesting the join address')
      return normalizeConnection(await response.json())
    }

    throw new UserError('Realm unavailable', 'The Realm is still starting up. Try again in a minute.')
  }
}

module.exports = { RealmsClient, parseRealmInput }
