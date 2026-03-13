import Phaser from 'phaser'
import { fetchFarm, plantCrop, waterPlot, harvestPlot, upgradeVip, type FarmData, type Plot } from '../game/api'

// Map crop names to spritesheet row index (each row = 3 frames: tier1, tier2, tier3)
// Frame = row * 3 + (stage - 1)
const CROPS = ['carrot', 'tomato', 'corn', 'pumpkin', 'cabbage', 'radish', 'wheat', 'berry']
const CROP_ROW: Record<string, number> = Object.fromEntries(CROPS.map((c, i) => [c, i]))

// Consistent seed scale for all stages
const SEED_SCALE = 0.17

// Growth thresholds in seconds
const STAGE_THRESHOLDS = [0, 10, 15] // stage 1->2 at 10s from plantedAt, 2->3 at 15s from wateredAt

export class FarmScene extends Phaser.Scene {
  private plotSprites: { plot: Phaser.GameObjects.Sprite; seed: Phaser.GameObjects.Sprite; timer: Phaser.GameObjects.Text }[] = []
  private goldText!: Phaser.GameObjects.Text
  private vipText!: Phaser.GameObjects.Text
  private farmData!: FarmData
  private selectedAction: 'plant' | 'water' | 'harvest' | null = null
  private selectedCrop = 'carrot'
  private seedButtons: { sprite: Phaser.GameObjects.Sprite; highlight: Phaser.GameObjects.Graphics; lock: Phaser.GameObjects.Text; cropIndex: number }[] = []
  private pollTimer?: Phaser.Time.TimerEvent
  private countdownTimer?: Phaser.Time.TimerEvent
  private nextRefreshTimeout?: number
  private characterSprite!: Phaser.GameObjects.Sprite
  private currentGender: 'male' | 'female' = 'female'
  private petSprite!: Phaser.GameObjects.Sprite
  private currentPet = 'cat'
  private ytPlayer: YT.Player | null = null
  private ytReady = false
  private musicPlaying = false
  private musicNote: Phaser.GameObjects.Text | null = null

  constructor() {
    super('Farm')
  }

  async create() {
    // Fetch initial farm state
    try {
      this.farmData = await fetchFarm()
    } catch {
      this.farmData = { coins: 5000, plots: Array.from({ length: 16 }, (_, i) => ({ id: i + 1, crop: null, stage: 0 })) }
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

        const timerText = this.add.text(isoX, isoY + 18, '', {
          fontSize: '14px',
          fontFamily: 'Arial, sans-serif',
          fontStyle: 'bold',
          color: '#FFFFFF',
          stroke: '#000000',
          strokeThickness: 4,
          align: 'center',
        }).setOrigin(0.5, 0).setDepth(depth + 8).setVisible(false)

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
    this.petSprite.setInteractive({ useHandCursor: true })
    this.petSprite.on('pointerdown', () => this.togglePetMusic())

    // Music note indicator above pet
    this.musicNote = this.add.text(charX + 38, charY - 2, '♫', {
      fontSize: '18px',
      color: '#FFD700',
    }).setOrigin(0.5).setDepth(11).setVisible(false)

    // Init YouTube IFrame API
    this.initYouTube()

    // Listen for gender change from DevTools
    const onGenderChange = (e: Event) => {
      const gender = (e as CustomEvent).detail as 'male' | 'female'
      if (gender === this.currentGender) return
      this.currentGender = gender
      this.characterSprite.setTexture(gender, 0)
      this.characterSprite.play(`${gender}-walk-down`)
    }
    window.addEventListener('gender-changed', onGenderChange)
    this.events.on('destroy', () => window.removeEventListener('gender-changed', onGenderChange))

    // Listen for pet change from DevTools
    const onPetChange = (e: Event) => {
      const pet = (e as CustomEvent).detail as string
      if (pet === this.currentPet) return
      this.currentPet = pet
      this.petSprite.play(`pet-${pet}`)
      // Switch music if playing
      if (this.musicPlaying && this.ytReady && this.ytPlayer) {
        this.ytPlayer.loadVideoById(this.getPetVideoId())
      }
    }
    window.addEventListener('pet-changed', onPetChange)
    this.events.on('destroy', () => window.removeEventListener('pet-changed', onPetChange))

    // Schedule next refresh based on crop growth events
    this.scheduleNextRefresh()

    // Update countdown text every second (client-side)
    this.countdownTimer = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => this.updateCountdowns(),
    })

    // HUD — Gold (top-left)
    const goldBg = this.add.image(80, 30, 'gold')
    goldBg.setScale(0.3)
    goldBg.setDepth(10)
    goldBg.setScrollFactor(0)

    this.goldText = this.add.text(62, 13, this.formatCoins(this.farmData.coins), {
      fontSize: '20px',
      fontFamily: 'Georgia, serif',
      fontStyle: 'bold',
      color: '#FFFFFF',
      stroke: '#8B6B4A',
      strokeThickness: 3,
      shadow: {
        offsetX: 1,
        offsetY: 2,
        color: '#5C3D1A',
        blur: 3,
        fill: false,
        stroke: true,
      },
    }).setDepth(11).setScrollFactor(0).setOrigin(0, 0)

    // Listen for external updates (e.g. DevTools actions)
    const onExternalUpdate = async () => {
      try {
        this.farmData = await fetchFarm()
        this.renderPlots()
        this.scheduleNextRefresh()
      } catch { /* ignore */ }
    }
    window.addEventListener('devtools-updated', onExternalUpdate)
    this.events.on('destroy', () => window.removeEventListener('devtools-updated', onExternalUpdate))

    // HUD — VIP Level (top-right)
    this.vipText = this.add.text(this.scale.width - 10, 10, `VIP ${this.farmData.vipLevel}`, {
      fontSize: '16px',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold',
      color: '#FFD700',
      stroke: '#000000',
      strokeThickness: 3,
    }).setDepth(11).setScrollFactor(0).setOrigin(1, 0).setInteractive({ useHandCursor: true })

    this.vipText.on('pointerdown', async () => {
      try {
        const data = await upgradeVip()
        this.farmData = data
        this.renderPlots()
        window.dispatchEvent(new CustomEvent('farm-updated'))
      } catch (err) {
        console.error('VIP upgrade failed:', err)
      }
    })

    // Bottom UI — semi-transparent black background bar (seed picker)
    const barHeight = 140
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

    const VIP_CROP_COUNT = [1, 2, 4, 6, 8]

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

      this.seedButtons.push({ sprite: btn, highlight, lock, cropIndex: i })
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
      if (!plot.crop || plot.stage >= 3) return

      let remaining = Infinity
      if (plot.stage === 1 && plot.plantedAt) {
        const elapsed = now - plot.plantedAt
        remaining = 10 - elapsed
      } else if (plot.stage === 2 && plot.wateredAt) {
        const elapsed = now - plot.wateredAt
        remaining = 15 - elapsed
      }
      // stage 2 without wateredAt: paused, no schedule needed

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
      if (plot.crop && (plot.stage === 1 || (plot.stage === 2 && plot.wateredAt))) {
        plotSprite.setFrame(1) // wet: tier 1, or tier 2 after watering
      } else {
        plotSprite.setFrame(0) // dry: empty, tier 2 needs water, or tier 3
      }

      if (plot.crop && plot.stage > 0) {
        const row = CROP_ROW[plot.crop] ?? 0
        const frame = row * 3 + (plot.stage - 1)
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
    if (this.vipText) {
      this.vipText.setText(`VIP ${this.farmData.vipLevel}`)
    }

    this.updateCropLocks()
  }

  private updateCountdowns() {
    const now = Math.floor(Date.now() / 1000)
    this.farmData.plots.forEach((plot, i) => {
      if (i >= this.plotSprites.length) return
      const { timer } = this.plotSprites[i]

      if (!plot.crop || plot.stage >= 3) {
        timer.setVisible(false)
        return
      }

      if (plot.stage === 1 && plot.plantedAt) {
        // Countdown to tier 2
        const remaining = Math.max(0, 10 - (now - plot.plantedAt))
        if (remaining <= 0) { timer.setVisible(false); return }
        timer.setText(`${remaining}s`)
        timer.setVisible(true)
      } else if (plot.stage === 2 && !plot.wateredAt) {
        // Paused — needs water
        timer.setText('\ud83d\udca7')
        timer.setVisible(true)
      } else if (plot.stage === 2 && plot.wateredAt) {
        // Countdown to tier 3
        const remaining = Math.max(0, 15 - (now - plot.wateredAt))
        if (remaining <= 0) { timer.setVisible(false); return }
        timer.setText(`${remaining}s`)
        timer.setVisible(true)
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
    } else if (plot.stage === 2 && !plot.wateredAt) {
      action = 'water'
    } else if (plot.stage >= 3) {
      action = 'harvest'
    }

    if (!action) return

    // For harvest, capture sprite position before API call
    const plotIndex = this.farmData.plots.findIndex(p => p.id === plotId)
    let harvestX = 0, harvestY = 0
    if (action === 'harvest' && plotIndex >= 0 && plotIndex < this.plotSprites.length) {
      const { seed } = this.plotSprites[plotIndex]
      harvestX = seed.x
      harvestY = seed.y
    }

    try {
      let data: FarmData
      switch (action) {
        case 'plant':
          data = await plantCrop(plotId, this.selectedCrop)
          break
        case 'water':
          data = await waterPlot(plotId)
          break
        case 'harvest':
          data = await harvestPlot(plotId)
          break
      }
      this.farmData = data

      if (action === 'harvest') {
        this.playHarvestAnimation(harvestX, harvestY)
      }

      this.renderPlots()
      this.scheduleNextRefresh()
      window.dispatchEvent(new CustomEvent('farm-updated'))
    } catch (err) {
      console.error(`Action ${action} failed on plot ${plotId}:`, err)
    }
  }

  private playHarvestAnimation(x: number, y: number) {
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

    // ③ "+100" flies to HUD
    const flyText = this.add.text(x, y - 5, '+100', {
      fontSize: '18px',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold',
      color: '#FFD700',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(21)

    this.tweens.add({
      targets: flyText,
      x: 80,
      y: 30,
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

    // ④ "+100" floating text
    const plusText = this.add.text(x, y - 10, '+100', {
      fontSize: '16px',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold',
      color: '#FFD700',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(21)

    this.tweens.add({
      targets: plusText,
      y: y - 45,
      alpha: 0,
      duration: 800,
      ease: 'Quad.easeOut',
      onComplete: () => plusText.destroy(),
    })
  }

  private updateCropLocks() {
    const VIP_CROP_COUNT = [1, 2, 4, 6, 8]
    const vip = this.farmData.vipLevel
    const unlocked = vip >= 1 && vip <= 5 ? VIP_CROP_COUNT[vip - 1] : 0

    this.seedButtons.forEach(({ sprite, highlight, lock, cropIndex }) => {
      const isLocked = cropIndex >= unlocked
      sprite.setData('locked', isLocked)
      if (isLocked) {
        sprite.setTint(0x555555)
        highlight.setVisible(false)
        lock.setVisible(true)
      } else {
        sprite.clearTint()
        lock.setVisible(false)
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

  private getPetVideoId(): string {
    const PET_MUSIC: Record<string, string> = {
      cat: 'mf2sVtzRAlI',
      dog: 'XWfHABiB_RY',
      chicken: 'vN9FhEWBlG4',
      pig: 'vN9FhEWBlG4',
    }
    return PET_MUSIC[this.currentPet] ?? PET_MUSIC.cat
  }

  private initYouTube() {
    // Load YouTube IFrame API if not already loaded
    if (!(window as any).YT) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(tag)
    }

    const createPlayer = () => {
      // Hidden container for YT player
      let container = document.getElementById('yt-pet-player')
      if (!container) {
        container = document.createElement('div')
        container.id = 'yt-pet-player'
        container.style.position = 'absolute'
        container.style.width = '1px'
        container.style.height = '1px'
        container.style.overflow = 'hidden'
        container.style.opacity = '0'
        container.style.pointerEvents = 'none'
        document.body.appendChild(container)
      }

      this.ytPlayer = new YT.Player('yt-pet-player', {
        height: '1',
        width: '1',
        playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, modestbranding: 1 },
        events: {
          onReady: () => { this.ytReady = true },
        },
      })
    }

    if ((window as any).YT && (window as any).YT.Player) {
      createPlayer()
    } else {
      (window as any).onYouTubeIframeAPIReady = () => createPlayer()
    }
  }

  private togglePetMusic() {
    if (!this.ytReady || !this.ytPlayer) return

    if (this.musicPlaying) {
      this.ytPlayer.pauseVideo()
      this.musicPlaying = false
      this.musicNote?.setVisible(false)
    } else {
      this.ytPlayer.loadVideoById(this.getPetVideoId())
      this.ytPlayer.playVideo()
      this.musicPlaying = true
      this.musicNote?.setVisible(true)
      // Bounce animation for music note
      if (this.musicNote) {
        this.tweens.add({
          targets: this.musicNote,
          y: this.musicNote.y - 5,
          duration: 500,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        })
      }
    }
  }
}
