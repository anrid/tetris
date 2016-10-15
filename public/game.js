/* globals Image */
'use strict'

const SPRITE_BLOCK_SIZE = 32
const BOARD_HEIGHT = 864 / 2
const BOARD_WIDTH = 832
const SCALE = 2
const SZ = SPRITE_BLOCK_SIZE
const SX = SZ * SCALE
const BLOCK_SIZE = SPRITE_BLOCK_SIZE / 4
const GAME_SPEED = 1000 / 10 // FPS !
const MAX_RUNTIME = 60000

const pieces = createPieces()
const tetraminos = { 'LB': 2, 'LL': 4, 'LR': 4, 'CU': 1, 'SR': 2, 'TR': 4, 'SL': 2 }

const ctx = document.getElementById('game').getContext('2d')
// ctx.globalCompositeOperation = 'destination-over'

const inputs = {
  keyBuffer: []
}
const stats = {
  runningSince: Date.now(),
  runtime: 0
}

runGame()

function runGame () {
  console.log('Tetris is running.')
  init()
  .then(sprites => {
    const game = createNewGame(sprites)
    runGameLoop(game)
  })
}

function runGameLoop (game) {
  const interval = setInterval(() => {
    moveAndRotatePiece(game)
    draw(game)
    stats.runtime = Date.now() - stats.runningSince
    if (stats.runtime > MAX_RUNTIME) {
      clearInterval(interval)
      console.log('Game engine stopped, stats:', stats)
    }
  }, GAME_SPEED)
}

function createNewGame (sprites) {
  const gameRows = Math.ceil(BOARD_HEIGHT / (BLOCK_SIZE * SCALE))
  const game = {
    sprites,
    board: {
      x: BOARD_WIDTH / 2,
      y: 0,
      w: BOARD_WIDTH / 2,
      h: gameRows * BLOCK_SIZE * SCALE
    },
    bag: getRandomBagOfTetraminos().slice(0, 5),
    current: null,
    index: 0
  }

  // Additional data.
  game.maxCols = Math.floor(game.board.w / (BLOCK_SIZE * SCALE))

  console.log('New game:', game)
  return game
}

function getPieceFromBag (game) {
  // Refill bag if there are only 2 pieces remaining.
  if (game.index === game.bag.length - 2) {
    // Keep the last 2 pieces and add a bunch of new ones.
    game.bag = game.bag.slice(-2).concat(getRandomBagOfTetraminos())
    game.index = 0
    console.log('Generated new bag.')
  }

  const piece = {
    type: game.bag[game.index],
    rotation: 1,
    row: 0,
    col: 0
  }

  // Start this piece right smack in the middle.
  piece.col = Math.floor(game.maxCols / 2 - getPieceColWidth(piece) / 2)

  game.index++
  console.log('Got new piece:', piece)
  return piece
}

function getPieceColWidth (piece) {
  const spriteId = piece.type + piece.rotation
  const sprite = pieces[spriteId]
  return Math.floor(sprite.w / BLOCK_SIZE)
}

function moveAndRotatePiece (game) {
  if (game.current) {
    const possibleRotations = tetraminos[game.current.type]
    const maxCols = Math.floor(game.board.w / BLOCK_SIZE)
    let r = game.current.rotation
    let col = game.current.col
    inputs.keyBuffer.forEach(key => {
      if (key === 'up') r--
      if (key === 'down') r++
      if (r < 1) r = possibleRotations
      if (r > possibleRotations) r = 1
      if (key === 'left' && col > 0) col--
      if (key === 'right' && col < maxCols) col++
      game.current.rotation = r
      game.current.col = col
    })
    inputs.keyBuffer = []
  }
}

function drawFallingPiece (game) {
  if (!game.current) {
    game.current = getPieceFromBag(game)
  }

  const spriteId = game.current.type + game.current.rotation
  const piece = pieces[spriteId]

  const pieceHeight = piece.h * SCALE
  const piecePosX = game.board.x + game.current.col * BLOCK_SIZE * SCALE
  const piecePosY = game.board.y - pieceHeight + game.current.row * BLOCK_SIZE * SCALE

  const hasReachedBottom = piecePosY + pieceHeight >= game.board.h
  if (!hasReachedBottom) {
    // Clear & Draw.
    ctx.clearRect(game.board.x, game.board.y, game.board.w, game.board.h)
    ctx.drawImage(game.sprites,
      piece.x,
      piece.y,
      piece.w,
      piece.h,
      piecePosX,
      piecePosY,
      piece.w * SCALE,
      piece.h * SCALE
    )
    // Move the piece downwards.
    game.current.row++
  } else {
    // Grap a new piece.
    game.current = getPieceFromBag(game)
  }
}

function draw (game) {
  window.requestAnimationFrame(() => {
    drawFallingPiece(game)
  })
}

function range (min, max) {
  return [
    ...new Array(Math.floor(Math.random() * max) + min)
  ]
  .map((x, i) => i + 1)
}

function getRandomBagOfTetraminos () {
  return shuffle(
    Object.keys(tetraminos).reduce((acc, pieceName) => {
      return acc.concat(range(5, 10).map(() => pieceName))
    }, [])
  )
}

function init () {
  const sprites = new Image()
  const p = new Promise(resolve => {
    console.log('Loading game sprites ..')
    sprites.onload = () => {
      dumpPieces(sprites)
      console.log('Game sprites loaded successfully.')
      resolve(sprites)
    }
  })
  sprites.src = '/tetris.png'

  // Setup keyboard event handler.
  setupKeyboardEventHandler()

  return p
}

function setupKeyboardEventHandler () {
  document.onkeydown = function (event) {
    if (!event) {
      event = window.event
    }
    let code = event.keyCode
    if (event.charCode && code === 0) {
      code = event.charCode
    }
    switch (code) {
      case 37:
        inputs.keyBuffer.push('left')
        break
      case 38:
      case 16:
        inputs.keyBuffer.push('up')
        break
      case 39:
        inputs.keyBuffer.push('right')
        break
      case 40:
        inputs.keyBuffer.push('down')
        break
      default:
        console.log('Got char code:', code)
    }
    // event.preventDefault()
  }
}

function shuffle (array) {
  let currentIndex = array.length
  let temporaryValue
  let randomIndex

  // While there remain elements to shuffle...
  while (currentIndex !== 0) {
    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex)
    currentIndex -= 1

    // And swap it with the current element.
    temporaryValue = array[currentIndex]
    array[currentIndex] = array[randomIndex]
    array[randomIndex] = temporaryValue
  }
  return array
}

function dumpPieces (sprites) {
  let offsetY = 0
  let offsetX = 0
  Object.keys(pieces).forEach(x => {
    const piece = pieces[x]
    ctx.drawImage(sprites,
      piece.x,
      piece.y,
      piece.w,
      piece.h,
      offsetX,
      offsetY,
      piece.w * 2,
      piece.h * 2
    )
    offsetY += piece.h * SCALE
    if (offsetY > BOARD_HEIGHT) {
      offsetY = 0
      offsetX += SX * 2
    }
  })
}

function createPieces () {
  return {
    LB1: { x: 104, y: 8, w: SZ, h: 8 },
    LB2: { x: 104 + SZ + 8, y: 0, w: 8, h: SZ },

    LL1: { x: 104, y: SZ * 1 + 16, w: 24, h: 16 },
    LL2: { x: 104 + SZ * 1, y: SZ * 1 + 8, w: 16, h: 24 },
    LL3: { x: 104 + SZ * 2 - 8, y: SZ * 1 + 16, w: 24, h: 16 },
    LL4: { x: 104 + SZ * 3 - 8, y: SZ * 1 + 8, w: 16, h: 24 },

    LR1: { x: 104, y: SZ * 2 + 16, w: 24, h: 16 },
    LR2: { x: 104 + SZ, y: SZ * 2 + 8, w: 16, h: 24 },
    LR3: { x: 104 + SZ * 2 - 8, y: SZ * 2 + 16, w: 24, h: 16 },
    LR4: { x: 104 + SZ * 3 - 8, y: SZ * 2 + 8, w: 16, h: 24 },

    CU1: { x: 104, y: SZ * 3 + 8, w: 16, h: 16 },

    SR1: { x: 104, y: SZ * 4 + 8, w: 24, h: 16 },
    SR2: { x: 104 + SZ * 1, y: SZ * 4, w: 16, h: 24 },

    TR1: { x: 104, y: SZ * 5 + 8, w: 24, h: 16 },
    TR2: { x: 104 + SZ, y: SZ * 5, w: 16, h: 24 },
    TR3: { x: 104 + SZ * 2 - 8, y: SZ * 5 + 8, w: 24, h: 16 },
    TR4: { x: 104 + SZ * 3 - 8, y: SZ * 5, w: 16, h: 24 },

    SL1: { x: 104, y: SZ * 6 + 8, w: 24, h: 16 },
    SL2: { x: 104 + SZ, y: SZ * 6, w: 16, h: 24 }
  }
}
