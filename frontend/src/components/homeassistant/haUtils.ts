/**
 * Fachada modularizada de utilitários do Home Assistant.
 * Submódulos organizados por responsabilidade única (< 500 linhas) em ./utils/
 */

export {
  isTechnicalEntity,
  isItemInLivingRoom,
  isItemInBedrooms,
  resolveEntityArea,
} from './utils/areaResolver';

export { groupEntities } from './utils/entityGrouping';
export { groupAllDevices } from './utils/deviceGrouping';
