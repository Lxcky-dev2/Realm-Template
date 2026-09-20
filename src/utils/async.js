const { UserError } = require('./errors')

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

function withTimeout(promise, ms, message) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new UserError('Timed out', message)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

module.exports = { sleep, withTimeout }
