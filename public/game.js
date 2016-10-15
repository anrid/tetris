/* globals Image */
'use strict'

const SPRITE_BLOCK_SIZE = 32
const BOARD_HEIGHT = 864
const BOARD_WIDTH = 832
const SZ = SPRITE_BLOCK_SIZE
const S2x = SZ * 2

const pieces = getPieces()

const ctx = document.getElementById('game').getContext('2d')
loadSprites()

function loadSprites () {
  const img = new Image()
  img.onload = () => {
    let offsetY = 0
    let offsetX = 0
    Object.keys(pieces).forEach(x => {
      const piece = pieces[x]
      ctx.drawImage(img,
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
        offsetX += S2x * 2
      }
    })
  }
  img.src = '/tetris.png'
}

function getPieces () {
  return {
    redLongBar1: { x: 104, y: 8, w: SZ, h: 8 },
    redLongBar2: { x: 104 + SZ + 8, y: 0, w: 8, h: SZ },

    blueLL1: { x: 104, y: SZ * 1 + 16, w: 24, h: 16 },
    blueLL2: { x: 104 + SZ * 1, y: SZ * 1 + 8, w: 16, h: 24 },
    blueLL3: { x: 104 + SZ * 2 - 8, y: SZ * 1 + 16, w: 24, h: 16 },
    blueLL4: { x: 104 + SZ * 3 - 8, y: SZ * 1 + 8, w: 16, h: 24 },

    orangeLR1: { x: 104, y: SZ * 2 + 16, w: 24, h: 16 },
    orangeLR2: { x: 104 + SZ, y: SZ * 2 + 8, w: 16, h: 24 },
    orangeLR3: { x: 104 + SZ * 2 - 8, y: SZ * 2 + 16, w: 24, h: 16 },
    orangeLR4: { x: 104 + SZ * 3 - 8, y: SZ * 2 + 8, w: 16, h: 24 },

    yellowCube: { x: 104, y: SZ * 3 + 8, w: 16, h: 16 },

    purpleSR1: { x: 104, y: SZ * 4 + 8, w: 24, h: 16 },
    purpleSR2: { x: 104 + SZ * 1, y: SZ * 4, w: 16, h: 24 },

    tealTri1: { x: 104, y: SZ * 5 + 8, w: 24, h: 16 },
    tealTri2: { x: 104 + SZ, y: SZ * 5, w: 16, h: 24 },
    tealTri3: { x: 104 + SZ * 2 - 8, y: SZ * 5 + 8, w: 24, h: 16 },
    tealTri4: { x: 104 + SZ * 3 - 8, y: SZ * 5, w: 16, h: 24 },

    greenSL1: { x: 104, y: SZ * 6 + 8, w: 24, h: 16 },
    greenSL2: { x: 104 + SZ, y: SZ * 6, w: 16, h: 24 }
  }
}
