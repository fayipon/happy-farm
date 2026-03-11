import Phaser from 'phaser'
import { BootScene } from '../scenes/BootScene'
import { FarmScene } from '../scenes/FarmScene'

export function createGameConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    width: 390,
    height: 844,
    parent,
    backgroundColor: '#000000',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, FarmScene],
  }
}
