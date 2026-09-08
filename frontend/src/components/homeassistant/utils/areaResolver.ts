import type { HAEntity } from '../types';

/**
 * Identifica se a entidade é meramente técnica ou interna do Home Assistant
 * que polui o dashboard do usuário sem valor de controle direto.
 */
export function isTechnicalEntity(entity: HAEntity): boolean {
  const id = entity.entity_id.toLowerCase();
  const [domain] = id.split('.');

  // Domínios estritamente técnicos
  const technicalDomains = ['conversation', 'event', 'stt', 'tts', 'zone', 'update'];
  if (technicalDomains.includes(domain)) return true;

  // Padrões de infraestrutura interna
  if (id.includes('backup') || id.includes('backup_manager')) return true;
  if (id.includes('sun_next') || id.includes('sun_last') || id.includes('sun_setting')) return true;
  if (id.includes('remote_ui') || id.includes('home_assistant_cloud')) return true;
  if (id.includes('battery_state')) return true; // Já exibido junto com battery_level
  if (id.includes('do_not_disturb') && domain === 'sensor') return true;

  return false;
}

/**
 * Classifica se um item pertence à Sala
 */
export function isItemInLivingRoom(name: string, entityId: string): boolean {
  const text = (name + ' ' + entityId).toLowerCase();
  return (
    text.includes('sala') ||
    text.includes('living') ||
    text.includes('estar') ||
    text.includes('corredor') ||
    text.includes('c200') ||
    text.includes('tapo') ||
    text.includes('echo')
  );
}

/**
 * Classifica se um item pertence aos Quartos
 */
export function isItemInBedrooms(name: string, entityId: string): boolean {
  const text = (name + ' ' + entityId).toLowerCase();
  return (
    text.includes('quarto') ||
    text.includes('bedroom') ||
    text.includes('suite') ||
    text.includes('dormitorio') ||
    text.includes('cama')
  );
}

/**
 * Determina dinamicamente a Área de uma entidade ou grupo de entidades
 * priorizando informações enviadas pelo Home Assistant.
 */
export function resolveEntityArea(entity: HAEntity, fallbackName?: string): string | undefined {
  if (entity.area && entity.area.trim()) return entity.area.trim();
  if (entity.attributes?.area_name && String(entity.attributes.area_name).trim()) {
    return String(entity.attributes.area_name).trim();
  }
  const str = `${entity.attributes?.friendly_name || ''} ${fallbackName || ''} ${entity.entity_id}`.toLowerCase();
  if (str.includes('corredor')) return 'Corredor';
  if (str.includes('sala')) return 'Sala';
  if (str.includes('quarto') || str.includes('bedroom') || str.includes('suite')) return 'Quarto';
  if (str.includes('cozinha')) return 'Cozinha';
  if (str.includes('banheiro')) return 'Banheiro';
  if (str.includes('varanda')) return 'Varanda';
  if (str.includes('garagem')) return 'Garagem';
  if (str.includes('escritorio') || str.includes('office')) return 'Escritório';
  return undefined;
}
