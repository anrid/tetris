/* globals Image */
'use strict'

const SPRITE_BLOCK_SIZE = 32
const BOARD_HEIGHT = 864 / 2
const BOARD_WIDTH = 832 / 2
const SCALE = 2
const SZ = SPRITE_BLOCK_SIZE
const SX = SZ * SCALE
const BLOCK_SIZE = SPRITE_BLOCK_SIZE / 4
const STARTING_GAME_SPEED = 1 / 4
const MAX_RUNTIME = 60000

const pieces = createPieces()
const tetraminos = { 'LB': 2, 'LL': 4, 'LR': 4, 'CU': 1, 'SR': 2, 'TR': 4, 'SL': 2 }

const ctx = document.getElementById('game').getContext('2d')
// ctx.globalCompositeOperation = 'destination-over'

runGame()

function runGame () {
  console.log('Tetris is running.')
  loadResources()
  .then(resources => {
    const game = createNewGame(resources)
    enableKeyboardEvents(game)
    window.requestAnimationFrame(() => runGameLoop(game))
  })
}

function runGameLoop (game) {
  moveAndRotatePiece(game)
  drawPieces(game)
  game.stats.runtime = Date.now() - game.stats.runningSince
  if (game.stats.runtime > MAX_RUNTIME) {
    console.log('Game engine stopped, stats:', game.stats)
  } else {
    nextGameTick(game)
    window.requestAnimationFrame(() => runGameLoop(game))
  }
}

function nextGameTick (game) {
  // Move everything along !
  game.ticks += game.speed
  if (game.ticks > 1.0) {
    game.ticks = 0
    game.current.row++

    const data = getPieceData(game, game.current)
    const rowsRemaining = game.board.rows - data.rows - game.current.row
    // No rows remaining ? Time for a new piece.
    if (rowsRemaining <= 0) {
      // Don’t allow the current piece to ever go past the bottom.
      game.current.row += rowsRemaining
      game.all.push(game.current)
      game.current = getPieceFromBag(game)
    }
  }
}

function createNewGame (resources) {
  const boardCols = 10
  const boardRows = 22
  const bag = getRandomBagOfTetraminos().slice(0, 5)

  const game = {
    sprites: resources.sprites,
    board: {
      x: BOARD_WIDTH,
      y: 0,
      w: boardCols * BLOCK_SIZE * SCALE,
      h: boardRows * BLOCK_SIZE * SCALE,
      cols: boardCols,
      rows: boardRows
    },
    ticks: 0,
    speed: STARTING_GAME_SPEED,
    bag,
    current: null,
    all: [],
    index: 0,
    inputs: {
      keyBuffer: []
    },
    stats: {
      runningSince: Date.now(),
      runtime: 0
    }
  }

  // Rock our first piece !
  game.current = getPieceFromBag(game)

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
  piece.col = Math.floor(game.board.cols / 2 - getPieceData(game, piece).cols / 2)

  game.index++
  console.log('Got new piece:', piece)
  return piece
}

function getPieceData (game, piece) {
  const spriteId = piece.type + piece.rotation
  const sprite = pieces[spriteId]

  return {
    sprite,
    cols: Math.floor(sprite.w / BLOCK_SIZE),
    rows: Math.floor(sprite.h / BLOCK_SIZE),
    w: sprite.w * SCALE,
    h: sprite.h * SCALE,
    x: game.board.x + piece.col * BLOCK_SIZE * SCALE,
    y: game.board.y + piece.row * BLOCK_SIZE * SCALE
  }
}

function moveAndRotatePiece (game) {
  if (game.current) {
    const possibleRotations = tetraminos[game.current.type]
    // console.log('move: col=', game.current.col, 'max=', maxCols)
    let r = game.current.rotation
    let col = game.current.col
    game.inputs.keyBuffer.forEach(key => {
      if (key === 'up') r--
      if (key === 'down') r++
      if (r < 1) r = possibleRotations
      if (r > possibleRotations) r = 1
      if (key === 'left' && col > 0) col--
      if (key === 'right' && col < game.board.cols) col++
      game.current.rotation = r
      game.current.col = col
    })
    game.inputs.keyBuffer = []

    // Ensure that piece fits on X-axis after applying
    // all rotations for this frame.
    const maxCols = game.board.cols - getPieceData(game, game.current).cols
    if (game.current.col > maxCols) game.current.col = maxCols
  }
}

function drawPieces (game) {
  // Clear first.
  ctx.clearRect(game.board.x, game.board.y, game.board.w, game.board.h)

  game.all.concat(game.current).forEach(piece => {
    const data = getPieceData(game, piece)
    // Draw.
    ctx.drawImage(game.sprites,
      data.sprite.x,
      data.sprite.y,
      data.sprite.w,
      data.sprite.h,
      data.x,
      data.y,
      data.w,
      data.h
    )
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

function loadResources () {
  const sprites = new Image()
  const p = new Promise(resolve => {
    console.log('Loading game sprites ..')
    sprites.onload = () => {
      dumpPieces(sprites)
      console.log('Game sprites loaded successfully.')
      resolve({
        sprites
      })
    }
  })
  sprites.src = '/tetris.png'
  return p
}

function enableKeyboardEvents (game) {
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
        game.inputs.keyBuffer.push('left')
        break
      case 38:
      case 16:
        game.inputs.keyBuffer.push('up')
        break
      case 39:
        game.inputs.keyBuffer.push('right')
        break
      case 40:
        game.inputs.keyBuffer.push('down')
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
