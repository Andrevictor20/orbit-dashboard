import type { HAEntity, HADeviceGroup } from '../types';
import { resolveEntityArea, isTechnicalEntity } from './areaResolver';

const SENSOR_EXCLUSIONS = ['temperature', 'temperatura', 'humidity', 'umidade', 'door', 'porta', 'motion', 'presenca'];
const isExcluded = (id: string) => SENSOR_EXCLUSIONS.some(ex => id.includes(ex)) || id.startsWith('camera.') || id.startsWith('climate.');

/**
 * Groups 9.5-15: Dynamic device grouping (named devices, lights, switches, etc.)
 */

export function groupNamedDevices(entities: HAEntity[], consumed: Set<string>): HADeviceGroup[] {
  const groups: HADeviceGroup[] = [];
  const entitiesWithDeviceName = entities.filter(e => !consumed.has(e.entity_id) && e.device_name?.trim() && !isTechnicalEntity(e));
  if (entitiesWithDeviceName.length === 0) return groups;

  const deviceNameMap = new Map<string, HAEntity[]>();
  entitiesWithDeviceName.forEach(e => {
    const dName = e.device_name!.trim();
    if (!deviceNameMap.has(dName)) deviceNameMap.set(dName, []);
    deviceNameMap.get(dName)!.push(e);
  });

  deviceNameMap.forEach((deviceEnts, dName) => {
    deviceEnts.forEach(e => consumed.add(e.entity_id));
    const primary =
      deviceEnts.find(e => e.entity_id.startsWith('light.')) ||
      deviceEnts.find(e => e.entity_id.startsWith('switch.')) ||
      deviceEnts.find(e => e.entity_id.startsWith('climate.')) ||
      deviceEnts.find(e => e.entity_id.startsWith('media_player.')) ||
      deviceEnts.find(e => e.entity_id.startsWith('camera.')) ||
      deviceEnts.find(e => e.entity_id.startsWith('sensor.')) ||
      deviceEnts[0];
    const [domain] = primary.entity_id.split('.');
    let cat: any = 'other';
    if (domain === 'light') cat = 'light';
    else if (domain === 'switch') cat = 'switch';
    else if (domain === 'climate') cat = 'climate';
    else if (domain === 'media_player') cat = 'media';
    else if (domain === 'camera') cat = 'camera';
    else if (domain === 'sensor' || domain === 'binary_sensor') cat = 'sensor';
    const area = deviceEnts.map(e => resolveEntityArea(e)).find(Boolean) || resolveEntityArea(primary, dName);
    const isOn = primary.state === 'on';
    groups.push({
      id: `ha_device_${dName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`, name: dName, category: cat, primaryEntity: primary, entities: deviceEnts, area,
      summary: `${deviceEnts.length} entidades integradas`,
      stateBadge: { text: isOn ? 'Ligado' : primary.state === 'off' ? 'Desligado' : primary.state, variant: isOn ? 'success' : 'neutral' },
    });
  });
  return groups;
}

export function groupIndividualLights(entities: HAEntity[], consumed: Set<string>): HADeviceGroup[] {
  const groups: HADeviceGroup[] = [];
  const lightEntities = entities.filter(e => e.entity_id.startsWith('light.') && !consumed.has(e.entity_id));
  lightEntities.forEach(light => {
    consumed.add(light.entity_id);
    const friendlyName = light.attributes.friendly_name || light.entity_id.split('.')[1].replace(/_/g, ' ');
    const lightBase = light.entity_id.replace('light.', '');
    const related = entities.filter(e => {
      if (consumed.has(e.entity_id)) return false;
      const id = e.entity_id.toLowerCase();
      return !isExcluded(id) && id.includes(lightBase);
    });
    related.forEach(r => consumed.add(r.entity_id));
    const isOn = light.state === 'on';
    const bri = light.attributes.brightness ? Math.round((light.attributes.brightness / 255) * 100) : null;
    const summary = isOn ? (bri ? `Ligada · Brilho ${bri}%` : 'Ligada') : 'Desligada';
    const area = resolveEntityArea(light, friendlyName);
    groups.push({
      id: light.entity_id, name: friendlyName, category: 'light', primaryEntity: light, entities: [light, ...related], area, summary,
      stateBadge: { text: isOn ? 'Ligada' : 'Desligada', variant: isOn ? 'warning' : 'neutral' },
    });
  });
  return groups;
}

export function groupRemainingSwitches(entities: HAEntity[], consumed: Set<string>): HADeviceGroup[] {
  const groups: HADeviceGroup[] = [];
  const remainingSwitches = entities.filter(e => e.entity_id.startsWith('switch.') && !consumed.has(e.entity_id));
  remainingSwitches.forEach(sw => {
    consumed.add(sw.entity_id);
    const friendlyName = sw.attributes.friendly_name || sw.entity_id.split('.')[1].replace(/_/g, ' ');
    const swBase = sw.entity_id.replace('switch.', '').toLowerCase();
    const related = entities.filter(e => {
      if (consumed.has(e.entity_id)) return false;
      const id = e.entity_id.toLowerCase();
      return !isExcluded(id) && id.includes(swBase);
    });
    related.forEach(r => consumed.add(r.entity_id));
    const isOn = sw.state === 'on';
    const area = resolveEntityArea(sw, friendlyName);
    groups.push({
      id: sw.entity_id, name: friendlyName, category: 'switch', primaryEntity: sw, entities: [sw, ...related], area,
      summary: isOn ? 'Ligada' : 'Desligada',
      stateBadge: { text: isOn ? 'Ligada' : 'Desligada', variant: isOn ? 'success' : 'neutral' },
    });
  });
  return groups;
}

export function groupMobileDevices(entities: HAEntity[], consumed: Set<string>): HADeviceGroup[] {
  const groups: HADeviceGroup[] = [];
  const mobileEntities = entities.filter(e => (e.entity_id.startsWith('device_tracker.') || e.entity_id.startsWith('person.')) && !consumed.has(e.entity_id));
  mobileEntities.forEach(mob => {
    consumed.add(mob.entity_id);
    const mobBase = mob.entity_id.split('.')[1].toLowerCase();
    const related = entities.filter(e => !consumed.has(e.entity_id) && e.entity_id.toLowerCase().includes(mobBase));
    related.forEach(r => consumed.add(r.entity_id));
    const isHome = mob.state === 'home' || mob.state === 'casa';
    const area = resolveEntityArea(mob);
    groups.push({
      id: mob.entity_id, name: mob.attributes.friendly_name || mob.entity_id.split('.')[1].replace(/_/g, ' '), category: 'mobile', primaryEntity: mob, entities: [mob, ...related], area,
      summary: isHome ? 'Em casa' : 'Ausente',
      stateBadge: { text: isHome ? 'Em casa' : 'Ausente', variant: isHome ? 'success' : 'neutral' },
    });
  });
  return groups;
}

export function groupClimate(entities: HAEntity[], consumed: Set<string>): HADeviceGroup[] {
  const groups: HADeviceGroup[] = [];
  const climateList = entities.filter(e =>
    (e.entity_id.startsWith('climate.') || (e.entity_id.startsWith('sensor.') && e.entity_id.includes('temperature'))) &&
    !consumed.has(e.entity_id)
  );
  climateList.forEach(clim => {
    consumed.add(clim.entity_id);
    const base = clim.entity_id.split('.')[1].replace(/_temperature|_temperatura/g, '');
    const related = entities.filter(e => !consumed.has(e.entity_id) && e.entity_id.toLowerCase().includes(base));
    related.forEach(r => consumed.add(r.entity_id));
    const friendlyName = clim.attributes.friendly_name || clim.entity_id.split('.')[1].replace(/_/g, ' ');
    const area = resolveEntityArea(clim, friendlyName);
    groups.push({
      id: clim.entity_id, name: friendlyName, category: 'climate', primaryEntity: clim, entities: [clim, ...related], area,
      summary: `${clim.state} ${clim.attributes.unit_of_measurement || '°C'}`,
      stateBadge: { text: 'Monitorado', variant: 'info' },
    });
  });
  return groups;
}

export function groupAutomations(entities: HAEntity[], consumed: Set<string>): HADeviceGroup | null {
  const autoList = entities.filter(e =>
    (e.entity_id.startsWith('input_boolean.') || e.entity_id.startsWith('scene.') || e.entity_id.startsWith('script.')) &&
    !consumed.has(e.entity_id)
  );
  if (autoList.length === 0) return null;
  autoList.forEach(a => consumed.add(a.entity_id));
  return {
    id: 'automations_and_modes', name: 'Modo Cinema & Automações', category: 'automation', primaryEntity: autoList[0], entities: autoList, area: 'Geral',
    summary: `${autoList.length} modos e atalhos rápidos configurados`,
    stateBadge: { text: 'Ativo', variant: 'warning' },
  };
}

export function groupRemainingSensors(entities: HAEntity[], consumed: Set<string>): HADeviceGroup | null {
  const remainingSensors = entities.filter(e => !consumed.has(e.entity_id) && !isTechnicalEntity(e));
  if (remainingSensors.length === 0) return null;
  return {
    id: 'other_sensors_group', name: 'Sensores Adicionais', category: 'sensor', primaryEntity: remainingSensors[0], entities: remainingSensors, area: 'Geral',
    summary: `${remainingSensors.length} sensores secundários monitorados`,
    stateBadge: { text: 'Monitorado', variant: 'info' },
  };
}
