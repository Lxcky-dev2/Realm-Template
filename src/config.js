const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const file = path.join(root, 'config.json')

function load() {
  if (!fs.existsSync(file)) {
    throw new Error('config.json was not found. Copy config.example.json to config.json and fill it in.')
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    throw new Error(`config.json is not valid JSON: ${error.message}`)
  }
}

const raw = load()

const config = {
  token: raw.token || null,
  clientId: raw.clientId || null,
  guildId: raw.guildId || null,
  autoDeploy: true,
  ephemeral: false,
  maxSessions: 10,
  joinTimeoutMs: 45 * 1000,
  dataDir: path.join(root, 'data'),
  linkTimeoutMs: 5 * 60 * 1000,
  minecraftVersion: '1.26.50'
}

function requireConfig(...keys) {
  const missing = keys.filter(key => !config[key])
  if (missing.length) {
    throw new Error(`Missing ${missing.join(', ')} in config.json. Fill it in and start again.`)
  }
}

module.exports = { config, requireConfig }