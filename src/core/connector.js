const { Realm } = require('../../lib/lxcky')
const { RealmsClient, parseRealmInput } = require('./realms')
const { describeDisconnect } = require('./disconnect-reasons')
const { UserError } = require('../utils/errors')
const log = require('../utils/logger')

function waitForSpawn(realm, timeoutMs) {
  let cancel = () => {}

  const promise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(reject, new UserError('Connection timed out', 'The Realm did not respond in time. Make sure the Realm is online and try again.')), timeoutMs)

    const onConnected = () => finish(resolve)
    const onKick = data => {
      const { title, message } = describeDisconnect(data)
      finish(reject, new UserError(title, message))
    }
    const onClose = reason => finish(reject, new UserError('Connection closed', typeof reason === 'string' && reason ? reason : 'The connection closed before the bot could spawn.'))

    function finish(settle, value) {
      clearTimeout(timer)
      realm.off('connected', onConnected)
      realm.off('kick', onKick)
      realm.off('close', onClose)
      settle(value)
    }

    cancel = () => finish(() => {})

    realm.on('connected', onConnected)
    realm.on('kick', onKick)
    realm.on('close', onClose)
  })

  promise.catch(() => {})
  return { promise, cancel }
}

function toUserError(error) {
  if (error instanceof UserError) return error
  const message = String(error?.message ?? error)
  const code = error?.code

  if (/FORBIDDEN|PlayerBanned/i.test(message)) {
    return new UserError('Account refused', 'Minecraft multiplayer services refused this account.')
  }

  if (code === 'ENOTFOUND' || code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'EAI_AGAIN') {
    return new UserError('Connection failed', 'Could not reach the Realm\u2019s server. The Realm may be offline, or the network is unavailable.')
  }

  if (code === 'ETIMEDOUT' || /timed? ?out/i.test(message)) {
    return new UserError('Connection timed out', 'The Realm did not respond in time. Try again.')
  }

  log.error('Realm connection failed', error)
  return new UserError('Connection failed', message.replace(/[-\u2013\u2014]/g, ' ').slice(0, 300))
}

async function connectRealm({ userId, input, accounts, config }) {
  const target = parseRealmInput(input)
  const account = accounts.get(userId)
  const { authflow, relinkRequired } = accounts.authflowForJoin(userId)
  const race = promise => Promise.race([promise, relinkRequired])

  try {
    const realms = new RealmsClient(authflow, config.minecraftVersion)
    const info = await race(realms.resolve(target))
    const connection = await race(realms.getConnection(info.id))

    const realm = new Realm({
      authflow,
      info,
      connection,
      xuid: account.xuid,
      gamertag: account.gamertag
    })

    realm.on('error', error => log.warn('Realm client error', error?.message ?? error))

    const spawn = waitForSpawn(realm, config.joinTimeoutMs)

    try {
      await race(realm.join())
      await race(spawn.promise)
    } catch (error) {
      spawn.cancel()
      await realm.leave('Join failed').catch(() => {})
      throw error
    }

    return { userId, realm, info, account, joinedAt: Date.now() }
  } catch (error) {
    throw toUserError(error)
  }
}

module.exports = { connectRealm }
