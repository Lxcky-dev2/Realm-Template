class UserError extends Error {
  constructor(title, message) {
    super(message)
    this.name = 'UserError'
    this.title = title
  }
}

class RelinkRequiredError extends UserError {
  constructor() {
    super('Sign in expired', 'Microsoft no longer accepts the saved sign in for your account. Run `/account unlink` and then `/account link` again.')
    this.name = 'RelinkRequiredError'
  }
}

module.exports = { UserError, RelinkRequiredError }
