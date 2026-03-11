import Phaser from 'phaser'
import bgImg from '../assets/map/bg.jpg'
import farmImg from '../assets/items/farm.png'
import sunImg from '../assets/items/sun.png'
import cloudImg from '../assets/items/cloud.png'
import goldImg from '../assets/ui/gold.png'
import uiImg from '../assets/ui/ui.png'
import seedImg from '../assets/crops/seed2.jpg'

const SEED_FW = 512  // 1536 / 3
const SEED_FH = 344  // 2752 / 8

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot')
  }

  preload() {
    this.load.image('bg', bgImg)
    this.load.spritesheet('farm', farmImg, {
      frameWidth: 373,
      frameHeight: 223,
    })
    this.load.spritesheet('sun', sunImg, {
      frameWidth: 125,
      frameHeight: 125,
    })
    this.load.spritesheet('cloud', cloudImg, {
      frameWidth: 93,
      frameHeight: 111,
    })
    this.load.image('gold', goldImg)
    this.load.spritesheet('ui', uiImg, {
      frameWidth: 166,
      frameHeight: 166,
    })
    this.load.image('seed-raw', seedImg)
  }

  create() {
    // Chroma-key: replace #FF00FF with transparent
    const srcTex = this.textures.get('seed-raw')
    const img = srcTex.getSourceImage() as HTMLImageElement
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const d = imageData.data
    const w = canvas.width

    // Pass 1: Chroma-key with soft edges using HSV-based magenta detection
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2]
      const max = Math.max(r, g, b), min = Math.min(r, g, b)
      const sat = max === 0 ? 0 : (max - min) / max
      // Hue check: magenta is ~300° → R high, G low, B high (widened thresholds)
      const isMagentaHue = r > 80 && b > 80 && g < Math.min(r, b) * 0.75
      if (isMagentaHue && sat > 0.2) {
        // How "magenta" is this pixel (1 = pure magenta, 0 = far)
        const magentaness = 1 - (g / Math.max(Math.min(r, b), 1))
        if (magentaness > 0.5) {
          d[i + 3] = 0
        } else if (magentaness > 0.15) {
          const alpha = Math.round((1 - (magentaness - 0.15) / 0.35) * 255)
          d[i + 3] = Math.min(d[i + 3], alpha)
          // Remove magenta spill from edge pixels
          const spill = Math.min(r, b) - g
          if (spill > 0) {
            const factor = 1 - alpha / 255
            d[i] = Math.max(0, r - Math.round(spill * factor))
            d[i + 1] = g  // keep green
            d[i + 2] = Math.max(0, b - Math.round(spill * factor))
          }
        }
      }
    }

    // Pass 2: Clean up isolated semi-transparent edge pixels (3×3 neighbor check)
    const alphaMap = new Uint8Array(d.length / 4)
    for (let i = 0; i < alphaMap.length; i++) alphaMap[i] = d[i * 4 + 3]
    const h = canvas.height
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x
        if (alphaMap[idx] > 0 && alphaMap[idx] < 220) {
          // Count transparent neighbors
          let transparent = 0
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue
              if (alphaMap[(y + dy) * w + (x + dx)] === 0) transparent++
            }
          }
          // If mostly surrounded by transparent, make this transparent too
          if (transparent >= 4) {
            const pi = idx * 4
            d[pi + 3] = 0
          }
        }
      }
    }
    ctx.putImageData(imageData, 0, 0)

    // Create spritesheet from processed canvas
    this.textures.addSpriteSheet('seed', canvas as unknown as HTMLImageElement, {
      frameWidth: SEED_FW,
      frameHeight: SEED_FH,
    })

    this.scene.start('Farm')
  }
}
