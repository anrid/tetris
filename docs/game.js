/* globals Image, XMLHttpRequest */
"use strict";

const BOARD_COLS = 10;
const BOARD_ROWS = 20;
// const BOARD_HEIGHT = 432 / 2
// const BOARD_WIDTH = 416 / 2
const BOARD_OFFSET_X = 0;
const SCALE = 2;
const BZ = 8;
const B2 = BZ * SCALE;
const STARTING_GAME_SPEED = 1 / 9;
const MAX_RUNTIME = false; // 60000
// How long to wait before locking a piece in place.
const PIECE_LOCK_DELAY = 40;

// NOTE: Use this to force shapes during testing.
const FORCE_SHAPES = false; // ['LB', 'LB', 'LB']

const IMAGES = [{ id: "gameSprites", url: "tetris.png" }];

// Sound.
const ENABLE_SOUND = true;
const PLAYLIST = ["bgMusic1", "bgMusic2", "bgMusic3"];
const SOUNDS = [
  { id: "intro1", url: "sounds/dk-main.mp3", load: true },
  { id: "intro2", url: "sounds/dk-start.mp3", load: true },
  { id: "intro3", url: "sounds/dk-howhigh.mp3", load: false },
  { id: "intro4", url: "sounds/dk-hammer.mp3", load: false },
  { id: "gameover", url: "sounds/dk-gameover.mp3", load: true },
  { id: "bgMusic1", url: "sounds/bg-music-01.mp3", load: true },
  { id: "bgMusic2", url: "sounds/bg-music-02.mp3", load: true },
  { id: "bgMusic3", url: "sounds/bg-music-03.mp3", load: true },
  { id: "bgMusic4", url: "sounds/bg-music-04.mp3", load: false },
  { id: "click1", url: "sounds/click1.wav", load: true },
  { id: "click2", url: "sounds/click2.wav", load: true },
  { id: "click3", url: "sounds/click3.wav", load: true },
  { id: "click4", url: "sounds/click4.wav", load: true },
  { id: "click5", url: "sounds/click5.wav", load: true },
  { id: "click6", url: "sounds/click6.wav", load: true },
  { id: "single", url: "sounds/clear-single.ogg", load: true },
  { id: "double", url: "sounds/clear-double.ogg", load: true },
  { id: "triple", url: "sounds/clear-triple.ogg", load: true },
  { id: "tetris", url: "sounds/clear-tetris.ogg", load: true },
];

// Create our Tetraminos.
const TETRAS = createTetraminos("LB");

const ctx = document.getElementById("game").getContext("2d");
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Run game on load.
window.onload = run;

function run() {
  console.log("Loading Tetris ..");
  compareShapeAndBoardGridsTest();
  smashLinesTest();

  loadResources()
    .then((resources) => {
      // Setup basic sound effects.
      resources.effects = {
        volume75: createVolumeNode(0.75),
        volume50: createVolumeNode(0.5),
      };
      return resources;
    })
    .then((resources) => {
      console.log("Tetris loaded.");
      startGame(resources);
    });
}

function startGame(resources) {
  // Create a new game.
  const game = createNewGame(resources);

  // Hook up keyboard events.
  enableKeyboardEvents(game);
  enableGameButtons(game);

  // Start the game loop.
  window.requestAnimationFrame(() => runGameLoop(game));
}

function runGameLoop(game) {
  // Let’s do this.
  moveAndRotatePiece(game);
  moveEverything(game);
  drawEverything(game);

  game.stats.runtime = Date.now() - game.stats.runningSince;
  if (MAX_RUNTIME && game.stats.runtime > MAX_RUNTIME) {
    stopGame(game);
  } else if (game.running) {
    window.requestAnimationFrame(() => runGameLoop(game));
  }
}

function moveEverything(game) {
  // Move everything along !
  let moveDown = false;
  game.ticks += game.inputs.pushDown ? game.speed * 10 : game.speed;
  if (game.ticks > 1.0) {
    game.ticks = 0;
    moveDown = true;
  }

  const info = getPieceInfo(game, game.current);

  const result = compareShapeAndBoardGrids(
    info.shape.grid,
    game.board.grid,
    game.current.row,
    game.current.col
  );

  if (!result.fits && game.current.row < 0 && result.touch.below) {
    // End game !
    console.log("It’s a Done Deal.");
    stopGame(game);
    if (ENABLE_SOUND) {
      playSoundInGame(game, "gameover");
    }
    return;
  }

  if (result.touch.below) {
    // We’ve hit something below. Delay for a bit then lock
    // the current piece to the board.
    if (++game.current.delay > PIECE_LOCK_DELAY) {
      if (result.fits) {
        result.slots.forEach(
          (x) => (game.board.grid[x[0]][x[1]] = { color: info.color })
        );
        game.current = getPieceFromBag(game);

        // How about a nice game of... Tetris ?
        const lines = checkLinesToSmash(game);
        if (lines) {
          game.points += lines.points;
          smashLines(game, lines.events);
        }
      }
    }
  } else if ((game.current.row < 0 || result.fits) && moveDown) {
    // We’re still free to move downwards.
    game.current.row++;
  }
}

function smashLines(game, events) {
  events.forEach((event) => {
    playSoundInGame(game, event.name); // Play clearing sound effect at full volume.
    event.group.forEach((rI) => {
      game.board.grid.splice(rI, 1);
      game.board.grid.unshift(createBoardGridRow());
    });
  });
}

function checkLinesToSmash(game) {
  const lines = game.board.grid.reduce((acc, row, rI) => {
    if (row.every((x) => x && x.color)) acc.push(rI);
    return acc;
  }, []);

  if (!lines.length) {
    return;
  }

  console.log("Smashing lines:", lines);
  const linePoints = [40, 100, 300, 1200];
  const lineNames = ["single", "double", "triple", "tetris"];

  return lines.reduce(
    (acc, lineIndex, i) => {
      // console.log('lineIndex:', lineIndex, 'acc=', acc)
      const isLineGroup =
        i < lines.length - 1 && lines[i + 1] === lineIndex + 1;
      if (!acc.group.length) acc.group.push(lineIndex);
      if (isLineGroup && acc.size < 3) {
        // console.log('grouping:', lineIndex)
        acc.group.push(lineIndex + 1);
        acc.size++;
        return acc;
      }
      acc.points += linePoints[acc.size];
      acc.events.push({ group: acc.group, name: lineNames[acc.size] });
      // Clean up.
      acc.size = 0;
      acc.group = [];
      return acc;
    },
    { size: 0, group: [], points: 0, events: [] }
  );
}

function redrawBoard(game) {
  // Clear board.
  ctx.clearRect(game.board.x, game.board.y, game.board.w, game.board.h);

  // Draw frame.
  const frameW1 = (BOARD_COLS + 2) * BZ;
  const frameH1 = (BOARD_ROWS + 3) * BZ;
  const frameW2 = (BOARD_COLS + 2) * B2;
  const frameH2 = (BOARD_ROWS + 3) * B2;
  ctx.drawImage(
    game.sprites,
    0,
    0,
    frameW1,
    frameH1,
    game.board.x - B2,
    game.board.y - B2,
    frameW2,
    frameH2
  );
}

function drawEverything(game) {
  redrawBoard(game);

  const info = getPieceInfo(game, game.current);

  // Draw points
  const pointsX = game.board.x + game.board.w + 30;
  const pointsY = 30;

  ctx.save();
  ctx.fillStyle = "white";
  ctx.fillRect(pointsX - 10, 10, 200, pointsY * 3);
  ctx.restore();

  ctx.save();
  ctx.font = '24px "Press Start"';
  ctx.textBaseline = "top";
  ctx.fillStyle = "black";
  ctx.fillText("Points:", pointsX, 10);
  ctx.fillText(game.points, pointsX, 10 + pointsY);
  ctx.restore();

  // Draw preview piece.
  const previewX = game.board.x + game.board.w + 30;
  const previewY = pointsY * 3;

  ctx.fillStyle = "white";
  ctx.fillRect(previewX - 10, previewY, 200, pointsY * 3);
  const previewInfo = getPreviewPieceInfo(game);
  drawShape(game.sprites, previewInfo.shape, previewX, previewY);

  // Merge current piece with board.
  info.shape.grid.forEach((row, rI) => {
    row.forEach((col, cI) => {
      if (col === 1) {
        let gridRow = info.row + rI;
        let gridCol = info.col + cI;
        const invalidRow = gridRow < 0 || gridRow >= game.board.grid.length;
        const invalidCol = gridCol < 0 || gridCol >= game.board.grid[0].length;
        if (invalidRow || invalidCol) {
          return;
        }
        if (!game.board.grid[gridRow][gridCol]) {
          game.board.grid[gridRow][gridCol] = {
            color: info.color,
            current: true,
          };
        }
      }
    });
  });

  // Draw the board grid.
  game.board.grid.forEach((row, rI) => {
    row.forEach((col, cI) => {
      if (col) {
        const block = TETRAS.colors[col.color];
        drawBlockOnGrid(
          game.sprites,
          block,
          game.board.x,
          game.board.y,
          cI,
          rI
        );
      }
    });
  });

  // Clear current piece from board.
  game.board.grid.forEach((row, rI) => {
    row.forEach((col, cI) => {
      if (col && col.current) {
        row[cI] = null;
      }
    });
  });
}

function compareShapeAndBoardGrids(
  shape,
  board,
  boardRowOffset,
  boardColOffset
) {
  const res = {
    fits: false,
    size: 0,
    slots: [],
    touch: {},
  };
  shape.forEach((shapeRow, shapeRowIndex) => {
    shapeRow.forEach((shapeCol, shapeColIndex) => {
      if (shapeCol) {
        res.size++;
        const boardRow = boardRowOffset + shapeRowIndex;
        const boardCol = boardColOffset + shapeColIndex;

        // Skip this slot if it’s outside the grid.
        if (boardRow < 0) {
          res.touch.above = true;
          return;
        }
        if (boardRow >= board.length) {
          res.touch.below = true;
          return;
        }
        if (boardCol < 0) {
          res.touch.left = true;
          return;
        }
        if (boardCol >= board[0].length) {
          res.touch.right = true;
          return;
        }

        const selfAbove =
          shapeRowIndex > 0 && shape[shapeRowIndex - 1][shapeColIndex];
        const selfBelow =
          shapeRowIndex + 1 < shape.length &&
          shape[shapeRowIndex + 1][shapeColIndex];
        const selfLeft =
          shapeColIndex > 0 && shape[shapeRowIndex][shapeColIndex - 1];
        const selfRight =
          shapeColIndex + 1 < shape[0].length &&
          shape[shapeRowIndex][shapeColIndex + 1];

        const takenAbove =
          boardRow === 0 || (boardRow > 0 && board[boardRow - 1][boardCol]);
        const takenBelow =
          boardRow === board.length - 1 ||
          (boardRow + 1 < board.length && board[boardRow + 1][boardCol]);
        const takenLeft =
          boardCol === 0 || (boardCol > 0 && board[boardRow][boardCol - 1]);
        const takenRight =
          boardCol === board[0].length - 1 ||
          (boardCol + 1 < board[0].length && board[boardRow][boardCol + 1]);

        // Check if shape touches anything from above, below, left and right
        if (!selfAbove && takenAbove) res.touch.above = true;
        if (!selfBelow && takenBelow) res.touch.below = true;
        if (!selfLeft && takenLeft) res.touch.left = true;
        if (!selfRight && takenRight) res.touch.right = true;

        const slot = board[boardRow][boardCol];
        if (slot) {
          // Skip if slot is taken.
          return;
        }
        res.slots.push([boardRow, boardCol]);
      }
    });
  });
  res.fits = res.size === res.slots.length;
  return res;
}

function validateMove(game, type, rotation, row, column) {
  const info = getPieceInfo(game, { type, rotation });
  const result = compareShapeAndBoardGrids(
    info.shape.grid,
    game.board.grid,
    row,
    column
  );
  return result.fits;
}

function moveAndRotatePiece(game) {
  if (game.current) {
    const shapeVariants = TETRAS.shapes[game.current.type].count;
    let rot = game.current.rotation;
    let col = game.current.col;
    let lastRot;
    let lastCol;
    game.inputs.keyBuffer.forEach((key) => {
      lastRot = rot;
      lastCol = col;
      if (key === "up") rot--;
      if (key === "down") rot++;
      if (rot < 1) rot = shapeVariants;
      if (rot > shapeVariants) rot = 1;
      if (key === "left") col--;
      if (key === "right") col++;
      if (!validateMove(game, game.current.type, rot, game.current.row, col)) {
        rot = lastRot;
        col = lastCol;
      }
    });
    game.current.rotation = rot;
    game.current.col = col;
    game.inputs.keyBuffer = [];
  }
}

function createNewGame(resources) {
  // Creates a new game, including a bag of tetraminos and a board with a
  // blank grid.
  const bag = getRandomBagOfTetraminos();

  const game = {
    resources,
    sprites: resources.images[0].image,
    sounds: resources.sounds,
    soundsPlaying: {},
    // Shuffled background music playlist.
    musicPlaylist: PLAYLIST,
    musicPlaylistIndex: 0,
    points: 0,
    board: {
      x: BOARD_OFFSET_X + B2,
      y: B2,
      w: BOARD_COLS * B2,
      h: BOARD_ROWS * B2,
      cols: BOARD_COLS,
      rows: BOARD_ROWS,
      grid: createBoardGrid(),
    },
    ticks: 0,
    speed: STARTING_GAME_SPEED,
    bag,
    current: null,
    all: [],
    index: 0,
    inputs: {
      keyBuffer: [],
    },
    stats: {
      runningSince: Date.now(),
      runtime: 0,
    },
    running: true,
  };
  // Rock our first piece !
  game.current = getPieceFromBag(game);

  // Start the music.
  if (ENABLE_SOUND) {
    playBackgroundMusic(game);
  }

  console.log("Created new game:", game);
  return game;
}

function stopGame(game) {
  game.running = false;
  // Kill all sounds.
  Object.keys(game.soundsPlaying).forEach((x) => game.soundsPlaying[x].stop());
  console.log("Game stopped. Stats:", game.stats);
}

function playBackgroundMusic(game) {
  const id = game.musicPlaylist[game.musicPlaylistIndex];
  console.log("Playing background music:", id);

  playSoundInGame(game, id, { effect: "volume50" });
  game.soundsPlaying[id].onended = () => {
    console.log("Background music ended.");
    if (game.running) {
      delete game.soundsPlaying[id];
      playBackgroundMusic(game);
    }
  };
  game.musicPlaylistIndex++;
  game.musicPlaylistIndex = game.musicPlaylistIndex % game.musicPlaylist.length;
}

function getPieceFromBag(game) {
  // Refill bag if there are only 2 pieces remaining.
  if (game.index === game.bag.length - 2) {
    // Keep the last 2 pieces and add a bunch of new ones.
    game.bag = game.bag.slice(-2).concat(getRandomBagOfTetraminos());
    game.index = 0;
    console.log("Generated new bag:", game.bag);
  }

  const piece = {
    type: game.bag[game.index],
    rotation: 1,
    row: 0,
    col: 0,
    delay: 0,
  };

  // Start this piece right smack in the middle.
  const info = getPieceInfo(game, piece);
  piece.col = Math.floor(game.board.cols / 2 - info.cols / 2);
  piece.row = -info.rows;

  game.index++;
  // console.log('Got new piece:', piece)
  return piece;
}

function getPreviewPieceInfo(game) {
  return getPieceInfo(game, { type: game.bag[game.index], rotation: 1 });
}

function getPieceInfo(game, piece) {
  const id = piece.type + piece.rotation;
  const shape = TETRAS.all[id];
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
    y: game.board.y + piece.row * B2,
  };
}

function getRandomBagOfTetraminos() {
  const shapes = FORCE_SHAPES || Object.keys(TETRAS.shapes);
  return shuffle(shapes);
}

// @params sprites, block, offsetX (px), offsetY (px), gridCol, gridRow.
function drawBlockOnGrid(sprites, block, offsetX, offsetY, gridCol, gridRow) {
  ctx.drawImage(
    sprites,
    block.x,
    block.y,
    BZ,
    BZ,
    offsetX + gridCol * B2,
    offsetY + gridRow * B2,
    B2,
    B2
  );
}

function drawShape(sprites, shape, offsetX, offsetY) {
  const block = TETRAS.colors[shape.color];
  shape.grid.forEach((row, y) => {
    row.forEach((col, x) => {
      if (col === 1) drawBlockOnGrid(sprites, block, offsetX, offsetY, x, y);
    });
  });
}

function playSoundInGame(game, id, opts = {}) {
  const sound = game.sounds.find((x) => x.id === id);
  if (sound) {
    const source = audioCtx.createBufferSource();
    source.buffer = sound.buffer;
    if (opts.effect && game.resources.effects[opts.effect]) {
      source.connect(game.resources.effects[opts.effect]);
    } else {
      source.connect(audioCtx.destination);
    }
    source.start(0);
    game.soundsPlaying[id] = source;
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

function dumpPieces(sprites) {
  let offsetX = 0;
  let offsetY = 0;
  Object.keys(TETRAS.all).forEach((id) => {
    const shape = TETRAS.all[id];
    drawShape(sprites, shape, offsetX, offsetY);
    offsetY += shape.rows * B2;
  });
}

function loadImage(id, url) {
  return new Promise((resolve) => {
    const img = new Image();
    console.log("Loading image:", url);
    img.onload = () => resolve(img);
    img.src = url;
  }).then((image) => {
    console.log(`Loaded image: ${url} (${id}) successfully.`);
    return { id, url, image };
  });
}

function loadSoundBuffer(id, url) {
  return new Promise((resolve, reject) => {
    // Load buffer asynchronously
    const request = new XMLHttpRequest();
    request.open("GET", url, true);
    request.responseType = "arraybuffer";
    request.onload = function () {
      // Asynchronously decode the audio file data in request.response
      audioCtx.decodeAudioData(
        request.response,
        function (buffer) {
          if (!buffer) {
            return reject(new Error("error decoding file data: " + url));
          }
          resolve(buffer);
        },
        function (error) {
          reject(new Error("decode audio error: " + error));
        }
      );
    };
    request.onerror = function (error) {
      reject(new Error("load sound buffer XHR error:", error));
    };
    console.log("Loading sound:", url);
    request.send();
  }).then((buffer) => {
    console.log(`Loaded sound: ${url} (${id}) successfully.`);
    return { id, url, buffer };
  });
}

function range(max) {
  return [...new Array(max)].map((x, i) => i + 1);
}

function createTetraminos() {
  const createBlock = (offset) => ({ x: 0 + offset * BZ, y: BZ * 24 });

  return {
    shapes: {
      LB: { count: 4 },
      LL: { count: 4 },
      LR: { count: 4 },
      CU: { count: 1 },
      SR: { count: 4 },
      TR: { count: 4 },
      SL: { count: 4 },
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
      gray: createBlock(8),
    },
    all: {
      LB1: {
        color: "red",
        grid: [
          [0, 0, 0, 0],
          [1, 1, 1, 1],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
        cols: 4,
        rows: 4,
      },
      LB2: {
        color: "red",
        grid: [
          [0, 0, 1, 0],
          [0, 0, 1, 0],
          [0, 0, 1, 0],
          [0, 0, 1, 0],
        ],
        cols: 4,
        rows: 4,
      },
      LB3: {
        color: "red",
        grid: [
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [1, 1, 1, 1],
          [0, 0, 0, 0],
        ],
        cols: 4,
        rows: 4,
      },
      LB4: {
        color: "red",
        grid: [
          [0, 1, 0, 0],
          [0, 1, 0, 0],
          [0, 1, 0, 0],
          [0, 1, 0, 0],
        ],
        cols: 4,
        rows: 4,
      },

      LL1: {
        color: "blue",
        grid: [
          [1, 0, 0],
          [1, 1, 1],
          [0, 0, 0],
        ],
        cols: 3,
        rows: 3,
      },
      LL2: {
        color: "blue",
        grid: [
          [0, 1, 1],
          [0, 1, 0],
          [0, 1, 0],
        ],
        cols: 3,
        rows: 3,
      },
      LL3: {
        color: "blue",
        grid: [
          [0, 0, 0],
          [1, 1, 1],
          [0, 0, 1],
        ],
        cols: 3,
        rows: 3,
      },
      LL4: {
        color: "blue",
        grid: [
          [0, 1, 0],
          [0, 1, 0],
          [1, 1, 0],
        ],
        cols: 3,
        rows: 3,
      },

      LR1: {
        color: "orange",
        grid: [
          [0, 0, 1],
          [1, 1, 1],
          [0, 0, 0],
        ],
        cols: 3,
        rows: 3,
      },
      LR2: {
        color: "orange",
        grid: [
          [0, 1, 0],
          [0, 1, 0],
          [0, 1, 1],
        ],
        cols: 3,
        rows: 3,
      },
      LR3: {
        color: "orange",
        grid: [
          [0, 0, 0],
          [1, 1, 1],
          [1, 0, 0],
        ],
        cols: 3,
        rows: 3,
      },
      LR4: {
        color: "orange",
        grid: [
          [1, 1, 0],
          [0, 1, 0],
          [0, 1, 0],
        ],
        cols: 3,
        rows: 3,
      },

      CU1: {
        color: "yellow",
        grid: [
          [1, 1],
          [1, 1],
        ],
        cols: 2,
        rows: 2,
      },

      SR1: {
        color: "purple",
        grid: [
          [0, 1, 1],
          [1, 1, 0],
          [0, 0, 0],
        ],
        cols: 3,
        rows: 3,
      },
      SR2: {
        color: "purple",
        grid: [
          [0, 1, 0],
          [0, 1, 1],
          [0, 0, 1],
        ],
        cols: 3,
        rows: 3,
      },
      SR3: {
        color: "purple",
        grid: [
          [0, 0, 0],
          [0, 1, 1],
          [1, 1, 0],
        ],
        cols: 3,
        rows: 3,
      },
      SR4: {
        color: "purple",
        grid: [
          [1, 0, 0],
          [1, 1, 0],
          [0, 1, 0],
        ],
        cols: 3,
        rows: 3,
      },

      TR1: {
        color: "teal",
        grid: [
          [0, 1, 0],
          [1, 1, 1],
          [0, 0, 0],
        ],
        cols: 3,
        rows: 3,
      },
      TR2: {
        color: "teal",
        grid: [
          [0, 1, 0],
          [0, 1, 1],
          [0, 1, 0],
        ],
        cols: 3,
        rows: 3,
      },
      TR3: {
        color: "teal",
        grid: [
          [0, 0, 0],
          [1, 1, 1],
          [0, 1, 0],
        ],
        cols: 3,
        rows: 3,
      },
      TR4: {
        color: "teal",
        grid: [
          [0, 1, 0],
          [1, 1, 0],
          [0, 1, 0],
        ],
        cols: 3,
        rows: 3,
      },

      SL1: {
        color: "green",
        grid: [
          [1, 1, 0],
          [0, 1, 1],
          [0, 0, 0],
        ],
        cols: 3,
        rows: 3,
      },
      SL2: {
        color: "green",
        grid: [
          [0, 0, 1],
          [0, 1, 1],
          [0, 1, 0],
        ],
        cols: 3,
        rows: 3,
      },
      SL3: {
        color: "green",
        grid: [
          [0, 0, 0],
          [1, 1, 0],
          [0, 1, 1],
        ],
        cols: 3,
        rows: 3,
      },
      SL4: {
        color: "green",
        grid: [
          [0, 1, 0],
          [1, 1, 0],
          [1, 0, 0],
        ],
        cols: 3,
        rows: 3,
      },
    },
  };
}

function shuffle(array) {
  let currentIndex = array.length;
  let temporaryValue;
  let randomIndex;

  // While there remain elements to shuffle...
  while (currentIndex !== 0) {
    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }
  return array;
}

function getEventCode(event) {
  if (!event) {
    event = window.event;
  }
  let code = event.keyCode;
  if (event.charCode && code === 0) {
    code = event.charCode;
  }
  return code;
}

function gameKeyUp(game, event) {
  const code = getEventCode(event);
  switch (code) {
    case 32:
      game.inputs.pushDown = false;
      break;
    default:
    // console.log('Key up:', code)
  }
}

function gameKeyDown(game, event) {
  const code = getEventCode(event);
  switch (code) {
    case 32:
      game.inputs.pushDown = true;
      break;
    case 37:
      game.inputs.keyBuffer.push("left");
      playSoundInGame(game, "click1", { effect: "volume75" });
      break;
    case 38:
      game.inputs.keyBuffer.push("up");
      playSoundInGame(game, "click2", { effect: "volume75" });
      break;
    case 16:
      game.inputs.keyBuffer.push("down");
      playSoundInGame(game, "click5", { effect: "volume75" });
      break;
    case 39:
      game.inputs.keyBuffer.push("right");
      playSoundInGame(game, "click3", { effect: "volume75" });
      break;
    case 40:
      game.inputs.keyBuffer.push("down");
      playSoundInGame(game, "click4", { effect: "volume75" });
      break;
    default:
      console.log("Key down:", code);
  }
}

let _gameKeyUp;
let _gameKeyDown;

function enableKeyboardEvents(game) {
  document.removeEventListener("keyup", _gameKeyUp);
  document.removeEventListener("keydown", _gameKeyDown);

  _gameKeyUp = gameKeyUp.bind(null, game);
  _gameKeyDown = gameKeyDown.bind(null, game);

  document.addEventListener("keyup", _gameKeyUp);
  document.addEventListener("keydown", _gameKeyDown);
}

function loadResources() {
  const promises = [];

  // Load sprites.
  IMAGES.forEach((x) => promises.push(loadImage(x.id, x.url)));

  // Load all sounds.
  SOUNDS.forEach((x) => {
    if (x.load) {
      promises.push(loadSoundBuffer(x.id, x.url));
    }
  });

  return Promise.all(promises).then((res) => ({
    images: [res[0]],
    sounds: res.slice(1),
  }));
}

function createBoardGridRow() {
  return range(BOARD_COLS).map(() => null);
}

function createBoardGrid() {
  return range(BOARD_ROWS).map(createBoardGridRow);
}

function assert(exp, message = "Assertion error") {
  if (!exp) throw new Error(message);
}

function compareShapeAndBoardGridsTest() {
  let r;

  const board1 = [
    [0, 0, 1, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];

  const shape1 = TETRAS.all.SL1; // Green horizontal SL.
  r = compareShapeAndBoardGrids(shape1.grid, board1, 0, 0);
  assert(
    !r.fits && r.touch.above && r.touch.left && !r.touch.below && r.touch.right
  );
  r = compareShapeAndBoardGrids(shape1.grid, board1, 1, 0);
  assert(
    r.fits && r.touch.above && r.touch.left && !r.touch.below && r.touch.right
  );
  r = compareShapeAndBoardGrids(shape1.grid, board1, 2, 1);
  assert(
    r.fits && r.touch.above && !r.touch.left && r.touch.below && r.touch.right
  );

  const shape5 = TETRAS.all.CU1; // Yellow cube.
  r = compareShapeAndBoardGrids(shape5.grid, board1, 2, 0);
  assert(
    r.fits && !r.touch.above && r.touch.left && r.touch.below && !r.touch.right
  );
  r = compareShapeAndBoardGrids(shape5.grid, board1, 2, 2);
  assert(
    r.fits && r.touch.above && !r.touch.left && r.touch.below && r.touch.right
  );

  console.log("All grid tests pass ok.");
}

function smashLinesTest() {
  const testGame = {
    board: {
      grid: [
        [{ color: 1 }, { color: 1 }, { color: 1 }],
        [null, { color: 1 }, null],
        [{ color: 1 }, { color: 1 }, { color: 1 }],
        [null, { color: 1 }, null],
        [{ color: 1 }, { color: 1 }, { color: 1 }],
        [{ color: 1 }, { color: 1 }, { color: 1 }],
        [{ color: 1 }, { color: 1 }, { color: 1 }],
        [null, { color: 1 }, null],
        [{ color: 1 }, { color: 1 }, { color: 1 }],
        [{ color: 1 }, { color: 1 }, { color: 1 }],
        [{ color: 1 }, { color: 1 }, { color: 1 }],
        [{ color: 1 }, { color: 1 }, { color: 1 }],
        [{ color: 1 }, { color: 1 }, { color: 1 }],
        [{ color: 1 }, { color: 1 }, { color: 1 }],
      ],
    },
  };
  const lines = checkLinesToSmash(testGame);
  // console.log('lines:', lines)
  assert(lines.events[0].name === "single");
  assert(lines.events[1].name === "single" && lines.events[1].group[0] === 2);
  assert(lines.events[2].name === "triple");
  assert(lines.events[3].name === "tetris" && lines.events[3].group[0] === 8);
  assert(lines.events[4].name === "double");
  assert(lines.points === 40 + 40 + 300 + 1200 + 100);
  return;
}

function enableGameButtons(game) {
  window.handleButton = (name) => {
    switch (name) {
      case "stop":
        stopGame(game);
        // playSoundInGame(game, 'gameover')
        break;
      case "restart":
        stopGame(game);
        startGame(game.resources);
        // playSoundInGame(game, 'gameover')
        break;
      default:
        console.log("Unhandled button click:", name);
    }
  };
}

function createVolumeNode(volume) {
  const gainNode = audioCtx.createGain();
  gainNode.gain.value = volume;
  gainNode.connect(audioCtx.destination);
  return gainNode;
}
