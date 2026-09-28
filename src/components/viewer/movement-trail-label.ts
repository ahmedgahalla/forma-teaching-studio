import { CanvasTexture, Sprite, SpriteMaterial, SRGBColorSpace } from 'three';

/** A canvas-backed label is captured alongside the model in snapshots and audience video. */
export function createMovementTrailLabel(text: string, color: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 336;
  canvas.height = 84;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#142230';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = color;
  context.fillRect(0, 0, 9, canvas.height);
  context.fillStyle = '#ffffff';
  context.font = '600 42px Arial, sans-serif';
  context.textBaseline = 'middle';
  context.fillText(text, 27, canvas.height / 2);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  const material = new SpriteMaterial({
    map: texture,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const sprite = new Sprite(material);
  sprite.name = text;
  sprite.center.set(0, 0.5);
  sprite.renderOrder = 8;
  return {
    sprite,
    dispose() {
      sprite.removeFromParent();
      material.dispose();
      texture.dispose();
    },
  };
}
