const fs = require('fs')
const path = require('path')

class JsonStore {
  constructor(file) {
    this.file = file
    fs.mkdirSync(path.dirname(file), { recursive: true })
    this.data = this.#load()
  }

  #load() {
    try {
      return JSON.parse(fs.readFileSync(this.file, 'utf8'))
    } catch {
      return {}
    }
  }

  #save() {
    const temp = `${this.file}.tmp`
    fs.writeFileSync(temp, JSON.stringify(this.data, null, 2))
    fs.renameSync(temp, this.file)
  }

  get(key) {
    return this.data[key] ?? null
  }

  set(key, value) {
    this.data[key] = value
    this.#save()
  }

  delete(key) {
    if (!(key in this.data)) return false
    delete this.data[key]
    this.#save()
    return true
  }
}

module.exports = { JsonStore }
