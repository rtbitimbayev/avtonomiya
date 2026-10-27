import { INTERACTION_RADIUS, RESOURCE_DATA, hasSupplies, type Point, type WorldObject, type SurvivorState, type ResourceKind } from './ResourceData';
export class InteractionSystem {
  constructor(readonly state: SurvivorState, readonly objects: WorldObject[]) {}
  nearest(player: Point) {
    return this.objects.filter(o => o.kind !== 'rock' && !this.state.collected.includes(o.id))
      .map(o => ({ object: o, distance: Math.hypot(player.x - o.x, player.y - o.y) }))
      .filter(o => o.distance <= INTERACTION_RADIUS)
      .sort((a, b) => a.distance - b.distance || a.object.id.localeCompare(b.object.id))[0]?.object;
  }
  interact(player: Point): { object: WorldObject; message: string } | null {
    const object = this.nearest(player); if (!object) return null;
    if (object.kind === 'shelter') {
      if (hasSupplies(this.state)) this.state.returned = true;
      return { object, message: 'Убежище. Здесь можно отдохнуть' };
    }
    const kind = object.kind as ResourceKind, resource = RESOURCE_DATA[kind];
    this.state.resources[kind] += resource.amount;
    this.state.collected.push(object.id);
    return { object, message: `${resource.label}: +${resource.amount}` };
  }
}
