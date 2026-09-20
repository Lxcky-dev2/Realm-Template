const log = require('../utils/logger')
const { describeDisconnect } = require('./disconnect-reasons')

function describeKick(data) {
  if (!data) return null
  return describeDisconnect(data).message
}

class SessionManager {
  constructor() {
    this.sessions = new Map()
    this.pending = new Set()
  }

  get size() {
    return this.sessions.size + this.pending.size
  }

  get(userId) {
    return this.sessions.get(String(userId)) ?? null
  }

  busy(userId) {
    return this.sessions.has(String(userId)) || this.pending.has(String(userId))
  }

  claim(userId) {
    if (this.busy(userId)) return false
    this.pending.add(String(userId))
    return true
  }

  release(userId) {
    this.pending.delete(String(userId))
  }

  add(userId, session, onEnded) {
    const key = String(userId)
    this.sessions.set(key, session)

    let kickReason = null
    session.realm.on('kick', data => { kickReason = describeKick(data) })
    session.realm.on('close', reason => {
      if (this.sessions.get(key) !== session) return
      this.sessions.delete(key)
      onEnded?.({ session, reason: kickReason ?? (typeof reason === 'string' ? reason : null) })
    })
  }

  async end(userId, reason = 'Left by user') {
    const key = String(userId)
    const session = this.sessions.get(key)
    if (!session) return null

    this.sessions.delete(key)
    try {
      await session.realm.leave(reason)
    } catch (error) {
      log.warn('Error while leaving Realm', error.message)
    }
    return session
  }

  async endAll(reason = 'Bot shutting down') {
    await Promise.all([...this.sessions.keys()].map(userId => this.end(userId, reason)))
  }
}

module.exports = { SessionManager, describeKick }
