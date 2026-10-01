// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AI_OPENINGS, AI_PERSONALITIES, type AiConfig } from '../src/core/ai-policy';
import { SkirmishOptions } from '../src/ui/SkirmishOptions';

const initial = (): AiConfig => ({ difficulty: 'normal', personality: 'balanced', opening: 'infantry-rush' });
const mounted: SkirmishOptions[] = [];
afterEach(() => {
  for (const options of mounted.splice(0)) options.destroy();
  document.body.replaceChildren();
});

function setup(config = initial(), onChange = vi.fn<(config: AiConfig) => void>()) {
  const root = document.createElement('div');
  document.body.append(root);
  const options = new SkirmishOptions(root, config, onChange);
  mounted.push(options);
  return { root, options, onChange };
}

function select(root: ParentNode, key: keyof AiConfig): HTMLSelectElement {
  return root.querySelector<HTMLSelectElement>(`[data-ai-option="${key}"]`)!;
}

function choose(root: ParentNode, key: keyof AiConfig, value: string) {
  const control = select(root, key);
  control.value = value;
  control.dispatchEvent(new Event('input', { bubbles: true }));
  control.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('skirmish options', () => {
  it('mounts labelled native controls, equal economy rules, and the selected opening plan', () => {
    const { root, options, onChange } = setup();
    expect(root.querySelector('section')!.getAttribute('aria-label')).toBe('Skirmish AI');
    expect(root.querySelectorAll('select')).toHaveLength(3);
    for (const [key, label] of [['difficulty', 'Difficulty'], ['personality', 'Personality'], ['opening', 'Opening']] as const) {
      const control = select(root, key);
      expect(control.getAttribute('aria-label')).toBe(label);
      expect(control.closest('label')!.firstChild!.textContent).toBe(label);
      const descriptions = control.getAttribute('aria-describedby')!.split(' ');
      for (const id of descriptions) expect(document.getElementById(id)).not.toBeNull();
    }
    expect(select(root, 'difficulty').value).toBe('normal');
    expect(select(root, 'personality').value).toBe('balanced');
    expect(select(root, 'opening').value).toBe('infantry-rush');
    expect(root.textContent).toContain('same starting resources, costs, and gathering rules at every difficulty');
    expect(root.querySelector('[data-ai-opening-plan]')!.textContent).toContain('early infantry attack');
    expect(root.querySelector('[data-ai-opening-weakness]')!.textContent).toContain('few defenders at home');
    expect(root.querySelector('.skirmish-ai-plan')!.getAttribute('aria-live')).toBe('polite');
    expect(options.value).toEqual(initial());
    expect(onChange).not.toHaveBeenCalled();
  });

  it('emits each difficulty change once and keeps manually selected openings', () => {
    const { root, options, onChange } = setup();
    choose(root, 'difficulty', 'hard');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith({ ...initial(), difficulty: 'hard' });
    choose(root, 'opening', 'tower-defense');
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(options.value).toEqual({ difficulty: 'hard', personality: 'balanced', opening: 'tower-defense' });
    expect(root.querySelector('[data-ai-opening-plan]')!.textContent).toContain('Tower first');
    expect(root.querySelector('[data-ai-opening-weakness]')!.textContent).toContain('slows mobile troops and expansion');
    choose(root, 'difficulty', 'easy');
    expect(options.value.opening).toBe('tower-defense');
    choose(root, 'difficulty', 'easy');
    choose(root, 'opening', 'tower-defense');
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it.each([
    ['balanced', 'infantry-rush'],
    ['rush', 'infantry-rush'],
    ['fortify', 'tower-defense'],
    ['expand', 'fast-expansion'],
    ['raid', 'cavalry-raids'],
  ] as const)('chooses the %s personality opening before notifying callers', (personality, opening) => {
    const config: AiConfig = { difficulty: 'easy', personality: personality === 'balanced' ? 'rush' : 'balanced', opening: 'tower-defense' };
    const { root, options, onChange } = setup(config);
    onChange.mockImplementation(value => {
      expect(select(root, 'opening').value).toBe(opening);
      expect(options.value).toEqual(value);
    });
    choose(root, 'personality', personality);
    expect(options.value).toEqual({ difficulty: 'easy', personality, opening });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith({ difficulty: 'easy', personality, opening });
  });

  it('copies constructor input, update input, getter values, and callback values', () => {
    const config = initial();
    const { root, options, onChange } = setup(config);
    config.difficulty = 'hard';
    config.opening = 'cavalry-raids';
    expect(options.value).toEqual(initial());
    const current = options.value;
    current.personality = 'raid';
    expect(options.value.personality).toBe('balanced');
    const next: AiConfig = { difficulty: 'easy', personality: 'fortify', opening: 'fast-expansion' };
    options.update(next);
    next.difficulty = 'hard';
    next.opening = 'infantry-rush';
    expect(options.value).toEqual({ difficulty: 'easy', personality: 'fortify', opening: 'fast-expansion' });
    expect(select(root, 'difficulty').value).toBe('easy');
    expect(select(root, 'personality').value).toBe('fortify');
    expect(select(root, 'opening').value).toBe('fast-expansion');
    expect(root.querySelector('[data-ai-opening-plan]')!.textContent).toContain('Depot first');
    expect(onChange).not.toHaveBeenCalled();
    onChange.mockImplementation(value => {
      value.difficulty = 'hard';
      value.opening = 'tower-defense';
    });
    choose(root, 'opening', 'cavalry-raids');
    expect(options.value).toEqual({ difficulty: 'easy', personality: 'fortify', opening: 'cavalry-raids' });
    expect(select(root, 'difficulty').value).toBe('easy');
  });

  it('preserves focus and control nodes during updates', () => {
    const { root, options } = setup();
    const opening = select(root, 'opening');
    opening.focus();
    options.update({ difficulty: 'hard', personality: 'raid', opening: 'cavalry-raids' });
    expect(select(root, 'opening')).toBe(opening);
    expect(document.activeElement).toBe(opening);
    expect(opening.value).toBe('cavalry-raids');
  });

  it('removes listeners and only its own DOM, and tolerates repeated destruction', () => {
    const { root, options, onChange } = setup();
    const sibling = document.createElement('p');
    sibling.textContent = 'Other menu settings';
    root.prepend(sibling);
    const otherChange = vi.fn<(config: AiConfig) => void>();
    const other = new SkirmishOptions(root, initial(), otherChange);
    mounted.push(other);
    const difficulty = select(root, 'difficulty');
    const ids = Array.from(root.querySelectorAll('[id]'), element => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    options.destroy();
    options.destroy();
    difficulty.value = 'hard';
    difficulty.dispatchEvent(new Event('change', { bubbles: true }));
    options.update({ difficulty: 'hard', personality: 'raid', opening: 'cavalry-raids' });
    expect(onChange).not.toHaveBeenCalled();
    expect(options.value).toEqual(initial());
    expect(root.contains(sibling)).toBe(true);
    expect(root.querySelectorAll('.skirmish-options')).toHaveLength(1);
    choose(root, 'difficulty', 'hard');
    expect(otherChange).toHaveBeenCalledWith({ ...initial(), difficulty: 'hard' });
    expect(other.value.difficulty).toBe('hard');
  });

  it('rejects unknown runtime choices without inserting HTML', () => {
    const malicious = '<img src=x onerror=alert(1)>';
    const invalid = { difficulty: malicious, personality: malicious, opening: malicious } as unknown as AiConfig;
    const { root, options, onChange } = setup(invalid);
    expect(options.value).toEqual(initial());
    expect(root.querySelectorAll('img,script')).toHaveLength(0);
    const injected = document.createElement('option');
    injected.value = malicious;
    injected.textContent = malicious;
    select(root, 'opening').append(injected);
    choose(root, 'opening', malicious);
    expect(options.value).toEqual(initial());
    expect(select(root, 'opening').value).toBe('infantry-rush');
    expect(onChange).not.toHaveBeenCalled();
    expect(root.querySelectorAll('img,script')).toHaveLength(0);
    options.update(invalid);
    expect(select(root, 'opening').value).toBe('infantry-rush');
  });

  it('renders names, descriptions, plans, and weaknesses as plain text', () => {
    const malicious = '<img src=x onerror=alert(1)>';
    const personality = { ...AI_PERSONALITIES.balanced };
    const opening = { ...AI_OPENINGS['infantry-rush'] };
    try {
      AI_PERSONALITIES.balanced.name = malicious;
      AI_PERSONALITIES.balanced.description = malicious;
      AI_OPENINGS['infantry-rush'].name = malicious;
      AI_OPENINGS['infantry-rush'].plan = malicious;
      AI_OPENINGS['infantry-rush'].weakness = malicious;
      const { root } = setup();
      expect(select(root, 'personality').selectedOptions[0].textContent).toBe(malicious);
      expect(select(root, 'opening').selectedOptions[0].textContent).toBe(malicious);
      expect(root.querySelector('[data-ai-description="personality"]')!.textContent).toBe(malicious);
      expect(root.querySelector('[data-ai-opening-plan]')!.textContent).toBe(`Opening plan: ${malicious}`);
      expect(root.querySelector('[data-ai-opening-weakness]')!.textContent).toBe(`Weakness: ${malicious}`);
      expect(root.querySelectorAll('img,script')).toHaveLength(0);
    } finally {
      Object.assign(AI_PERSONALITIES.balanced, personality);
      Object.assign(AI_OPENINGS['infantry-rush'], opening);
    }
  });
});
