import type Phaser from 'phaser';
import { isVisible } from '../core/simulation';
import type { ScenarioSession } from '../core/scenario-types';
import type { Vec } from '../core/types';

type Project = (x: number, y: number) => Vec;
/** Draws announced mission routes, permitted patrol cones and active warning zones. */
export class ScenarioOverlay {
  private readonly graphics: Phaser.GameObjects.Graphics;
  constructor(scene: Phaser.Scene, private readonly project: Project) { this.graphics = scene.add.graphics().setDepth(100002); }
  update(session: ScenarioSession | null, hidden = false, level = 0): void {
    const g = this.graphics; g.clear(); if (!session || hidden) return;
    const { definition, runtime, state } = session;
    if (definition.escort) {
      g.lineStyle(2, 0xc9e3a5, .8);
      for (const [i, waypoint] of definition.escort.route.entries()) { if ((waypoint.level ?? 0) !== level) continue; const p = this.project(waypoint.x, waypoint.y); g.strokeEllipse(p.x, p.y, 38, 19); if (i > 0) { const previous = definition.escort.route[i - 1]; if ((previous.level ?? 0) !== level) continue; const q = this.project(previous.x, previous.y); g.lineBetween(q.x, q.y, p.x, p.y); } }
    }
    if (definition.stealth) for (const label of definition.stealth.guards) {
      const guard = state.entities.find(e => e.id === runtime.labels[label] && e.hp > 0);
      if (!guard || (guard.level ?? 0) !== level || !isVisible(state, 0, guard.x, guard.y, level)) continue;
      const points: Vec[] = [this.project(guard.x, guard.y)], angle = guard.facing * Math.PI / 4, half = definition.stealth.coneDegrees * Math.PI / 360;
      for (let step = 0; step <= 12; step++) { const direction = angle - half + 2 * half * step / 12; points.push(this.project(guard.x + Math.cos(direction) * definition.stealth.radius, guard.y + Math.sin(direction) * definition.stealth.radius)); }
      g.beginPath(); g.moveTo(points[0].x, points[0].y); for (const point of points.slice(1)) g.lineTo(point.x, point.y); g.closePath();
      g.fillStyle(0xffc16e, .13); g.fillPath(); g.lineStyle(1.5, 0xffc16e, .7); g.strokePath();
    }
    const warning = runtime.boss.telegraph;
    if (warning && (warning.level ?? 0) === level) {
      const p = this.project(warning.x, warning.y), color = warning.interrupted ? 0x8dedac : 0xff6c54;
      g.fillStyle(color, .22); g.fillEllipse(p.x, p.y, warning.radius * 90.51, warning.radius * 45.255);
      g.lineStyle(4, color, 1); g.strokeEllipse(p.x, p.y, warning.radius * 90.51, warning.radius * 45.255);
    }
  }
  destroy(): void { this.graphics.destroy(); }
}
