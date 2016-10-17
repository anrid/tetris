/* globals Image, XMLHttpRequest */
'use strict'

const BOARD_COLS = 10
const BOARD_ROWS = 22
const BOARD_HEIGHT = 864 / 2
const BOARD_WIDTH = 832 / 2
const SCALE = 2
const BZ = 8
const B2 = BZ * SCALE
const STARTING_GAME_SPEED = 1 / 4
const MAX_RUNTIME = 60000
// NOTE: Use this to force shapes during testing.
const FORCE_SHAPES = false // ['LB', 'LB', 'LB', 'LB']
const ENABLE_SOUND = false

const IMAGES = [
  { id: 'gameSprites', url: '/tetris.png' }
]
const SOUNDS = [
  // { id: 'bgMusic1', url: '/sounds/dk-main.mp3' }
  // { id: 'bgMusic2', url: '/sounds/dk-start.mp3' },
  // { id: 'bgMusic3', url: '/sounds/dk-howhigh.mp3' },
  // { id: 'bgMusic4', url: '/sounds/dk-hammer.mp3' }
  // { id: 'bgMusic1', url: '/sounds/bg-music-01.mp3' },
  // { id: 'bgMusic2', url: '/sounds/bg-music-02.mp3' },
  // { id: 'bgMusic3', url: '/sounds/bg-music-03.mp3' },
  // { id: 'bgMusic4', url: '/sounds/bg-music-04.mp3' }
]

// Create our Tetraminos.
const TETRAS = createTetraminos('LB')

const ctx = document.getElementById('game').getContext('2d')
const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
// ctx.globalCompositeOperation = 'destination-over'

// Run game on load.
window.onload = runGame

function runGame () {
  console.log('Loading Tetris ..')
  loadResources(IMAGES, SOUNDS)
  .then(resources => {
    console.log('Tetris loaded.')
    // Create a new game.
    const game = createNewGame(resources)

    // FIXME: Remove this later.
    dumpPieces(game.sprites)

    // Hook up keyboard events.
    enableKeyboardEvents(game)

    // Start the game loop.
    window.requestAnimationFrame(() => runGameLoop(game))
  })
}

function runGameLoop (game) {
  // Let’s do this.
  moveAndRotatePiece(game)
  moveEverything(game)
  drawEverything(game)

  game.stats.runtime = Date.now() - game.stats.runningSince
  if (game.stats.runtime > MAX_RUNTIME) {
    stopGame(game)
  } else if (game.running) {
    window.requestAnimationFrame(() => runGameLoop(game))
  }
}

function moveEverything (game) {
  // Move everything along !
  game.ticks += game.speed
  if (game.ticks > 1.0) {
    game.ticks = 0
    game.current.row++
  }
  const info = getPieceInfo(game, game.current)

  // Ensure that piece fits on X-axis.
  const colsRemaining = game.board.cols - info.cols - game.current.col
  if (colsRemaining < 0) game.current.col += colsRemaining

  // No rows remaining ? Time for a new piece.
  const rowsRemaining = game.board.rows - info.rows - game.current.row
  if (rowsRemaining <= 0) {
    // Don’t allow the current piece to ever go past the bottom.
    game.current.row += rowsRemaining
    game.all.push(game.current)
    game.current = getPieceFromBag(game)
    addShapeToBoard(game, info)
  }
}

function addShapeToBoard (game, info) {
  info.shape.grid.forEach((shapeRow, shapeRowIndex) => {
    shapeRow.forEach((shapeCol, shapeColIndex) => {
      if (shapeCol === 1) {
        const gridRow = info.row + shapeRowIndex
        const gridCol = info.col + shapeColIndex
        game.board.grid[gridRow][gridCol] = { color: info.color }
      }
    })
  })
  console.log('game.board.grid:', game.board.grid)
  stopGame(game)
}

function drawEverything (game) {
  // Clear first.
  ctx.clearRect(game.board.x, game.board.y, game.board.w, game.board.h)

  // Draw all the things.
  game.all.concat(game.current).forEach(piece => {
    const info = getPieceInfo(game, piece)
    drawShape(game.sprites, info.shape, info.x, info.y)
  })
}

function createNewGame (resources) {
  // Creates a new game, including a bag of tetraminos and a board with a
  // blank grid.
  const bag = getRandomBagOfTetraminos()

  const game = {
    sprites: resources.images[0].image,
    sounds: resources.sounds,
    soundsPlaying: { },
    // Shuffled background music playlist.
    musicPlaylist: shuffle([
      'bgMusic1',
      'bgMusic2',
      'bgMusic3',
      'bgMusic4'
    ]),
    musicPlaylistIndex: 0,
    board: {
      x: BOARD_WIDTH,
      y: 0,
      w: BOARD_COLS * B2,
      h: BOARD_ROWS * B2,
      cols: BOARD_COLS,
      rows: BOARD_ROWS,
      grid: createBoardGrid()
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
    },
    running: true
  }
  // Rock our first piece !
  game.current = getPieceFromBag(game)

  // Start the music.
  if (ENABLE_SOUND) {
    playBackgroundMusic(game)
  }

  console.log('Created new game:', game)
  return game
}

function stopGame (game) {
  game.running = false
  // Kill all sounds.
  Object.keys(game.soundsPlaying)
  .forEach(x => game.soundsPlaying[x].stop())
  console.log('Game stopped. Stats:', game.stats)
}

function playBackgroundMusic (game) {
  const id = game.musicPlaylist[game.musicPlaylistIndex]
  console.log('Playing background music:', id)

  playSoundInGame(id, game)
  game.soundsPlaying[id].onended = () => {
    console.log('Background music ended.')
    if (game.running) {
      delete game.soundsPlaying[id]
      playBackgroundMusic(game)
    }
  }
  game.musicPlaylistIndex++
  game.musicPlaylistIndex = game.musicPlaylistIndex % game.musicPlaylist.length
}

function getPieceFromBag (game) {
  // Refill bag if there are only 2 pieces remaining.
  if (game.index === game.bag.length - 2) {
    // Keep the last 2 pieces and add a bunch of new ones.
    game.bag = game.bag.slice(-2).concat(getRandomBagOfTetraminos())
    game.index = 0
    console.log('Generated new bag:', game.bag)
  }

  const piece = {
    type: game.bag[game.index],
    rotation: 1,
    row: 0,
    col: 0,
    x: 0,
    y: 0
  }

  // Start this piece right smack in the middle.
  piece.col = Math.floor(game.board.cols / 2 - getPieceInfo(game, piece).cols / 2)

  game.index++
  console.log('Got new piece:', piece)
  return piece
}

function getPieceInfo (game, piece) {
  const id = piece.type + piece.rotation
  const shape = TETRAS.all[id]
  return {
    id,
    shape,
    color: shape.color,
    cols: shape.cols,
    rows: shape.rows,
    col: piece.col,
    row: piece.row,
    w: shape.cols * B2,
    h: shape.rows * B2,
    x: game.board.x + piece.col * B2,
    y: game.board.y + piece.row * B2
  }
}

function moveAndRotatePiece (game) {
  if (game.current) {
    const numShapes = TETRAS.shapes[game.current.type].count
    // console.log('move: col=', game.current.col, 'max=', maxCols)
    let r = game.current.rotation
    let col = game.current.col
    game.inputs.keyBuffer.forEach(key => {
      if (key === 'up') r--
      if (key === 'down') r++
      if (r < 1) r = numShapes
      if (r > numShapes) r = 1
      if (key === 'left' && col > 0) col--
      if (key === 'right' && col < game.board.cols) col++
      game.current.rotation = r
      game.current.col = col
    })
    game.inputs.keyBuffer = []
  }
}

function getRandomBagOfTetraminos () {
  const shapes = FORCE_SHAPES || Object.keys(TETRAS.shapes)
  return shuffle(shapes)
}

// @params sprites, shape, offsetX, offsetY, gridX, gridY.
function drawBlockOnGrid (sprites, s, ox, oy, gx, gy) {
  ctx.drawImage(
    sprites,
    s.x, s.y, BZ, BZ,
    ox + gx * B2, oy + gy * B2, B2, B2
  )
}

function drawShape (sprites, shape, offsetX, offsetY) {
  const block = TETRAS.colors[shape.color]
  shape.grid.forEach((row, y) => {
    row.forEach((col, x) => {
      if (col === 1) drawBlockOnGrid(sprites, block, offsetX, offsetY, x, y)
    })
  })
}

function dumpPieces (sprites) {
  let offsetX = 0
  let offsetY = 0
  Object.keys(TETRAS.all).forEach(id => {
    const shape = TETRAS.all[id]
    drawShape(sprites, shape, offsetX, offsetY)
    offsetY += shape.rows * B2
  })
}

function playSoundInGame (id, game) {
  const sound = game.sounds.find(x => x.id === id)
  if (sound) {
    const source = audioCtx.createBufferSource()
    source.buffer = sound.buffer
    source.connect(audioCtx.destination)
    source.start(0)
    game.soundsPlaying[id] = source
  }
}

/*
 * ===========================================================================
 * ===========================================================================
 *
 * Util functions.
 *
 * ===========================================================================
 * ===========================================================================
 */

function loadImage (id, url) {
  return new Promise(resolve => {
    const img = new Image()
    console.log('Loading image:', url)
    img.onload = () => resolve(img)
    img.src = url
  })
  .then(image => {
    console.log(`Loaded image: ${url} (${id}) successfully.`)
    return { id, url, image }
  })
}

function loadSoundBuffer (id, url) {
  return new Promise((resolve, reject) => {
    // Load buffer asynchronously
    const request = new XMLHttpRequest()
    request.open('GET', url, true)
    request.responseType = 'arraybuffer'
    request.onload = function () {
      // Asynchronously decode the audio file data in request.response
      audioCtx.decodeAudioData(
        request.response,
        function (buffer) {
          if (!buffer) {
            return reject(new Error('error decoding file data: ' + url))
          }
          resolve(buffer)
        },
        function (error) {
          reject(new Error('decode audio error: ' + error))
        }
      )
    }
    request.onerror = function (error) {
      reject(new Error('load sound buffer XHR error:', error))
    }
    console.log('Loading sound:', url)
    request.send()
  })
  .then(buffer => {
    console.log(`Loaded sound: ${url} (${id}) successfully.`)
    return { id, url, buffer }
  })
}

function range (max) {
  return [...new Array(max)].map((x, i) => i + 1)
}

function createTetraminos () {
  const createBlock = (offset) => ({ x: 0 + offset * BZ, y: BZ * 24 })

  return {
    shapes: {
      'LB': { count: 2 },
      'LL': { count: 4 },
      'LR': { count: 4 },
      'CU': { count: 1 },
      'SR': { count: 2 },
      'TR': { count: 4 },
      'SL': { count: 2 }
    },
    colors: {
      red: createBlock(0),
      blue: createBlock(1),
      orange: createBlock(2),
      yellow: createBlock(3),
      purple: createBlock(4),
      teal: createBlock(5),
      green: createBlock(6),
      black: createBlock(7),
      gray: createBlock(8)
    },
    all: {
      'LB1': { color: 'red', grid: [[1, 1, 1, 1]], cols: 4, rows: 1 },
      'LB2': { color: 'red', grid: [[1], [1], [1], [1]], cols: 1, rows: 4 },
      'LL1': { color: 'blue', grid: [[1, 1, 1], [0, 0, 1]], cols: 3, rows: 2 },
      'LL2': { color: 'blue', grid: [[0, 1], [0, 1], [1, 1]], cols: 2, rows: 3 },
      'LL3': { color: 'blue', grid: [[1, 0, 0], [1, 1, 1]], cols: 3, rows: 2 },
      'LL4': { color: 'blue', grid: [[1, 1], [1], [1]], cols: 2, rows: 3 },
      'LR1': { color: 'orange', grid: [[0, 0, 1], [1, 1, 1]], cols: 3, rows: 2 },
      'LR2': { color: 'orange', grid: [[1, 0], [1, 0], [1, 1]], cols: 2, rows: 3 },
      'LR3': { color: 'orange', grid: [[1, 1, 1], [1, 0, 0]], cols: 3, rows: 2 },
      'LR4': { color: 'orange', grid: [[1, 1], [0, 1], [0, 1]], cols: 2, rows: 3 },
      'CU1': { color: 'yellow', grid: [[1, 1], [1, 1]], cols: 2, rows: 2 },
      'SR1': { color: 'purple', grid: [[0, 1, 1], [1, 1, 0]], cols: 3, rows: 2 },
      'SR2': { color: 'purple', grid: [[1, 0], [1, 1], [0, 1]], cols: 2, rows: 3 },
      'TR1': { color: 'teal', grid: [[1, 1, 1], [0, 1, 0]], cols: 3, rows: 2 },
      'TR2': { color: 'teal', grid: [[1, 0], [1, 1], [1, 0]], cols: 2, rows: 3 },
      'TR3': { color: 'teal', grid: [[0, 1, 0], [1, 1, 1]], cols: 3, rows: 2 },
      'TR4': { color: 'teal', grid: [[0, 1], [1, 1], [0, 1]], cols: 2, rows: 3 },
      'SL1': { color: 'green', grid: [[1, 1, 0], [0, 1, 1]], cols: 3, rows: 2 },
      'SL2': { color: 'green', grid: [[0, 1], [1, 1], [1, 0]], cols: 2, rows: 3 }
    }
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

function loadResources (images, sounds) {
  const promises = []

  // Load sprites.
  images.forEach(x => promises.push(loadImage(x.id, x.url)))

  // Load all sounds.
  sounds.forEach(x => promises.push(loadSoundBuffer(x.id, x.url)))

  return Promise.all(promises).then(res => ({
    images: [res[0]],
    sounds: res.slice(1)
  }))
}

function createBoardGrid () {
  return range(BOARD_ROWS).map(() => range(BOARD_COLS).map(() => null))
}
