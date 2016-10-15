/* globals Image */
'use strict'

const SPRITE_BLOCK_SIZE = 32
const BOARD_HEIGHT = 864 / 2
const BOARD_WIDTH = 832
const SCALE = 2
const SZ = SPRITE_BLOCK_SIZE
const SX = SZ * SCALE
const LINE_HEIGHT = SPRITE_BLOCK_SIZE / 4
const GAME_SPEED = 1000 / 30 // 15 FPS

const pieces = createPieces()
const tetraminos = ['LB', 'LL', 'LR', 'CU', 'SR', 'TR', 'SL']

const ctx = document.getElementById('game').getContext('2d')

const stats = {
  runningSince: Date.now(),
  runtime: 0
}

runGame()

function runGame () {
  console.log('Tetris running.')
  init()
  .then(sprites => {
    const gameRows = Math.ceil(BOARD_HEIGHT / (LINE_HEIGHT * SCALE) / 2)
    const game = {
      sprites,
      board: {
        x: BOARD_WIDTH / 2,
        y: 0,
        w: BOARD_WIDTH / 2,
        h: gameRows * LINE_HEIGHT * SCALE
      },
      bag: getRandomBagOfTetraminos().slice(0, 5),
      current: null,
      index: 0
    }
    console.log('Game:', game)
    const interval = setInterval(() => {
      draw(game)
      stats.runtime = Date.now() - stats.runningSince
      if (stats.runtime > 5000) {
        clearInterval(interval)
        console.log('Game engine stopped, stats:', stats)
      }
    }, GAME_SPEED)
  })
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
    posY: 0
  }
  game.index++
  console.log('Got new piece:', piece)
  return piece
}

function drawFallingPiece (game) {
  if (!game.current) {
    game.current = getPieceFromBag(game)
  }

  // Clear right side of game board.
  ctx.globalCompositeOperation = 'destination-over'
  ctx.clearRect(game.board.x, game.board.y, game.board.w, game.board.h)

  const spriteId = game.current.type + game.current.rotation
  const piece = pieces[spriteId]

  ctx.drawImage(game.sprites,
    piece.x,
    piece.y,
    piece.w,
    piece.h,
    game.board.x + game.board.w / 2,
    game.board.y + game.current.posY * LINE_HEIGHT * SCALE,
    piece.w * 2,
    piece.h * 2
  )
  // Move the piece downwards if there’s space.
  if (game.current.posY * LINE_HEIGHT * SCALE + piece.h * 2 < game.board.h) {
    game.current.posY++
  } else {
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
    tetraminos.reduce((acc, pieceName) => {
      return acc.concat(range(5, 10).map(() => pieceName))
    }, [])
  )
}

function init () {
  const sprites = new Image()
  const p = new Promise(resolve => {
    console.log('Loading sprites ..')
    sprites.onload = () => {
      dumpPieces(sprites)
      console.log('Sprites loaded successfully.')
      resolve(sprites)
    }
  })
  sprites.src = '/tetris.png'
  return p
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
    offsetY += piece.h * 2
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
