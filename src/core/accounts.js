const fs = require('fs')
const path = require('path')
const { Authflow } = require('prismarine-auth')
const { DEFAULT_DEVICE_PROFILE } = require('../../lib/lxcky')
const { JsonStore } = require('./store')
const { withTimeout } = require('../utils/async')
const { RelinkRequiredError } = require('../utils/errors')
const log = require('../utils/logger')

class AccountManager {
  constructor(config) {
    this.config = config
    this.store = new JsonStore(path.join(config.dataDir, 'accounts.json'))
  }

  authDir(userId) {
    return path.join(this.config.dataDir, 'auth', String(userId))
  }

  get(userId) {
    return this.store.get(String(userId))
  }

  has(userId) {
    return Boolean(this.get(userId))
  }

  createAuthflow(userId, onCode) {
    return new Authflow(String(userId), this.authDir(userId), {
      flow: 'sisu',
      authTitle: DEFAULT_DEVICE_PROFILE.authTitle,
      deviceType: DEFAULT_DEVICE_PROFILE.deviceType
    }, onCode)
  }

  authflowForJoin(userId) {
    let fail
    const relinkRequired = new Promise((_, reject) => { fail = reject })
    relinkRequired.catch(() => {})
    const authflow = this.createAuthflow(userId, () => fail(new RelinkRequiredError()))
    return { authflow, relinkRequired }
  }

  async link(userId, { onCode }) {
    const authflow = this.createAuthflow(userId, onCode)
    try {
      const xbox = await withTimeout(
        authflow.getXboxToken(),
        this.config.linkTimeoutMs,
        'The Microsoft sign in was not completed in time. Run `/account link` to try again.'
      )
      const profile = await fetchProfile(xbox)
      const record = {
        xuid: xbox.userXUID ?? null,
        gamertag: profile.gamertag,
        avatarUrl: profile.avatarUrl,
        linkedAt: Date.now()
      }
      this.store.set(String(userId), record)
      return record
    } catch (error) {
      fs.rmSync(this.authDir(userId), { recursive: true, force: true })
      throw error
    }
  }

  unlink(userId) {
    const record = this.get(userId)
    fs.rmSync(this.authDir(userId), { recursive: true, force: true })
    this.store.delete(String(userId))
    return record
  }
}

function normalizeImage(url) {
  if (!url) return null
  return String(url)
    .replace(/^http:\/\//i, 'https://')
    .replace('images-eds.xboxlive.com', 'images-eds-ssl.xboxlive.com')
}

async function fetchProfile({ userHash, XSTSToken }) {
  const empty = { gamertag: null, avatarUrl: null }
  try {
    const response = await fetch('https://profile.xboxlive.com/users/me/profile/settings?settings=Gamertag,GameDisplayPicRaw', {
      headers: {
        Authorization: `XBL3.0 x=${userHash};${XSTSToken}`,
        'x-xbl-contract-version': '2',
        Accept: 'application/json'
      }
    })
    if (!response.ok) return empty

    const body = await response.json()
    const settings = body.profileUsers?.[0]?.settings ?? []
    const read = id => settings.find(setting => setting.id === id)?.value ?? null

    return { gamertag: read('Gamertag'), avatarUrl: normalizeImage(read('GameDisplayPicRaw')) }
  } catch (error) {
    log.warn('Could not fetch Xbox profile', error.message)
    return empty
  }
}

module.exports = { AccountManager }
