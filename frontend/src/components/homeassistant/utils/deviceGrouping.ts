import type { HAEntity, HADeviceGroup } from '../types';
import {
  groupTapoCamera, groupSmartSockets, groupSmartTV, groupEchoDot,
  groupHuaweiRouter, groupSystemBackups, groupSunAstronomy, groupHACloud, groupSystemUpdates,
} from './deviceFixedGroups';
import {
  groupNamedDevices, groupIndividualLights, groupRemainingSwitches,
  groupMobileDevices, groupClimate, groupAutomations, groupRemainingSensors,
} from './deviceDynamicGroups';

/**
 * Orchestrates all HA entity grouping strategies in priority order.
 * Returns consolidated HADeviceGroup[] from all strategies combined.
 */
export function groupAllDevices(entities: HAEntity[]): HADeviceGroup[] {
  const groups: HADeviceGroup[] = [];
  const consumed = new Set<string>();

  // 1-9: Fixed well-known device profiles
  const tapo = groupTapoCamera(entities, consumed);
  if (tapo) groups.push(tapo);

  groups.push(...groupSmartSockets(entities, consumed));

  const tv = groupSmartTV(entities, consumed);
  if (tv) groups.push(tv);

  const echo = groupEchoDot(entities, consumed);
  if (echo) groups.push(echo);

  const router = groupHuaweiRouter(entities, consumed);
  if (router) groups.push(router);

  const backups = groupSystemBackups(entities, consumed);
  if (backups) groups.push(backups);

  const sun = groupSunAstronomy(entities, consumed);
  if (sun) groups.push(sun);

  const cloud = groupHACloud(entities, consumed);
  if (cloud) groups.push(cloud);

  const updates = groupSystemUpdates(entities, consumed);
  if (updates) groups.push(updates);

  // 9.5-15: Dynamic generalized grouping
  groups.push(...groupNamedDevices(entities, consumed));
  groups.push(...groupIndividualLights(entities, consumed));
  groups.push(...groupRemainingSwitches(entities, consumed));
  groups.push(...groupMobileDevices(entities, consumed));
  groups.push(...groupClimate(entities, consumed));

  const automations = groupAutomations(entities, consumed);
  if (automations) groups.push(automations);

  const sensors = groupRemainingSensors(entities, consumed);
  if (sensors) groups.push(sensors);

  return groups;
}
