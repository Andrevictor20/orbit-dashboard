import type {
  HAEntity,
  GroupedLightDevice,
  GroupedSwitchDevice,
  GroupedCameraDevice,
  GroupedMobileDevice,
  GroupedMediaDevice,
  SystemMetrics,
} from '../types';
import { isTechnicalEntity } from './areaResolver';

/**
 * Agrupa entidades dispersas que pertencem a um mesmo dispositivo físico.
 */
export function groupEntities(entities: HAEntity[]) {
  const lights: GroupedLightDevice[] = [];
  const switches: GroupedSwitchDevice[] = [];
  const cameras: GroupedCameraDevice[] = [];
  const mobiles: GroupedMobileDevice[] = [];
  const mediaPlayers: GroupedMediaDevice[] = [];
  const climateEntities: HAEntity[] = [];
  const quickBooleans: HAEntity[] = [];
  const genericSwitches: HAEntity[] = [];
  const otherSensors: HAEntity[] = [];
  const systemMetrics: SystemMetrics = {};

  const consumedEntityIds = new Set<string>();

  // 1. Extrair Métricas de Sistema / Host / Speedtest
  entities.forEach((ent) => {
    const id = ent.entity_id.toLowerCase();
    if (id.includes('speedtest_download') || (id.includes('speedtest') && id.includes('download'))) {
      systemMetrics.speedtestDownload = ent;
      consumedEntityIds.add(ent.entity_id);
    } else if (id.includes('speedtest_upload') || (id.includes('speedtest') && id.includes('upload'))) {
      systemMetrics.speedtestUpload = ent;
      consumedEntityIds.add(ent.entity_id);
    } else if (id.includes('speedtest_ping') || (id.includes('speedtest') && id.includes('ping'))) {
      systemMetrics.speedtestPing = ent;
      consumedEntityIds.add(ent.entity_id);
    } else if (id.includes('ip_address') || id.includes('external_ip') || (id.includes('ping') && id.includes('ip'))) {
      systemMetrics.ipAddress = ent;
      consumedEntityIds.add(ent.entity_id);
    } else if (id.includes('processor_use') || id.includes('cpu_percent') || (id.includes('cpu') && ent.attributes.unit_of_measurement === '%')) {
      systemMetrics.cpu = ent;
      consumedEntityIds.add(ent.entity_id);
    } else if (id.includes('memory_use') || id.includes('ram_percent') || (id.includes('memoria') && ent.attributes.unit_of_measurement === '%')) {
      systemMetrics.ram = ent;
      consumedEntityIds.add(ent.entity_id);
    } else if (id.includes('disk_use') || id.includes('disco_use')) {
      systemMetrics.disk = ent;
      consumedEntityIds.add(ent.entity_id);
    } else if (id.includes('uptime')) {
      systemMetrics.uptime = ent;
      consumedEntityIds.add(ent.entity_id);
    } else if (id.includes('run_speedtest') || id.includes('rodar_speedtest') || (id.includes('speedtest') && ent.entity_id.startsWith('button.'))) {
      systemMetrics.runSpeedtestEntity = ent;
      consumedEntityIds.add(ent.entity_id);
    }
  });

  // 2. Agrupamento de Lâmpadas Inteligentes (ex: Smart Lâmpada Wi-Fi)
  const lightEntities = entities.filter((e) => e.entity_id.startsWith('light.'));
  lightEntities.forEach((light) => {
    consumedEntityIds.add(light.entity_id);
    const lightBase = light.entity_id
      .replace('light.', '')
      .replace(/_\d+$/, '')
      .replace(/_wi_fi$/, '');

    // Procurar cena, timer e não perturbe associados
    const sceneEntity = entities.find((e) => {
      const id = e.entity_id.toLowerCase();
      return (
        (e.entity_id.startsWith('select.') || id.includes('cena')) &&
        (id.includes(lightBase) || id.includes('smart_lampada')) &&
        !consumedEntityIds.has(e.entity_id)
      );
    });
    if (sceneEntity) consumedEntityIds.add(sceneEntity.entity_id);

    const timerEntity = entities.find((e) => {
      const id = e.entity_id.toLowerCase();
      return (
        (e.entity_id.startsWith('time.') || id.includes('cronometro') || id.includes('timer')) &&
        (id.includes(lightBase) || id.includes('smart_lampada')) &&
        !consumedEntityIds.has(e.entity_id)
      );
    });
    if (timerEntity) consumedEntityIds.add(timerEntity.entity_id);

    const doNotDisturbEntity = entities.find((e) => {
      const id = e.entity_id.toLowerCase();
      return (
        (e.entity_id.startsWith('switch.') || e.entity_id.startsWith('input_boolean.')) &&
        (id.includes('nao_perturbe') || id.includes('do_not_disturb')) &&
        (id.includes(lightBase) || id.includes('smart_lampada')) &&
        !consumedEntityIds.has(e.entity_id)
      );
    });
    if (doNotDisturbEntity) consumedEntityIds.add(doNotDisturbEntity.entity_id);

    const name = light.attributes.friendly_name || light.entity_id.split('.')[1].replace(/_/g, ' ');

    lights.push({
      id: light.entity_id,
      name,
      lightEntity: light,
      sceneEntity,
      timerEntity,
      doNotDisturbEntity,
    });
  });

  // 3. Agrupamento de Câmeras (ex: Tapo C200)
  const cameraEntities = entities.filter((e) => e.entity_id.startsWith('camera.'));
  cameraEntities.forEach((cam) => {
    consumedEntityIds.add(cam.entity_id);
    const camBase = cam.entity_id.replace('camera.', '').toLowerCase();

    const autofocus = entities.find((e) => {
      const id = e.entity_id.toLowerCase();
      return (
        e.entity_id.startsWith('switch.') &&
        (id.includes('autofocus') || id.includes('foco')) &&
        (id.includes(camBase) || id.includes('c200') || id.includes('tapo'))
      );
    });
    if (autofocus) consumedEntityIds.add(autofocus.entity_id);

    const irLamp = entities.find((e) => {
      const id = e.entity_id.toLowerCase();
      return (
        e.entity_id.startsWith('switch.') &&
        (id.includes('ir_lamp') || id.includes('infrared')) &&
        (id.includes(camBase) || id.includes('c200') || id.includes('tapo'))
      );
    });
    if (irLamp) consumedEntityIds.add(irLamp.entity_id);

    const wiper = entities.find((e) => {
      const id = e.entity_id.toLowerCase();
      return (
        e.entity_id.startsWith('switch.') &&
        (id.includes('wiper') || id.includes('limpador')) &&
        (id.includes(camBase) || id.includes('c200') || id.includes('tapo'))
      );
    });
    if (wiper) consumedEntityIds.add(wiper.entity_id);

    cameras.push({
      id: cam.entity_id,
      name: cam.attributes.friendly_name || 'Câmera C200',
      cameraEntity: cam,
      autofocusEntity: autofocus,
      irLampEntity: irLamp,
      wiperEntity: wiper,
    });
  });

  // Se houver switches C200 sem câmera declarada explicitamente
  const orphanC200Switches = entities.filter(
    (e) =>
      e.entity_id.startsWith('switch.') &&
      (e.entity_id.includes('c200') || e.entity_id.includes('tapo')) &&
      !consumedEntityIds.has(e.entity_id)
  );
  if (orphanC200Switches.length > 0 && cameras.length === 0) {
    const autofocus = orphanC200Switches.find((e) => e.entity_id.includes('autofocus'));
    const irLamp = orphanC200Switches.find((e) => e.entity_id.includes('ir_lamp'));
    const wiper = orphanC200Switches.find((e) => e.entity_id.includes('wiper'));
    if (autofocus) consumedEntityIds.add(autofocus.entity_id);
    if (irLamp) consumedEntityIds.add(irLamp.entity_id);
    if (wiper) consumedEntityIds.add(wiper.entity_id);

    cameras.push({
      id: 'camera.c200_composite',
      name: 'Câmera Tapo C200',
      autofocusEntity: autofocus,
      irLampEntity: irLamp,
      wiperEntity: wiper,
    });
  }

  // 4. Agrupamento de Dispositivos Móveis (Moto G75, SM-A047M, etc.)
  const trackers = entities.filter(
    (e) =>
      (e.entity_id.startsWith('device_tracker.') || e.entity_id.startsWith('person.')) &&
      !consumedEntityIds.has(e.entity_id)
  );

  trackers.forEach((tracker) => {
    consumedEntityIds.add(tracker.entity_id);
    const baseId = tracker.entity_id.split('.')[1].replace(/_5g$/, '').toLowerCase();

    // Procurar sensor de bateria correspondente
    const battery = entities.find((e) => {
      const id = e.entity_id.toLowerCase();
      return (
        id.startsWith('sensor.') &&
        id.includes('battery_level') &&
        (id.includes(baseId) || id.includes(tracker.attributes.friendly_name?.toLowerCase().replace(/\s+/g, '_') || ''))
      );
    });
    if (battery) consumedEntityIds.add(battery.entity_id);

    let batteryNum: number | undefined;
    if (battery && !isNaN(Number(battery.state))) {
      batteryNum = Math.round(Number(battery.state));
    } else if (tracker.attributes.battery_level !== undefined) {
      batteryNum = Math.round(tracker.attributes.battery_level);
    }

    mobiles.push({
      id: tracker.entity_id,
      name: tracker.attributes.friendly_name || baseId.replace(/_/g, ' ').toUpperCase(),
      trackerEntity: tracker,
      batteryEntity: battery,
      batteryLevel: batteryNum,
    });
  });

  // 5. Agrupamento de Tomadas com Consumo de Energia (Tomada 1, Tomada 2, etc.)
  const switchEntities = entities.filter(
    (e) => e.entity_id.startsWith('switch.') && !consumedEntityIds.has(e.entity_id)
  );

  switchEntities.forEach((sw) => {
    const swId = sw.entity_id.toLowerCase();
    const swBase = swId.replace('switch.', '');

    // Procurar sensor de energia consumida kWh associado
    const energySensor = entities.find((e) => {
      const id = e.entity_id.toLowerCase();
      const unit = (e.attributes.unit_of_measurement || '').toLowerCase();
      return (
        id.startsWith('sensor.') &&
        (id.includes(swBase) || (swBase.includes('tomada_1') && id.includes('tomada_1')) || (swBase.includes('tomada_2') && id.includes('tomada_2'))) &&
        (unit.includes('kwh') || id.includes('energia') || id.includes('energy') || id.includes('total_energy')) &&
        !consumedEntityIds.has(e.entity_id)
      );
    });
    if (energySensor) consumedEntityIds.add(energySensor.entity_id);

    // Procurar sensor de potência instantânea W associado
    const powerSensor = entities.find((e) => {
      const id = e.entity_id.toLowerCase();
      const unit = (e.attributes.unit_of_measurement || '').toLowerCase();
      return (
        id.startsWith('sensor.') &&
        (id.includes(swBase) || (swBase.includes('tomada_1') && id.includes('tomada_1')) || (swBase.includes('tomada_2') && id.includes('tomada_2'))) &&
        (unit === 'w' || id.includes('potencia') || id.includes('power')) &&
        !consumedEntityIds.has(e.entity_id)
      );
    });
    if (powerSensor) consumedEntityIds.add(powerSensor.entity_id);

    consumedEntityIds.add(sw.entity_id);

    switches.push({
      id: sw.entity_id,
      name: sw.attributes.friendly_name || swBase.replace(/_/g, ' '),
      switchEntity: sw,
      energyEntity: energySensor,
      powerEntity: powerSensor,
    });
  });

  // 6. Agrupamento de Mídia & TVs
  const mediaEntities = entities.filter(
    (e) => e.entity_id.startsWith('media_player.') && !consumedEntityIds.has(e.entity_id)
  );
  mediaEntities.forEach((media) => {
    consumedEntityIds.add(media.entity_id);
    const mediaBase = media.entity_id.replace('media_player.', '').toLowerCase();

    // Procurar script de ligar associado
    const script = entities.find((e) => {
      const id = e.entity_id.toLowerCase();
      return (
        e.entity_id.startsWith('script.') &&
        (id.includes(mediaBase) || (mediaBase.includes('tv') && id.includes('tv'))) &&
        !consumedEntityIds.has(e.entity_id)
      );
    });
    if (script) consumedEntityIds.add(script.entity_id);

    mediaPlayers.push({
      id: media.entity_id,
      name: media.attributes.friendly_name || mediaBase.replace(/_/g, ' '),
      mediaEntity: media,
      scriptEntity: script,
    });
  });

  // Scripts de TV órfãos (ex: script.ligar_tv_samsung quando não há media_player declarado)
  const tvScripts = entities.filter(
    (e) =>
      e.entity_id.startsWith('script.') &&
      (e.entity_id.includes('tv') || e.entity_id.includes('samsung')) &&
      !consumedEntityIds.has(e.entity_id)
  );
  tvScripts.forEach((sc) => {
    consumedEntityIds.add(sc.entity_id);
    mediaPlayers.push({
      id: sc.entity_id,
      name: sc.attributes.friendly_name || 'TV Samsung',
      scriptEntity: sc,
    });
  });

  // 7. Climatização (climate.* e sensores primários de temperatura/umidade)
  entities.forEach((e) => {
    const id = e.entity_id.toLowerCase();
    const devClass = e.attributes.device_class;
    const isTempSensor =
      e.entity_id.startsWith('sensor.') &&
      (devClass === 'temperature' || id.includes('temperature') || id.includes('temperatura'));

    if ((e.entity_id.startsWith('climate.') || isTempSensor) && !consumedEntityIds.has(e.entity_id)) {
      consumedEntityIds.add(e.entity_id);
      climateEntities.push(e);
    }
  });

  // 8. Controles Rápidos / Booleans (ex: input_boolean.modo_cinema)
  entities.forEach((e) => {
    const id = e.entity_id.toLowerCase();
    if (
      (e.entity_id.startsWith('input_boolean.') || id.includes('modo_cinema')) &&
      !consumedEntityIds.has(e.entity_id)
    ) {
      consumedEntityIds.add(e.entity_id);
      quickBooleans.push(e);
    }
  });

  // 9. Sensores restantes não técnicos
  entities.forEach((e) => {
    if (consumedEntityIds.has(e.entity_id)) return;
    if (isTechnicalEntity(e)) return;

    if (e.entity_id.startsWith('sensor.') || e.entity_id.startsWith('binary_sensor.')) {
      otherSensors.push(e);
    }
  });

  return {
    lights,
    switches,
    genericSwitches,
    cameras,
    mobiles,
    mediaPlayers,
    climateEntities,
    quickBooleans,
    otherSensors,
    systemMetrics,
  };
}
