import { AI_OPENINGS, AI_PERSONALITIES, DEFAULT_AI_CONFIG, type AiConfig } from '../core/ai-policy';

type Difficulty = AiConfig['difficulty'];
type Personality = AiConfig['personality'];
type Opening = AiConfig['opening'];

const difficulties: Record<Difficulty, string> = {
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard',
};
let nextId = 0;

function copyConfig(config: AiConfig): AiConfig {
  return {
    difficulty: Object.hasOwn(difficulties, config.difficulty) ? config.difficulty : DEFAULT_AI_CONFIG.difficulty,
    personality: Object.hasOwn(AI_PERSONALITIES, config.personality) ? config.personality : DEFAULT_AI_CONFIG.personality,
    opening: Object.hasOwn(AI_OPENINGS, config.opening) ? config.opening : DEFAULT_AI_CONFIG.opening,
  };
}

/** Owns its controls; callers receive copies and can update them without emitting a change. */
export class SkirmishOptions {
  private config: AiConfig;
  private readonly host: HTMLElement;
  private readonly difficulty: HTMLSelectElement;
  private readonly personality: HTMLSelectElement;
  private readonly opening: HTMLSelectElement;
  private readonly personalityDescription: HTMLElement;
  private readonly openingPlan: HTMLElement;
  private readonly openingWeakness: HTMLElement;
  private readonly removeListeners: Array<() => void> = [];
  private destroyed = false;

  constructor(root: HTMLElement, initial: AiConfig, private readonly onChange: (config: AiConfig) => void) {
    this.config = copyConfig(initial);
    const prefix = `skirmish-ai-${++nextId}`;
    this.host = document.createElement('section');
    this.host.className = 'skirmish-options';
    this.host.setAttribute('aria-label', 'Skirmish AI');

    const controls = document.createElement('div');
    controls.className = 'match-settings skirmish-ai-controls';
    this.difficulty = this.createSelect(controls, 'Difficulty', 'difficulty', difficulties);
    this.personality = this.createSelect(controls, 'Personality', 'personality', AI_PERSONALITIES);
    this.opening = this.createSelect(controls, 'Opening', 'opening', AI_OPENINGS);

    const resources = document.createElement('p');
    resources.id = `${prefix}-resources`;
    resources.className = 'skirmish-ai-resources';
    resources.textContent = 'Without a selected handicap, the AI uses the same starting resources, costs, and gathering rules at every difficulty.';
    this.difficulty.setAttribute('aria-describedby', resources.id);

    this.personalityDescription = document.createElement('p');
    this.personalityDescription.id = `${prefix}-personality`;
    this.personalityDescription.className = 'skirmish-ai-personality';
    this.personalityDescription.dataset.aiDescription = 'personality';
    this.personality.setAttribute('aria-describedby', this.personalityDescription.id);

    const plan = document.createElement('div');
    plan.className = 'skirmish-ai-plan';
    plan.setAttribute('aria-live', 'polite');
    plan.setAttribute('aria-atomic', 'true');
    this.openingPlan = document.createElement('p');
    this.openingPlan.id = `${prefix}-plan`;
    this.openingPlan.dataset.aiOpeningPlan = '';
    this.openingWeakness = document.createElement('p');
    this.openingWeakness.id = `${prefix}-weakness`;
    this.openingWeakness.dataset.aiOpeningWeakness = '';
    this.opening.setAttribute('aria-describedby', `${this.openingPlan.id} ${this.openingWeakness.id}`);
    plan.append(this.openingPlan, this.openingWeakness);
    this.host.append(controls, resources, this.personalityDescription, plan);
    root.append(this.host);

    this.listen(this.difficulty, () => {
      const difficulty = this.difficulty.value as Difficulty;
      if (Object.hasOwn(difficulties, difficulty)) this.commit({ ...this.config, difficulty });
      else this.render();
    });
    this.listen(this.personality, () => {
      const personality = this.personality.value as Personality;
      if (Object.hasOwn(AI_PERSONALITIES, personality) && personality !== this.config.personality) {
        this.commit({ ...this.config, personality, opening: AI_PERSONALITIES[personality].opening });
      } else this.render();
    });
    this.listen(this.opening, () => {
      const opening = this.opening.value as Opening;
      if (Object.hasOwn(AI_OPENINGS, opening)) this.commit({ ...this.config, opening });
      else this.render();
    });
    this.render();
  }

  get value(): AiConfig {
    return { ...this.config };
  }

  update(config: AiConfig): void {
    if (this.destroyed) return;
    this.config = copyConfig(config);
    this.render();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const remove of this.removeListeners.splice(0)) remove();
    this.host.remove();
  }

  private createSelect(
    parent: HTMLElement,
    title: string,
    key: keyof AiConfig,
    choices: Record<string, string | { name: string }>,
  ): HTMLSelectElement {
    const label = document.createElement('label');
    label.textContent = title;
    const select = document.createElement('select');
    select.dataset.aiOption = key;
    select.setAttribute('aria-label', title);
    for (const [value, choice] of Object.entries(choices)) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = typeof choice === 'string' ? choice : choice.name;
      select.append(option);
    }
    label.append(select);
    parent.append(label);
    return select;
  }

  private listen(select: HTMLSelectElement, listener: () => void): void {
    select.addEventListener('change', listener);
    this.removeListeners.push(() => select.removeEventListener('change', listener));
  }

  private commit(config: AiConfig): void {
    if (config.difficulty === this.config.difficulty && config.personality === this.config.personality && config.opening === this.config.opening) return;
    this.update(config);
    this.onChange(this.value);
  }

  private render(): void {
    this.difficulty.value = this.config.difficulty;
    this.personality.value = this.config.personality;
    this.opening.value = this.config.opening;
    this.personalityDescription.textContent = AI_PERSONALITIES[this.config.personality].description;
    const opening = AI_OPENINGS[this.config.opening];
    this.openingPlan.textContent = `Opening plan: ${opening.plan}`;
    this.openingWeakness.textContent = `Weakness: ${opening.weakness}`;
  }
}
