import type { HAEntity, HADeviceGroup } from '../types';
import { resolveEntityArea } from './areaResolver';

/**
 * Groups 1-9: Fixed device profiles (Tapo, Tomadas, SmartTV, Echo, Huawei, etc.)
 */

export function groupTapoCamera(entities: HAEntity[], consumed: Set<string>): HADeviceGroup | null {
  const tapoEntities = entities.filter(e => {
    const id = e.entity_id.toLowerCase();
    const name = (e.attributes.friendly_name || '').toLowerCase();
    return id.includes('tapo') || id.includes('c200') || name.includes('tapo') || name.includes('c200');
  });
  if (tapoEntities.length === 0) return null;
  tapoEntities.forEach(e => consumed.add(e.entity_id));
  const mainCam = tapoEntities.find(e => e.entity_id.startsWith('camera.')) || tapoEntities[0];
  const privacy = tapoEntities.find(e => e.entity_id.includes('privacy'));
  const primary = mainCam || privacy || tapoEntities[0];
  const area = tapoEntities.map(e => resolveEntityArea(e)).find(Boolean) || 'Sala';
  return {
    id: 'tapo_c200_camera', name: 'Câmera Tapo C200', category: 'camera', primaryEntity: primary, entities: tapoEntities, area,
    summary: `${tapoEntities.length} entidades integradas · Alarme, Áudio, Privacidade e Detecção`,
    stateBadge: { text: primary.state === 'idle' || primary.state === 'recording' || primary.state === 'on' ? 'Ativa' : primary.state, variant: 'success' },
  };
}

export function groupSmartSockets(entities: HAEntity[], consumed: Set<string>): HADeviceGroup[] {
  const groups: HADeviceGroup[] = [];
  ['tomada_1', 'tomada_2'].forEach((tPrefix, idx) => {
    const tEntities = entities.filter(e => {
      if (consumed.has(e.entity_id)) return false;
      const id = e.entity_id.toLowerCase();
      const name = (e.attributes.friendly_name || '').toLowerCase();
      return id.includes(tPrefix) || name.includes(`tomada ${idx + 1}`) || name.includes(`tomada_${idx + 1}`);
    });
    if (tEntities.length === 0) return;
    tEntities.forEach(e => consumed.add(e.entity_id));
    const socket = tEntities.find(e => e.entity_id.includes('socket')) || tEntities.find(e => e.entity_id.startsWith('switch.')) || tEntities[0];
    const energy = tEntities.find(e => e.entity_id.includes('energy') || e.attributes.unit_of_measurement === 'kWh');
    const power = tEntities.find(e => e.entity_id.includes('power') || e.attributes.unit_of_measurement === 'W');
    const isOn = socket.state === 'on';
    let summary = isOn ? 'Ligada' : 'Desligada';
    if (power?.state && power.state !== 'unknown') summary += ` · ${power.state} W`;
    if (energy?.state && energy.state !== 'unknown') summary += ` · ${energy.state} kWh`;
    const area = tEntities.map(e => resolveEntityArea(e)).find(Boolean) || (idx === 0 ? 'Sala' : 'Quarto');
    groups.push({
      id: tPrefix, name: `Tomada Inteligente ${idx + 1}`, category: 'switch', primaryEntity: socket, entities: tEntities, area, summary,
      stateBadge: { text: isOn ? 'Ligada' : 'Desligada', variant: isOn ? 'success' : 'neutral' },
    });
  });
  return groups;
}

export function groupSmartTV(entities: HAEntity[], consumed: Set<string>): HADeviceGroup | null {
  const tvEntities = entities.filter(e => {
    if (consumed.has(e.entity_id)) return false;
    const id = e.entity_id.toLowerCase();
    const name = (e.attributes.friendly_name || '').toLowerCase();
    return id.includes('smart_tv') || id.includes('tv_samsung') || name.includes('smart tv') || name.includes('tv samsung') || (id.startsWith('script.') && id.includes('tv'));
  });
  if (tvEntities.length === 0) return null;
  tvEntities.forEach(e => consumed.add(e.entity_id));
  const player = tvEntities.find(e => e.entity_id.startsWith('media_player.')) || tvEntities[0];
  const isOn = player.state === 'on' || player.state === 'playing';
  const area = tvEntities.map(e => resolveEntityArea(e)).find(Boolean) || 'Sala';
  return {
    id: 'smart_tv_device', name: 'Smart TV Pro', category: 'media', primaryEntity: player, entities: tvEntities, area,
    summary: isOn ? 'Ligada' : 'Desligada',
    stateBadge: { text: isOn ? 'Ligada' : 'Desligada', variant: isOn ? 'info' : 'neutral' },
  };
}

export function groupEchoDot(entities: HAEntity[], consumed: Set<string>): HADeviceGroup | null {
  const echoEntities = entities.filter(e => {
    if (consumed.has(e.entity_id)) return false;
    const id = e.entity_id.toLowerCase();
    const name = (e.attributes.friendly_name || '').toLowerCase();
    return id.includes('echo_dot') || name.includes('echo dot') || id.includes('alexa');
  });
  if (echoEntities.length === 0) return null;
  echoEntities.forEach(e => consumed.add(e.entity_id));
  const player = echoEntities.find(e => e.entity_id.startsWith('media_player.')) || echoEntities[0];
  const area = echoEntities.map(e => resolveEntityArea(e)).find(Boolean) || 'Sala';
  return {
    id: 'echo_dot_device', name: 'Echo Dot de André', category: 'media', primaryEntity: player, entities: echoEntities, area,
    summary: `${echoEntities.length} controles (Mídia, Não Perturbe, Volume)`,
    stateBadge: { text: player.state === 'playing' ? 'Reproduzindo' : player.state === 'idle' ? 'Em espera' : player.state, variant: 'info' },
  };
}

export function groupHuaweiRouter(entities: HAEntity[], consumed: Set<string>): HADeviceGroup | null {
  const networkEntities = entities.filter(e => {
    if (consumed.has(e.entity_id)) return false;
    const id = e.entity_id.toLowerCase();
    const name = (e.attributes.friendly_name || '').toLowerCase();
    return id.includes('huawei_igd') || id.includes('huawei') || name.includes('huawei');
  });
  if (networkEntities.length === 0) return null;
  networkEntities.forEach(e => consumed.add(e.entity_id));
  const wan = networkEntities.find(e => e.entity_id.includes('status_wan') || e.entity_id.includes('wan'));
  const ip = networkEntities.find(e => e.entity_id.includes('external_ip') || e.entity_id.includes('ip_address'));
  const dl = networkEntities.find(e => e.entity_id.includes('sent') || e.entity_id.includes('download'));
  const primary = wan || networkEntities[0];
  const summaryParts: string[] = [];
  if (wan) summaryParts.push(`WAN: ${wan.state === 'on' || wan.state === 'detected' ? 'Online' : wan.state}`);
  if (ip?.state && ip.state !== 'unknown') summaryParts.push(ip.state);
  if (dl?.state && dl.state !== 'unknown') summaryParts.push(`↓ ${dl.state} ${dl.attributes.unit_of_measurement || ''}`);
  return {
    id: 'huawei_igd_router', name: 'Roteador Huawei IGD', category: 'network', primaryEntity: primary, entities: networkEntities, area: 'Rede',
    summary: summaryParts.join(' · ') || `${networkEntities.length} métricas de rede`,
    stateBadge: { text: wan?.state === 'on' || wan?.state === 'detected' ? 'Conectado' : 'Monitorado', variant: 'success' },
  };
}

export function groupSystemBackups(entities: HAEntity[], consumed: Set<string>): HADeviceGroup | null {
  const backupEntities = entities.filter(e => {
    if (consumed.has(e.entity_id)) return false;
    const id = e.entity_id.toLowerCase();
    return id.includes('backup') || (e.attributes.friendly_name || '').toLowerCase().includes('backup');
  });
  if (backupEntities.length === 0) return null;
  backupEntities.forEach(e => consumed.add(e.entity_id));
  const manager = backupEntities.find(e => e.entity_id.includes('backup_manager_state'));
  const primary = manager || backupEntities[0];
  return {
    id: 'system_backups', name: 'Backups do Sistema', category: 'system', primaryEntity: primary, entities: backupEntities, area: 'Sistema',
    summary: `${backupEntities.length} rotinas monitoradas · ${primary.state === 'idle' ? 'Em espera (Pronto)' : primary.state}`,
    stateBadge: { text: primary.state === 'idle' ? 'Pronto' : primary.state, variant: 'info' },
  };
}

export function groupSunAstronomy(entities: HAEntity[], consumed: Set<string>): HADeviceGroup | null {
  const sunEntities = entities.filter(e => !consumed.has(e.entity_id) && (e.entity_id.startsWith('sun.') || e.entity_id.includes('sun_')));
  if (sunEntities.length === 0) return null;
  sunEntities.forEach(e => consumed.add(e.entity_id));
  const mainSun = sunEntities.find(e => e.entity_id === 'sun.sun') || sunEntities[0];
  const isAbove = mainSun.state === 'above_horizon';
  return {
    id: 'sun_astronomy', name: 'Ciclo Solar & Astronomia', category: 'system', primaryEntity: mainSun, entities: sunEntities, area: 'Geral',
    summary: `${isAbove ? 'Sol acima do horizonte' : 'Noite (abaixo do horizonte)'} · ${sunEntities.length} eventos solares`,
    stateBadge: { text: isAbove ? 'Dia' : 'Noite', variant: isAbove ? 'warning' : 'neutral' },
  };
}

export function groupHACloud(entities: HAEntity[], consumed: Set<string>): HADeviceGroup | null {
  const cloudEntities = entities.filter(e => {
    if (consumed.has(e.entity_id)) return false;
    const id = e.entity_id.toLowerCase();
    return id.includes('home_assistant_cloud') || id.includes('remote_ui');
  });
  if (cloudEntities.length === 0) return null;
  cloudEntities.forEach(e => consumed.add(e.entity_id));
  const remote = cloudEntities.find(e => e.entity_id.includes('remote_ui')) || cloudEntities[0];
  return {
    id: 'ha_cloud_services', name: 'Home Assistant Cloud & Voz', category: 'system', primaryEntity: remote, entities: cloudEntities, area: 'Sistema',
    summary: `${cloudEntities.length} serviços (TTS, STT, Assistente, Remote UI)`,
    stateBadge: { text: remote.state === 'on' || remote.state === 'livre' ? 'Ativo' : remote.state, variant: 'success' },
  };
}

export function groupSystemUpdates(entities: HAEntity[], consumed: Set<string>): HADeviceGroup | null {
  const updateEntities = entities.filter(e => !consumed.has(e.entity_id) && e.entity_id.startsWith('update.'));
  if (updateEntities.length === 0) return null;
  updateEntities.forEach(e => consumed.add(e.entity_id));
  const hasPending = updateEntities.some(e => e.state === 'on');
  return {
    id: 'system_updates', name: 'Atualizações de Componentes', category: 'system', primaryEntity: updateEntities[0], entities: updateEntities, area: 'Sistema',
    summary: hasPending ? 'Novas atualizações disponíveis' : 'Todos os cards e componentes estão atualizados',
    stateBadge: { text: hasPending ? 'Atualização pendente' : 'Atualizado', variant: hasPending ? 'warning' : 'success' },
  };
}
