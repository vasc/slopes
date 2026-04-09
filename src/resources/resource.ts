import type { Resource, ResourceType } from "../types.ts";

/** Create a new resource in intact state */
export function createResource(
	type: ResourceType,
	name: string,
	damageThreshold: number,
	value: number,
): Resource {
	return {
		type,
		name,
		damageThreshold,
		value,
		state: { status: "intact", accumulatedDamage: 0 },
	};
}

/** Apply damage to a resource, returning updated resource */
export function applyDamage(resource: Resource, damage: number, tick: number): Resource {
	if (resource.state.status === "destroyed") {
		return resource;
	}

	const newDamage = resource.state.accumulatedDamage + damage;

	if (newDamage >= resource.damageThreshold) {
		return {
			...resource,
			state: { status: "destroyed", destroyedAtTick: tick },
		};
	}

	return {
		...resource,
		state: { status: "intact", accumulatedDamage: newDamage },
	};
}

/** Check if a resource is still intact */
export function isIntact(resource: Resource): boolean {
	return resource.state.status === "intact";
}

/** Get the total value of an array of resources */
export function totalResourceValue(resources: readonly Resource[]): number {
	let total = 0;
	for (const r of resources) {
		total += r.value;
	}
	return total;
}
