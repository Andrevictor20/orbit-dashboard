export interface HAConfig {
  configured: boolean;
  connected: boolean;
  url: string;
  version: string | null;
  location_name: string | null;
  error?: string | null;
}

export interface HAEntity {
  entity_id: string;
  state: string;
  area?: string;
  device_name?: string;
  attributes: {
    friendly_name?: string;
    unit_of_measurement?: string;
    device_class?: string;
    brightness?: number;
    supported_color_modes?: string[];
    current_temperature?: number;
    temperature?: number;
    hvac_modes?: string[];
    options?: string[];
    battery_level?: number;
    media_title?: string;
    media_artist?: string;
    volume_level?: number;
    is_volume_muted?: boolean;
    entity_picture?: string;
    [key: string]: any;
  };
  last_changed?: string;
  last_updated?: string;
}

export interface GroupedLightDevice {
  id: string;
  name: string;
  lightEntity: HAEntity;
  sceneEntity?: HAEntity;
  timerEntity?: HAEntity;
  doNotDisturbEntity?: HAEntity;
}

export interface GroupedSwitchDevice {
  id: string;
  name: string;
  switchEntity: HAEntity;
  energyEntity?: HAEntity;
  powerEntity?: HAEntity;
}

export interface GroupedCameraDevice {
  id: string;
  name: string;
  cameraEntity?: HAEntity;
  autofocusEntity?: HAEntity;
  irLampEntity?: HAEntity;
  wiperEntity?: HAEntity;
}

export interface GroupedMobileDevice {
  id: string;
  name: string;
  trackerEntity: HAEntity;
  batteryEntity?: HAEntity;
  batteryLevel?: number;
  batteryStateEntity?: HAEntity;
}

export interface GroupedMediaDevice {
  id: string;
  name: string;
  mediaEntity?: HAEntity;
  scriptEntity?: HAEntity;
}

export interface SystemMetrics {
  cpu?: HAEntity;
  ram?: HAEntity;
  disk?: HAEntity;
  uptime?: HAEntity;
  speedtestDownload?: HAEntity;
  speedtestUpload?: HAEntity;
  speedtestPing?: HAEntity;
  ipAddress?: HAEntity;
  runSpeedtestEntity?: HAEntity;
}

export type DeviceCategory = 
  | 'light' 
  | 'switch' 
  | 'media' 
  | 'climate' 
  | 'camera' 
  | 'mobile' 
  | 'network' 
  | 'system' 
  | 'automation' 
  | 'sensor'
  | 'other';

export interface HADeviceGroup {
  id: string;
  name: string;
  category: DeviceCategory;
  primaryEntity: HAEntity;
  entities: HAEntity[];
  summary?: string;
  area?: string;
  description?: string;
  stateBadge?: {
    text: string;
    variant: 'success' | 'warning' | 'info' | 'neutral' | 'danger';
  };
}

export type MainTabType = 'devices' | 'system' | 'raw';
export type DeviceSubFilter = 'all' | 'lights' | 'switches' | 'media' | 'climate' | 'cameras' | 'mobile' | 'network' | 'system' | 'automation' | 'sensors';

