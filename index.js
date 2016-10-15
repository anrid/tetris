'use strict'

const Path = require('path')
const Express = require('express')

const app = Express()
app.use('/', Express.static(Path.join(__dirname, 'public')))

app.listen(3000, () => {
  console.log('Tetris server running on port 3000.')
})
