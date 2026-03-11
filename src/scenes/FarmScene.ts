import Phaser from 'phaser'

export class FarmScene extends Phaser.Scene {
  constructor() {
    super('Farm')
  }

  create() {
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
    // depth: cloud2 (index 1) behind sun, others in front
    const cloudData = [
      { frame: 0, x: 0.15, y: 0.04, scale: 0.6, speed: 30000, depth: 3 },
      { frame: 1, x: 0.45, y: 0.08, scale: 0.5, speed: 40000, depth: 1 },
      { frame: 3, x: 0.85, y: 0.12, scale: 0.55, speed: 35000, depth: 3 },
    ]

    const w = this.scale.width
    const margin = 60 // off-screen buffer

    cloudData.forEach(({ frame, x, y, scale, speed, depth }) => {
      const cloud = this.add.sprite(w * x, this.scale.height * y, 'cloud', frame)
      cloud.setScale(scale)
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

    // 3x4 isometric farm grid
    const spriteScale = 0.30
    // 45° isometric grid - match sprite visual diamond
    const tileW = 55
    const tileH = 34
    const centerX = this.scale.width * 0.55
    const centerY = this.scale.height * 0.49

    let seedIndex = 0

    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 3; col++) {
        const isoX = centerX + (col - row) * tileW
        const isoY = centerY + (col + row - 2.5) * tileH
        const plot = this.add.sprite(isoX, isoY, 'farm', 0)
        plot.setOrigin(0.5, 0.5)
        plot.setScale(spriteScale)

        const seed = this.add.sprite(isoX, isoY, 'seed', seedIndex)
        seed.setOrigin(0.5, 0.85)
        seed.setScale(0.18)
        seedIndex++
      }
    }

    // Extra 3 plots at bottom-right diagonal
    const extraPlots = [
      { row: 1, col: 3 },
      { row: 2, col: 3 },
      { row: 3, col: 3 },
    ]
    extraPlots.forEach(({ row, col }) => {
      const isoX = centerX + (col - row) * tileW
      const isoY = centerY + (col + row - 2.5) * tileH
      const plot = this.add.sprite(isoX, isoY, 'farm', 0)
      plot.setOrigin(0.5, 0.5)
      plot.setScale(spriteScale)

      const seed = this.add.sprite(isoX, isoY, 'seed', seedIndex)
      seed.setOrigin(0.5, 0.85)
      seed.setScale(0.18)
      seedIndex++
    })

    // HUD — Gold (top-left)
    const goldBg = this.add.image(80, 30, 'gold')
    goldBg.setScale(0.3)
    goldBg.setDepth(10)
    goldBg.setScrollFactor(0)

    this.add.text(62, 13, '5,000', {
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

    // Bottom UI — semi-transparent black background bar
    const barHeight = 100
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

    // Bottom UI — 3 action buttons
    const btnY = this.scale.height - barHeight / 2
    const btnScale = 0.45
    const btnSpacing = 90
    const btnCenterX = this.scale.width / 2
    const btnFrames = [0, 1, 2]           // row 1: normal
    const btnSelectedFrames = [6, 7, 8]   // row 3: selected
    const buttons: Phaser.GameObjects.Sprite[] = []

    btnFrames.forEach((frame, i) => {
      const x = btnCenterX + (i - 1) * btnSpacing
      const btn = this.add.sprite(x, btnY, 'ui', frame)
      btn.setScale(btnScale)
      btn.setDepth(10)
      btn.setScrollFactor(0)
      btn.setInteractive({ useHandCursor: true })
      btn.setData('normalFrame', frame)
      btn.setData('selectedFrame', btnSelectedFrames[i])
      btn.setData('selected', false)

      btn.on('pointerover', () => btn.setScale(btnScale * 1.1))
      btn.on('pointerout', () => btn.setScale(btnScale))
      btn.on('pointerdown', () => {
        const isSelected = btn.getData('selected')
        // Deselect all buttons first
        buttons.forEach(b => {
          b.setData('selected', false)
          b.setFrame(b.getData('normalFrame'))
        })
        // Toggle: if was not selected, select it
        if (!isSelected) {
          btn.setData('selected', true)
          btn.setFrame(btn.getData('selectedFrame'))
        }
      })

      buttons.push(btn)
    })
  }
}
