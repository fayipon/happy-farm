import Phaser from 'phaser'
import { fetchFarm, fetchSeeds, plantCrop, waterPlot, harvestPlot, queryFortuneWheel, applyFortuneWheel, type FarmData, type SeedsData } from '../game/api'

// Map crop names to spritesheet row index (each row = 3 frames: tier1, tier2, tier3)
// Frame = row * 3 + (stage - 1)
const CROPS = ['carrot', 'tomato', 'corn', 'pumpkin', 'cabbage', 'radish', 'wheat', 'berry']
const CROP_ROW: Record<string, number> = Object.fromEntries(CROPS.map((c, i) => [c, i]))

// Crop growth time in seconds (total). Each phase = growthTime / 2
const CROP_GROWTH_TIME: Record<string, number> = {
  carrot: 2 * 3600,
  tomato: 4 * 3600,
  corn: 6 * 3600,
  pumpkin: 12 * 3600,
  cabbage: 16 * 3600,
  radish: 24 * 3600,
  wheat: 24 * 3600,
  berry: 24 * 3600,
}

function getHalfGrowth(crop: string): number {
  return (CROP_GROWTH_TIME[crop.toLowerCase()] ?? 7200) / 2
}

/**
 * Calculate remaining seconds until growth phase completes.
 * Server timestamps (plantedAt/wateredAt) are in UTC+0 epoch seconds.
 * Date.now() returns UTC epoch ms.
 *
 * completionTime = serverTimestamp + halfGrowth
 * remaining      = completionTime - nowUTC
 */

function getGrowthRemaining(serverTimestamp: number, crop: string): number {
  const nowUTC = Math.floor(Date.now() / 1000)
  const halfGrowth = getHalfGrowth(crop)
  const completionTime = serverTimestamp + halfGrowth
  const remaining = Math.max(0, completionTime - nowUTC)
  console.log(`[Countdown] crop=${crop}, serverTs=${serverTimestamp}, nowUTC=${nowUTC}, halfGrowth=${halfGrowth}s(${halfGrowth/3600}h), completionTime=${completionTime}, remaining=${remaining}s(${(remaining/60).toFixed(1)}min)`)
  return remaining
}

// Consistent seed scale for all stages
const SEED_SCALE = 0.17

export class FarmScene extends Phaser.Scene {
  private plotSprites: { plot: Phaser.GameObjects.Sprite; seed: Phaser.GameObjects.Sprite; timer: Phaser.GameObjects.Text }[] = []
  private goldText!: Phaser.GameObjects.Text
  private vipBadgeText!: Phaser.GameObjects.Text
  private avatarSprite!: Phaser.GameObjects.Sprite
  private farmData!: FarmData
  private selectedCrop = 'carrot'
  private seedButtons: { sprite: Phaser.GameObjects.Sprite; highlight: Phaser.GameObjects.Graphics; lock: Phaser.GameObjects.Text; countText: Phaser.GameObjects.Text; cropIndex: number }[] = []
  private seedsData: SeedsData = {}
  private nextRefreshTimeout?: number
  private characterSprite!: Phaser.GameObjects.Sprite
  private currentGender: 'male' | 'female' = 'female'
  private petSprite!: Phaser.GameObjects.Sprite
  private currentPet = 'cat'

  constructor() {
    super('Farm')
  }

  async create() {
    // Fetch initial farm state
    try {
      this.farmData = await fetchFarm()
    } catch {
      this.farmData = { username: 'Player', coins: 5000, vipLevel: 1, skin_id: 0, pet: null, plots: Array.from({ length: 16 }, (_, i) => ({ id: i + 1, crop: null, status: 0, plantedAt: null, wateredAt: null, locked: i >= 2 })) }
    }
    try {
      this.seedsData = await fetchSeeds()
    } catch {
      this.seedsData = {}
    }

    const bg = this.add.image(0, 0, 'bg').setOrigin(0, 0)

    // Scale background to fill the game canvas
    const scaleX = this.scale.width / bg.width
    const scaleY = this.scale.height / bg.height
    const scale = Math.max(scaleX, scaleY)
    bg.setScale(scale)

    // Sun in the sky (row 3, col 3 = frame 10)
    const sun = this.add.sprite(this.scale.width * 0.75, this.scale.height * 0.06, 'sun', 10)
    sun.setScale(0.5)
    sun.setDepth(2)

    // Clouds in the sky — drifting animation
    const cloudData = [
      { frame: 0, x: 0.15, y: 0.04, scale: 0.6, speed: 30000, depth: 3 },
      { frame: 1, x: 0.45, y: 0.08, scale: 0.5, speed: 40000, depth: 1 },
      { frame: 3, x: 0.85, y: 0.12, scale: 0.55, speed: 35000, depth: 3 },
    ]

    const w = this.scale.width
    const margin = 60

    cloudData.forEach(({ frame, x, y, scale: s, speed, depth }) => {
      const cloud = this.add.sprite(w * x, this.scale.height * y, 'cloud', frame)
      cloud.setScale(s)
      cloud.setDepth(depth)

      const drift = () => {
        const remaining = w + margin - cloud.x
        const duration = (remaining / (w + 2 * margin)) * speed
        this.tweens.add({
          targets: cloud,
          x: w + margin,
          duration,
          ease: 'Linear',
          onComplete: () => {
            cloud.x = -margin
            drift()
          },
        })
      }
      drift()
    })

    // 4x4 isometric farm grid
    const spriteScale = 0.30
    const tileW = 52
    const tileH = 32
    const centerX = this.scale.width * 0.52
    const centerY = this.scale.height * 0.53

    // Farm sprite original size: 373 x 223
    // Diamond hitarea matching the isometric tile shape
    const fw = 373
    const fh = 223
    const hitPoly = new Phaser.Geom.Polygon([
      fw * 0.5, fh * 0.15,  // top
      fw * 0.95, fh * 0.5,  // right
      fw * 0.5, fh * 0.85,  // bottom
      fw * 0.05, fh * 0.5,  // left
    ])

    this.plotSprites = []
    let plotIndex = 0

    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const isoX = centerX + (col - row) * tileW
        const isoY = centerY + (col + row - 3) * tileH
        const depth = row + col  // back-to-front ordering
        const plotSprite = this.add.sprite(isoX, isoY, 'farm', 0)
        plotSprite.setOrigin(0.5, 0.5)
        plotSprite.setScale(spriteScale)
        plotSprite.setDepth(depth)

        const seedSprite = this.add.sprite(isoX, isoY, 'seed', 0)
        seedSprite.setOrigin(0.5, 0.85)
        seedSprite.setDepth(depth + 0.5)
        seedSprite.setVisible(false)

        const timerText = this.add.text(isoX + 14, isoY + 8, '', {
          fontSize: '9px',
          fontFamily: 'Arial, sans-serif',
          fontStyle: 'bold',
          color: '#FFFFFF',
          stroke: '#4A3520',
          strokeThickness: 2,
          align: 'center',
        }).setOrigin(0.5, 0).setDepth(depth + 8).setVisible(false).setRotation(-0.55)

        // Make plots interactive with diamond-shaped hit area
        const plotData = this.farmData.plots[plotIndex]
        plotSprite.setInteractive(hitPoly, Phaser.Geom.Polygon.Contains, true)
        plotSprite.setData('plotId', plotData.id)
        plotSprite.on('pointerdown', () => this.onPlotClick(plotData.id))

        this.plotSprites.push({ plot: plotSprite, seed: seedSprite, timer: timerText })
        plotIndex++
      }
    }

    // Render initial plot states
    this.renderPlots()

    // Character — standing near the farm
    const charX = this.scale.width * 0.64
    const charY = this.scale.height * 0.34

    this.anims.create({ key: 'female-walk-down', frames: this.anims.generateFrameNumbers('female', { start: 0, end: 3 }), frameRate: 2, repeat: -1 })
    this.anims.create({ key: 'male-walk-down', frames: this.anims.generateFrameNumbers('male', { start: 0, end: 3 }), frameRate: 2, repeat: -1 })

    this.characterSprite = this.add.sprite(charX, charY, this.currentGender, 0).setScale(0.32).setDepth(10)
    this.characterSprite.play(`${this.currentGender}-walk-down`)

    // Pet — next to the character (4 rows: cat, dog, chicken, pig)
    this.anims.create({ key: 'pet-cat', frames: this.anims.generateFrameNumbers('pet', { start: 0, end: 3 }), frameRate: 2, repeat: -1 })
    this.anims.create({ key: 'pet-dog', frames: this.anims.generateFrameNumbers('pet', { start: 4, end: 7 }), frameRate: 2, repeat: -1 })
    this.anims.create({ key: 'pet-chicken', frames: this.anims.generateFrameNumbers('pet', { start: 8, end: 11 }), frameRate: 2, repeat: -1 })
    this.anims.create({ key: 'pet-pig', frames: this.anims.generateFrameNumbers('pet', { start: 12, end: 15 }), frameRate: 2, repeat: -1 })
    this.petSprite = this.add.sprite(charX + 38, charY + 22, 'pet', 0).setScale(0.22).setDepth(10)
    this.petSprite.play(`pet-${this.currentPet}`)

    // Listen for gender change from DevTools
    const onGenderChange = (e: Event) => {
      const gender = (e as CustomEvent).detail as 'male' | 'female'
      if (gender === this.currentGender) return
      this.currentGender = gender
      this.characterSprite.setTexture(gender, 0)
      this.characterSprite.play(`${gender}-walk-down`)
      if (this.avatarSprite) {
        this.avatarSprite.setTexture(gender, 0)
      }
    }
    window.addEventListener('gender-changed', onGenderChange)
    this.events.on('destroy', () => window.removeEventListener('gender-changed', onGenderChange))

    // Listen for pet change from DevTools
    const onPetChange = (e: Event) => {
      const pet = (e as CustomEvent).detail as string
      if (pet === this.currentPet) return
      this.currentPet = pet
      this.petSprite.play(`pet-${pet}`)
    }
    window.addEventListener('pet-changed', onPetChange)
    this.events.on('destroy', () => window.removeEventListener('pet-changed', onPetChange))

    // Schedule next refresh based on crop growth events
    this.scheduleNextRefresh()

    // Update countdown text every second (client-side)
    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => this.updateCountdowns(),
    })

    // HUD — Avatar Bar (top-left)
    const AVATAR_SCALE = 0.16

    // Character avatar in the circle (rendered below the bar frame)
    const circleX = 55
    const circleY = 52
    const circleR = 24
    this.avatarSprite = this.add.sprite(circleX, circleY, this.currentGender, 0)
      .setScale(0.35)
      .setOrigin(0.5, 0.25)
      .setDepth(9)
      .setScrollFactor(0)
    const maskGfx = this.make.graphics()
    maskGfx.fillCircle(circleX, circleY, circleR)
    this.avatarSprite.setMask(maskGfx.createGeometryMask())

    // Avatar bar frame (on top of character)
    this.add.image(3, -10, 'avatar-bar').setOrigin(0, 0).setScale(AVATAR_SCALE).setDepth(10).setScrollFactor(0)

    // VIP level badge on shield
    this.vipBadgeText = this.add.text(80, 32, `${this.farmData.vipLevel}`, {
      fontSize: '14px',
      fontFamily: 'Georgia, serif',
      fontStyle: 'bold',
      color: '#FFFFFF',
      stroke: '#333366',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(12).setScrollFactor(0)

    // Username (top of bar) — left aligned
    const textLeft = 100
    this.add.text(textLeft, 40, this.farmData.username || 'Player', {
      fontSize: '14px',
      fontFamily: 'Georgia, serif',
      fontStyle: 'bold',
      color: '#FFFFFF',
      stroke: '#8B6B4A',
      strokeThickness: 2,
      shadow: {
        offsetX: 1,
        offsetY: 1,
        color: '#5C3D1A',
        blur: 2,
        fill: false,
        stroke: true,
      },
    }).setOrigin(0, 0.5).setDepth(11).setScrollFactor(0)

    // Gold coins (bottom of bar) — left aligned
    this.goldText = this.add.text(textLeft, 58, this.formatCoins(this.farmData.coins), {
      fontSize: '14px',
      fontFamily: 'Georgia, serif',
      fontStyle: 'bold',
      color: '#FFD700',
      stroke: '#8B6B4A',
      strokeThickness: 2,
      shadow: {
        offsetX: 1,
        offsetY: 2,
        color: '#5C3D1A',
        blur: 3,
        fill: false,
        stroke: true,
      },
    }).setDepth(11).setScrollFactor(0).setOrigin(0, 0.5)

    // Listen for external updates (e.g. DevTools actions)
    const onExternalUpdate = async () => {
      try {
        this.farmData = await fetchFarm()
        this.seedsData = await fetchSeeds()
        this.renderPlots()
        this.scheduleNextRefresh()
      } catch { /* ignore */ }
    }
    window.addEventListener('devtools-updated', onExternalUpdate)
    this.events.on('destroy', () => window.removeEventListener('devtools-updated', onExternalUpdate))

    // Bottom UI — semi-transparent black background bar (seed picker)
    const barHeight = 140

    // Rule icon (top-right floating)
    const ruleIcon = this.add.image(this.scale.width - 30, 45, 'rule-icon')
      .setScale(0.045)
      .setDepth(10)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })

    // Rule detail popup (hidden by default)
    const overlay = this.add.rectangle(
      this.scale.width / 2, this.scale.height / 2,
      this.scale.width, this.scale.height,
      0x000000, 0.6
    ).setDepth(50).setScrollFactor(0).setVisible(false).setInteractive()

    const ruleDetail = this.add.image(this.scale.width / 2, this.scale.height / 2, 'rule-detail')
      .setScale(Math.min((this.scale.width - 40) / 1024, (this.scale.height - 80) / 1024))
      .setDepth(51)
      .setScrollFactor(0)
      .setVisible(false)

    const ruleText = this.add.text(this.scale.width / 2, this.scale.height / 2 + 25, [
      '1. Plant crops on empty fields.',
      '2. Water crops to help growth.',
      '3. Harvest when crops are ready.',
      '4. Earn coins from every harvest.',
      '5. Unlock more land and expand',
      '    your farm.',
      '',
      'Plant crops and collect rewards!',
    ].join('\n'), {
      fontSize: '14px',
      fontFamily: 'Georgia, serif',
      fontStyle: 'bold',
      color: '#5C3D1A',
      lineSpacing: 6,
      align: 'left',
      wordWrap: { width: 270 },
    }).setOrigin(0.5).setDepth(52).setScrollFactor(0).setVisible(false)

    ruleIcon.on('pointerdown', () => {
      overlay.setVisible(true)
      ruleDetail.setVisible(true)
      ruleText.setVisible(true)
    })

    overlay.on('pointerdown', () => {
      overlay.setVisible(false)
      ruleDetail.setVisible(false)
      ruleText.setVisible(false)
    })

    const bar = this.add.rectangle(
      this.scale.width / 2,
      this.scale.height - barHeight / 2,
      this.scale.width,
      barHeight,
      0x000000,
      0.5
    )
    bar.setDepth(9)
    bar.setScrollFactor(0)

    // Bottom UI — Seed selection grid (4x2) using tier 3 sprites
    const cols = 4
    const seedRowY1 = this.scale.height - barHeight + 30
    const seedRowSpacing = 55
    const seedScale = 0.13
    const seedSpacing = this.scale.width / (cols + 1)
    this.seedButtons = []

    CROPS.forEach((crop, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const x = seedSpacing * (col + 1)
      const y = seedRowY1 + row * seedRowSpacing
      const tier3Frame = i * 3 + 2 // tier 3 = col 2

      // Selection highlight circle behind the seed icon
      const highlight = this.add.graphics()
      highlight.fillStyle(0xffcc00, 0.4)
      highlight.fillCircle(x, y, 26)
      highlight.lineStyle(2, 0xffcc00, 1)
      highlight.strokeCircle(x, y, 26)
      highlight.setDepth(9.5)
      highlight.setScrollFactor(0)
      highlight.setVisible(crop === this.selectedCrop)

      const btn = this.add.sprite(x, y, 'seed', tier3Frame)
      btn.setScale(seedScale)
      btn.setDepth(10)
      btn.setScrollFactor(0)
      btn.setInteractive({ useHandCursor: true })
      btn.setData('crop', crop)

      // Lock icon for VIP-locked crops
      const lock = this.add.text(x, y, '🔒', {
        fontSize: '16px',
      }).setOrigin(0.5).setDepth(10.5).setScrollFactor(0).setVisible(false)

      // Seed count label
      const countText = this.add.text(x + 18, y + 18, '', {
        fontSize: '12px',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        color: '#FFFFFF',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5).setDepth(10.5).setScrollFactor(0)

      btn.on('pointerover', () => {
        if (!btn.getData('locked')) btn.setScale(seedScale * 1.2)
      })
      btn.on('pointerout', () => btn.setScale(seedScale))
      btn.on('pointerdown', () => {
        if (btn.getData('locked')) return
        this.seedButtons.forEach(b => b.highlight.setVisible(false))
        highlight.setVisible(true)
        this.selectedCrop = crop
      })

      this.seedButtons.push({ sprite: btn, highlight, lock, countText, cropIndex: i })
    })

    // Initial crop lock state
    this.updateCropLocks()
  }

  private formatCoins(n: number): string {
    return n.toLocaleString()
  }

  private scheduleNextRefresh() {
    // Clear any existing scheduled refresh
    if (this.nextRefreshTimeout) {
      clearTimeout(this.nextRefreshTimeout)
      this.nextRefreshTimeout = undefined
    }

    const now = Math.floor(Date.now() / 1000)
    let minRemaining = Infinity

    // Find the soonest stage transition across all plots
    this.farmData.plots.forEach(plot => {
      if (!plot.crop || plot.status === 0) return

      let remaining = Infinity
      if (plot.status === 1 && plot.plantedAt) {
        remaining = getGrowthRemaining(plot.plantedAt, plot.crop)
      } else if (plot.status === 2 && plot.wateredAt) {
        remaining = getGrowthRemaining(plot.wateredAt, plot.crop)
      }

      if (remaining > 0 && remaining < minRemaining) {
        minRemaining = remaining
      }
    })

    if (minRemaining < Infinity) {
      // Schedule refresh right when the next stage transition happens (+500ms buffer)
      this.nextRefreshTimeout = window.setTimeout(async () => {
        try {
          this.farmData = await fetchFarm()
          this.renderPlots()
        } catch { /* ignore */ }
        // Schedule the next one
        this.scheduleNextRefresh()
        window.dispatchEvent(new CustomEvent('farm-updated'))
      }, (minRemaining * 1000) + 500)
    }
  }

  private renderPlots() {
    this.farmData.plots.forEach((plot, i) => {
      if (i >= this.plotSprites.length) return
      const { plot: plotSprite, seed, timer } = this.plotSprites[i]

      // Locked plots
      if (plot.locked) {
        plotSprite.setFrame(2) // locked
        seed.setVisible(false)
        timer.setVisible(false)
        return
      }

      // Farm tile frame: 0=dry, 1=wet
      if (plot.crop && plot.status === 1 && plot.plantedAt && getGrowthRemaining(plot.plantedAt, plot.crop) > 0) {
        plotSprite.setFrame(1) // wet: planted and still growing
      } else if (plot.crop && plot.status === 2 && plot.wateredAt) {
        plotSprite.setFrame(1) // wet: watered
      } else {
        plotSprite.setFrame(0) // dry
      }

      if (plot.crop && plot.status >= 1) {
        const row = CROP_ROW[plot.crop.toLowerCase()] ?? 0
        let tier: number
        if (plot.status === 1) {
          tier = 0 // tier1: seedling
        } else if (plot.status === 2 && plot.wateredAt) {
          const remaining = getGrowthRemaining(plot.wateredAt, plot.crop)
          tier = remaining <= 0 ? 2 : 1 // tier3 if harvestable, tier2 if growing
        } else {
          tier = 1
        }
        const frame = row * 3 + tier
        seed.setFrame(frame)
        seed.setScale(SEED_SCALE)
        seed.setVisible(true)
      } else {
        seed.setVisible(false)
        timer.setVisible(false)
      }
    })

    this.updateCountdowns()

    if (this.goldText) {
      this.goldText.setText(this.formatCoins(this.farmData.coins))
    }
    if (this.vipBadgeText) {
      this.vipBadgeText.setText(`${this.farmData.vipLevel}`)
    }

    this.updateCropLocks()
  }

  private updateCountdowns() {
    this.farmData.plots.forEach((plot, i) => {
      if (i >= this.plotSprites.length) return
      const { timer } = this.plotSprites[i]

      if (!plot.crop || plot.status === 0) {
        timer.setVisible(false)
        return
      }

      if (plot.status === 1 && plot.plantedAt) {
        // Status 1: planted, check if first-half growth time has elapsed
        const remaining = getGrowthRemaining(plot.plantedAt, plot.crop)
        if (remaining <= 0) {
          // Growth done → show 💧 (ready for watering)
          timer.setText('💧')
          timer.setVisible(true)
        } else {
          // Still growing → show countdown
          const h = Math.floor(remaining / 3600)
          const m = Math.floor((remaining % 3600) / 60)
          const s = remaining % 60
          timer.setText(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`)
          timer.setVisible(true)
        }
      } else if (plot.status === 2 && plot.wateredAt) {
        // Status 2: watered, countdown second half
        const remaining = getGrowthRemaining(plot.wateredAt, plot.crop)
        if (remaining <= 0) {
          // Growth done → harvestable
          timer.setText('🌾')
          timer.setVisible(true)
        } else {
          const h = Math.floor(remaining / 3600)
          const m = Math.floor((remaining % 3600) / 60)
          const s = remaining % 60
          timer.setText(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`)
          timer.setVisible(true)
        }
      } else {
        timer.setVisible(false)
      }
    })
  }

  private async onPlotClick(plotId: number) {
    const plot = this.farmData.plots.find(p => p.id === plotId)
    if (!plot || plot.locked) return

    // Smart action: auto-detect based on plot state
    let action: 'plant' | 'water' | 'harvest' | null = null
    if (!plot.crop) {
      action = 'plant'
    } else if (plot.status === 1 && plot.plantedAt) {
      // Only allow watering if first-half growth time has elapsed
      const remaining = getGrowthRemaining(plot.plantedAt, plot.crop)
      if (remaining <= 0) {
        action = 'water'
      }
    } else if (plot.status === 2 && plot.wateredAt) {
      // Only allow harvest if second-half growth time has elapsed
      const remaining = getGrowthRemaining(plot.wateredAt, plot.crop)
      if (remaining <= 0) {
        action = 'harvest'
      }
    }

    if (!action) return

    // For harvest, capture sprite position before API call
    const plotIndex = this.farmData.plots.findIndex(p => p.id === plotId)
    let harvestX = 0, harvestY = 0
    let harvestReward = 0
    if (action === 'harvest' && plotIndex >= 0 && plotIndex < this.plotSprites.length) {
      const { seed } = this.plotSprites[plotIndex]
      harvestX = seed.x
      harvestY = seed.y
    }

    try {
      switch (action) {
        case 'plant':
          await plantCrop(plotId, this.selectedCrop)
          break
        case 'water':
          await waterPlot(plotId)
          break
        case 'harvest': {
          const harvestData = await harvestPlot(plotId)
          console.log('[Harvest] response harvest:', JSON.stringify(harvestData.harvest))
          // Query fortune wheel with harvested crop name
          let rewardAmount = 0
          if (harvestData.harvest) {
            for (const cropName of Object.keys(harvestData.harvest)) {
              try {
                const wheelId = await queryFortuneWheel(cropName)
                if (wheelId) {
                  console.log(`[FortuneWheel] got ID=${wheelId} for crop=${cropName}, applying...`)
                  const amount = await applyFortuneWheel(wheelId)
                  rewardAmount += amount
                  console.log(`[FortuneWheel] reward amount: ${amount}`)
                } else {
                  console.warn(`[FortuneWheel] no wheel ID found for crop=${cropName}`)
                }
              } catch (e) {
                console.error(`[FortuneWheel] failed for ${cropName}:`, e)
              }
            }
          }
          harvestReward = rewardAmount
          break
        }
      }

      // Re-fetch full farm state to ensure consistency
      this.farmData = await fetchFarm()

      if (action === 'plant') {
        this.seedsData = await fetchSeeds()
      }

      if (action === 'harvest') {
        this.playHarvestAnimation(harvestX, harvestY, harvestReward)
      }

      this.renderPlots()
      this.scheduleNextRefresh()
      window.dispatchEvent(new CustomEvent('farm-updated'))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`Action ${action} failed on plot ${plotId}:`, err)
      this.showToast(msg)
    }
  }

  private playHarvestAnimation(x: number, y: number, reward: number = 0) {
    // ① Bounce particles — small circles burst outward
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6
      const particle = this.add.circle(x, y, 4, 0xFFD700)
      particle.setDepth(20)

      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * Phaser.Math.Between(20, 40),
        y: y + Math.sin(angle) * Phaser.Math.Between(20, 40) - 15,
        alpha: 0,
        scale: 0.3,
        duration: 400,
        ease: 'Quad.easeOut',
        onComplete: () => particle.destroy(),
      })
    }

    // ② Sparkle stars
    for (let i = 0; i < 4; i++) {
      const star = this.add.text(
        x + Phaser.Math.Between(-15, 15),
        y + Phaser.Math.Between(-10, 5),
        '✦',
        { fontSize: '14px', color: '#FFD700' }
      ).setOrigin(0.5).setDepth(20)

      this.tweens.add({
        targets: star,
        y: star.y - Phaser.Math.Between(15, 30),
        alpha: 0,
        duration: 500,
        delay: Phaser.Math.Between(0, 150),
        ease: 'Quad.easeOut',
        onComplete: () => star.destroy(),
      })
    }

    // ③ Reward amount flies to HUD
    const rewardText = reward > 0 ? `+${reward}` : '+0'
    const flyText = this.add.text(x, y - 5, rewardText, {
      fontSize: '18px',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold',
      color: '#FFD700',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(21)

    this.tweens.add({
      targets: flyText,
      x: this.goldText?.x ?? 148,
      y: this.goldText?.y ?? 62,
      scale: 0.6,
      duration: 600,
      delay: 150,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        flyText.destroy()
        // Flash gold text
        if (this.goldText) {
          this.tweens.add({
            targets: this.goldText,
            scale: 1.3,
            duration: 100,
            yoyo: true,
            ease: 'Quad.easeOut',
          })
        }
      },
    })
  }

  private updateCropLocks() {
    const VIP_CROP_COUNT = [1, 2, 4, 6, 8]
    const vip = this.farmData.vipLevel
    const unlocked = vip >= 1 && vip <= 5 ? VIP_CROP_COUNT[vip - 1] : 0

    this.seedButtons.forEach(({ sprite, highlight, lock, countText, cropIndex }) => {
      const isLocked = cropIndex >= unlocked
      sprite.setData('locked', isLocked)
      const crop = CROPS[cropIndex]
      const key = `SEED_${crop.toUpperCase()}`
      const count = this.seedsData[key] ?? 0
      countText.setText(`${count}`)
      if (isLocked) {
        sprite.setTint(0x555555)
        highlight.setVisible(false)
        lock.setVisible(true)
        countText.setVisible(false)
      } else {
        sprite.clearTint()
        lock.setVisible(false)
        countText.setVisible(true)
      }
    })

    // If selected crop is now locked, auto-select first available
    const selectedIdx = CROPS.indexOf(this.selectedCrop)
    if (selectedIdx >= unlocked) {
      this.selectedCrop = CROPS[0]
      this.seedButtons.forEach(({ highlight, cropIndex }) => {
        highlight.setVisible(cropIndex === 0)
      })
    }
  }

  private showToast(message: string) {
    const cx = this.scale.width / 2
    const cy = this.scale.height / 2

    const bg = this.add.graphics()
    bg.setDepth(100).setScrollFactor(0).setAlpha(0)

    const txt = this.add.text(cx, cy, message, {
      fontSize: '14px',
      fontFamily: 'Arial, sans-serif',
      color: '#FFFFFF',
      align: 'center',
      wordWrap: { width: 260 },
    }).setOrigin(0.5).setDepth(101).setScrollFactor(0).setAlpha(0)

    const bounds = txt.getBounds()
    const padX = 16
    const padY = 10
    bg.fillStyle(0x000000, 0.75)
    bg.fillRoundedRect(
      bounds.x - padX,
      bounds.y - padY,
      bounds.width + padX * 2,
      bounds.height + padY * 2,
      8
    )

    this.tweens.add({
      targets: [bg, txt],
      alpha: 1,
      duration: 200,
      ease: 'Quad.easeOut',
    })

    this.time.delayedCall(2500, () => {
      this.tweens.add({
        targets: [bg, txt],
        alpha: 0,
        duration: 300,
        ease: 'Quad.easeIn',
        onComplete: () => {
          bg.destroy()
          txt.destroy()
        },
      })
    })
  }
}
