// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, expect, it } from 'vitest';

const styles = [
  'src/app/styles/02-workspace.css',
  'src/components/case/classroom-workspace.styles/01-app-shell.css',
  'src/components/case/classroom-workspace.styles/02-workspace-command-dock.css',
  'src/components/case/classroom-workspace.styles/03-media.css',
  'src/components/case/lecture-opening.css',
  'src/components/case/atlas-panels.css',
  'src/components/case/atlas-chart.css',
  'src/components/case/atlas-workspace.css',
];
let host: HTMLDivElement, sheet: HTMLStyleElement;
afterEach(() => {
  host?.remove();
  sheet?.remove();
});

function activeRules(rules: CSSRuleList, width: number, height: number): string {
  return [...rules]
    .map(rule => {
      if (rule.type === CSSRule.STYLE_RULE) return rule.cssText;
      if (rule.type !== CSSRule.MEDIA_RULE) return '';
      const media = rule as CSSMediaRule;
      const limits = [...media.conditionText.matchAll(/\((min|max)-(width|height):\s*(\d+)px\)/g)];
      const active =
        limits.length > 0 &&
        limits.every(([, bound, axis, size]) => {
          const actual = axis === 'width' ? width : height;
          return bound === 'min' ? actual >= Number(size) : actual <= Number(size);
        });
      return active ? activeRules(media.cssRules, width, height) : '';
    })
    .join('\n');
}

it.each([
  [1440, 900],
  [1000, 700],
  [820, 600],
  [390, 700],
  [840, 360],
  [390, 400],
])('reserves the model minimum ahead of the chart at %s by %s', (width, height) => {
  host = document.createElement('div');
  host.className = 'app-shell studio-experience teaching-studio lecture-opening atlas-workspace';
  host.innerHTML = `<main class="main-workspace"><div class="workspace-scene">
    <div class="lecture-stage atlas-explore-stage">
      <section class="viewport voice-viewport"><div class="three-canvas"></div></section>
      <aside class="atlas-tooth-inspector">Selected tooth</aside>
    </div><div class="atlas-odontogram">Chart</div>
  </div></main>`;
  document.body.append(host);
  sheet = document.createElement('style');
  // JSDOM cannot lay out a canvas or evaluate container queries. Keep the actual allocation
  // rules before VoiceHud's typography-only container query, then activate media conditions.
  const voice = readFileSync('src/components/teaching/VoiceHud.css', 'utf8').split('@container')[0];
  sheet.textContent = voice;
  document.head.append(sheet);
  const inheritedMinimum = parseFloat(getComputedStyle(host.querySelector('.viewport')!).minHeight);
  sheet.textContent = [voice, ...styles.map(file => readFileSync(file, 'utf8'))].join('\n');
  sheet.textContent = activeRules(sheet.sheet!.cssRules, width, height);
  const scene = host.querySelector('.workspace-scene')!;
  const stage = host.querySelector('.lecture-stage')!;
  const viewport = host.querySelector('.viewport')!;
  const chart = host.querySelector('.atlas-odontogram')!;
  const inspector = host.querySelector('.atlas-tooth-inspector')!;

  const allocated = getComputedStyle(stage);
  const contained = getComputedStyle(viewport);
  expect(parseFloat(allocated.minHeight)).toBeGreaterThanOrEqual(inheritedMinimum);
  expect(parseFloat(contained.minHeight)).toBeLessThanOrEqual(parseFloat(allocated.minHeight));
  expect(allocated.flexShrink).toBe('0');
  expect(allocated.display).toBe('grid');
  expect(allocated.gridTemplateRows.split('minmax').length - 1).toBe(1);
  expect(getComputedStyle(scene).overflow).toBe('auto');
  expect(getComputedStyle(chart).flexShrink).toBe('0');
  expect(stage.nextElementSibling).toBe(chart);
  if (width <= 850) {
    expect(getComputedStyle(inspector).display).toBe('none');
    expect(allocated.gridTemplateColumns).not.toContain('230px');
  } else {
    expect(getComputedStyle(inspector).overflowY).toBe('auto');
    expect(getComputedStyle(inspector).minHeight).toBe('0');
  }
  inspector.remove();
  expect(getComputedStyle(stage).minHeight).toBe(allocated.minHeight);
  expect(getComputedStyle(stage).flexShrink).toBe('0');
});

it.each([
  [1440, 900],
  [390, 700],
  [840, 360],
])('keeps the learner explanation below its allocated model at %s by %s', (width, height) => {
  host = document.createElement('div');
  host.className =
    'app-shell studio-experience teaching-studio lecture-opening atlas-workspace lecture-mode';
  host.innerHTML = `<main class="main-workspace" data-lecture-walkthrough="true"><div class="workspace-scene">
      <div class="lecture-stage learning-model-stage"><section class="viewport voice-viewport"></section></div>
      <section class="classroom-stage-bar">Playback</section>
      <section class="lecture-panel"><p class="lecture-takeaway">One short explanation.</p></section>
    </div></main>`;
  document.body.append(host);
  sheet = document.createElement('style');
  const voice = readFileSync('src/components/teaching/VoiceHud.css', 'utf8').split('@container')[0];
  sheet.textContent = voice;
  document.head.append(sheet);
  const voiceMinimum = parseFloat(getComputedStyle(host.querySelector('.viewport')!).minHeight);
  sheet.textContent = [
    voice,
    ...styles.map(file => readFileSync(file, 'utf8')),
    readFileSync('src/components/lecture-builder/lecture-builder.css', 'utf8'),
    readFileSync('src/components/lecture-builder/teacher-workspace.css', 'utf8'),
  ].join('\n');
  sheet.textContent = activeRules(sheet.sheet!.cssRules, width, height);
  const stage = host.querySelector('.learning-model-stage')!;
  const caption = host.querySelector('.lecture-panel')!;
  expect(parseFloat(getComputedStyle(stage).minHeight)).toBeGreaterThanOrEqual(voiceMinimum);
  expect(
    parseFloat(getComputedStyle(host.querySelector('.viewport')!).minHeight),
  ).toBeLessThanOrEqual(parseFloat(getComputedStyle(stage).minHeight));
  expect(getComputedStyle(stage).flexShrink).toBe('0');
  expect(getComputedStyle(caption).flexShrink).toBe('0');
  expect(getComputedStyle(host.querySelector('.workspace-scene')!).overflow).toBe('auto');
  expect(stage.nextElementSibling?.nextElementSibling).toBe(caption);
  expect(caption.parentElement).toBe(stage.parentElement);
  expect(host.querySelector('aside')).toBeNull();
  if (width <= 1050) expect(getComputedStyle(host).paddingBottom).toBe('0px');
});
