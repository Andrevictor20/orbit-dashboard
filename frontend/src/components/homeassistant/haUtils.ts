import type {
  HAEntity,
  HADeviceGroup,
  GroupedLightDevice,
  GroupedSwitchDevice,
  GroupedCameraDevice,
  GroupedMobileDevice,
  GroupedMediaDevice,
  SystemMetrics,
} from './types';

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

/**
 * Agrupa universalmente todas as entidades brutas em Dispositivos Consolidados
 * eliminando a exposição desorganizada de centenas de entidades na tela.
 */
export function groupAllDevices(entities: HAEntity[]): HADeviceGroup[] {
  const groups: HADeviceGroup[] = [];
  const consumed = new Set<string>();

  // 1. CÂMERAS TAPO (ex: Tapo C200)
  // Reúne TODAS as entidades (floodlight, privacy, motion, sound, alarms, lens, indicator, etc.) em um único dispositivo por câmera!
  const tapoEntities = entities.filter((e) => {
    const id = e.entity_id.toLowerCase();
    const name = (e.attributes.friendly_name || '').toLowerCase();
    return id.includes('tapo') || id.includes('c200') || name.includes('tapo') || name.includes('c200');
  });
  if (tapoEntities.length > 0) {
    tapoEntities.forEach((e) => consumed.add(e.entity_id));
    const mainCam = tapoEntities.find((e) => e.entity_id.startsWith('camera.')) || tapoEntities[0];
    const privacy = tapoEntities.find((e) => e.entity_id.includes('privacy'));
    const primary = mainCam || privacy || tapoEntities[0];
    const area = tapoEntities.map((e) => resolveEntityArea(e)).find(Boolean) || 'Sala';

    groups.push({
      id: 'tapo_c200_camera',
      name: 'Câmera Tapo C200',
      category: 'camera',
      primaryEntity: primary,
      entities: tapoEntities,
      area,
      summary: `${tapoEntities.length} entidades integradas · Alarme, Áudio, Privacidade e Detecção`,
      stateBadge: {
        text: primary.state === 'idle' || primary.state === 'recording' || primary.state === 'on' ? 'Ativa' : primary.state,
        variant: 'success',
      },
    });
  }

  // 2. TOMADAS INTELIGENTES (Tomada 1, Tomada 2, etc.)
  // Agrupa socket, trava para crianças e telemetria de energia em cada tomada individual!
  ['tomada_1', 'tomada_2'].forEach((tPrefix, idx) => {
    const tEntities = entities.filter((e) => {
      if (consumed.has(e.entity_id)) return false;
      const id = e.entity_id.toLowerCase();
      const name = (e.attributes.friendly_name || '').toLowerCase();
      return id.includes(tPrefix) || name.includes(`tomada ${idx + 1}`) || name.includes(`tomada_${idx + 1}`);
    });

    if (tEntities.length > 0) {
      tEntities.forEach((e) => consumed.add(e.entity_id));
      const socket = tEntities.find((e) => e.entity_id.includes('socket')) || tEntities.find((e) => e.entity_id.startsWith('switch.')) || tEntities[0];
      const energy = tEntities.find((e) => e.entity_id.includes('energy') || (e.attributes.unit_of_measurement === 'kWh'));
      const power = tEntities.find((e) => e.entity_id.includes('power') || (e.attributes.unit_of_measurement === 'W'));
      const isOn = socket.state === 'on';

      let summary = isOn ? 'Ligada' : 'Desligada';
      if (power?.state && power.state !== 'unknown') summary += ` · ${power.state} W`;
      if (energy?.state && energy.state !== 'unknown') summary += ` · ${energy.state} kWh`;

      const area = tEntities.map((e) => resolveEntityArea(e)).find(Boolean) || (idx === 0 ? 'Sala' : 'Quarto');

      groups.push({
        id: tPrefix,
        name: `Tomada Inteligente ${idx + 1}`,
        category: 'switch',
        primaryEntity: socket,
        entities: tEntities,
        area,
        summary,
        stateBadge: {
          text: isOn ? 'Ligada' : 'Desligada',
          variant: isOn ? 'success' : 'neutral',
        },
      });
    }
  });

  // 3. SMART TV (Samsung TV / Smart TV Pro)
  const tvEntities = entities.filter((e) => {
    if (consumed.has(e.entity_id)) return false;
    const id = e.entity_id.toLowerCase();
    const name = (e.attributes.friendly_name || '').toLowerCase();
    return id.includes('smart_tv') || id.includes('tv_samsung') || name.includes('smart tv') || name.includes('tv samsung') || (id.startsWith('script.') && id.includes('tv'));
  });
  if (tvEntities.length > 0) {
    tvEntities.forEach((e) => consumed.add(e.entity_id));
    const player = tvEntities.find((e) => e.entity_id.startsWith('media_player.')) || tvEntities[0];
    const isOn = player.state === 'on' || player.state === 'playing';
    const area = tvEntities.map((e) => resolveEntityArea(e)).find(Boolean) || 'Sala';

    groups.push({
      id: 'smart_tv_device',
      name: 'Smart TV Pro',
      category: 'media',
      primaryEntity: player,
      entities: tvEntities,
      area,
      summary: isOn ? 'Ligada' : 'Desligada',
      stateBadge: {
        text: isOn ? 'Ligada' : 'Desligada',
        variant: isOn ? 'info' : 'neutral',
      },
    });
  }

  // 4. ECHO DOT (Alexa)
  const echoEntities = entities.filter((e) => {
    if (consumed.has(e.entity_id)) return false;
    const id = e.entity_id.toLowerCase();
    const name = (e.attributes.friendly_name || '').toLowerCase();
    return id.includes('echo_dot') || name.includes('echo dot') || id.includes('alexa');
  });
  if (echoEntities.length > 0) {
    echoEntities.forEach((e) => consumed.add(e.entity_id));
    const player = echoEntities.find((e) => e.entity_id.startsWith('media_player.')) || echoEntities[0];
    const area = echoEntities.map((e) => resolveEntityArea(e)).find(Boolean) || 'Sala';

    groups.push({
      id: 'echo_dot_device',
      name: 'Echo Dot de André',
      category: 'media',
      primaryEntity: player,
      entities: echoEntities,
      area,
      summary: `${echoEntities.length} controles (Mídia, Não Perturbe, Volume)`,
      stateBadge: {
        text: player.state === 'playing' ? 'Reproduzindo' : player.state === 'idle' ? 'Em espera' : player.state,
        variant: 'info',
      },
    });
  }

  // 5. ROTEADOR E REDE (Huawei IGD)
  const networkEntities = entities.filter((e) => {
    if (consumed.has(e.entity_id)) return false;
    const id = e.entity_id.toLowerCase();
    const name = (e.attributes.friendly_name || '').toLowerCase();
    return id.includes('huawei_igd') || id.includes('huawei') || name.includes('huawei');
  });
  if (networkEntities.length > 0) {
    networkEntities.forEach((e) => consumed.add(e.entity_id));
    const wan = networkEntities.find((e) => e.entity_id.includes('status_wan') || e.entity_id.includes('wan'));
    const ip = networkEntities.find((e) => e.entity_id.includes('external_ip') || e.entity_id.includes('ip_address'));
    const dl = networkEntities.find((e) => e.entity_id.includes('sent') || e.entity_id.includes('download'));
    const primary = wan || networkEntities[0];

    const summaryParts: string[] = [];
    if (wan) summaryParts.push(`WAN: ${wan.state === 'on' || wan.state === 'detected' ? 'Online' : wan.state}`);
    if (ip && ip.state && ip.state !== 'unknown') summaryParts.push(ip.state);
    if (dl && dl.state && dl.state !== 'unknown') summaryParts.push(`↓ ${dl.state} ${dl.attributes.unit_of_measurement || ''}`);

    groups.push({
      id: 'huawei_igd_router',
      name: 'Roteador Huawei IGD',
      category: 'network',
      primaryEntity: primary,
      entities: networkEntities,
      area: 'Rede',
      summary: summaryParts.join(' · ') || `${networkEntities.length} métricas de rede`,
      stateBadge: {
        text: wan?.state === 'on' || wan?.state === 'detected' ? 'Conectado' : 'Monitorado',
        variant: 'success',
      },
    });
  }

  // 6. BACKUPS DO SISTEMA
  const backupEntities = entities.filter((e) => {
    if (consumed.has(e.entity_id)) return false;
    const id = e.entity_id.toLowerCase();
    return id.includes('backup') || (e.attributes.friendly_name || '').toLowerCase().includes('backup');
  });
  if (backupEntities.length > 0) {
    backupEntities.forEach((e) => consumed.add(e.entity_id));
    const manager = backupEntities.find((e) => e.entity_id.includes('backup_manager_state'));
    const primary = manager || backupEntities[0];
    groups.push({
      id: 'system_backups',
      name: 'Backups do Sistema',
      category: 'system',
      primaryEntity: primary,
      entities: backupEntities,
      area: 'Sistema',
      summary: `${backupEntities.length} rotinas monitoradas · ${primary.state === 'idle' ? 'Em espera (Pronto)' : primary.state}`,
      stateBadge: {
        text: primary.state === 'idle' ? 'Pronto' : primary.state,
        variant: 'info',
      },
    });
  }

  // 7. CICLO SOLAR & ASTRONOMIA
  const sunEntities = entities.filter((e) => {
    if (consumed.has(e.entity_id)) return false;
    return e.entity_id.startsWith('sun.') || e.entity_id.includes('sun_');
  });
  if (sunEntities.length > 0) {
    sunEntities.forEach((e) => consumed.add(e.entity_id));
    const mainSun = sunEntities.find((e) => e.entity_id === 'sun.sun') || sunEntities[0];
    const isAbove = mainSun.state === 'above_horizon';
    groups.push({
      id: 'sun_astronomy',
      name: 'Ciclo Solar & Astronomia',
      category: 'system',
      primaryEntity: mainSun,
      entities: sunEntities,
      area: 'Geral',
      summary: `${isAbove ? 'Sol acima do horizonte' : 'Noite (abaixo do horizonte)'} · ${sunEntities.length} eventos solares`,
      stateBadge: {
        text: isAbove ? 'Dia' : 'Noite',
        variant: isAbove ? 'warning' : 'neutral',
      },
    });
  }

  // 8. HOME ASSISTANT CLOUD & VOZ
  const cloudEntities = entities.filter((e) => {
    if (consumed.has(e.entity_id)) return false;
    const id = e.entity_id.toLowerCase();
    return id.includes('home_assistant_cloud') || id.includes('remote_ui');
  });
  if (cloudEntities.length > 0) {
    cloudEntities.forEach((e) => consumed.add(e.entity_id));
    const remote = cloudEntities.find((e) => e.entity_id.includes('remote_ui')) || cloudEntities[0];
    groups.push({
      id: 'ha_cloud_services',
      name: 'Home Assistant Cloud & Voz',
      category: 'system',
      primaryEntity: remote,
      entities: cloudEntities,
      area: 'Sistema',
      summary: `${cloudEntities.length} serviços (TTS, STT, Assistente, Remote UI)`,
      stateBadge: {
        text: remote.state === 'on' || remote.state === 'livre' ? 'Ativo' : remote.state,
        variant: 'success',
      },
    });
  }

  // 9. ATUALIZAÇÕES DO SISTEMA (HACS & CORE)
  const updateEntities = entities.filter((e) => {
    if (consumed.has(e.entity_id)) return false;
    return e.entity_id.startsWith('update.');
  });
  if (updateEntities.length > 0) {
    updateEntities.forEach((e) => consumed.add(e.entity_id));
    const hasPending = updateEntities.some((e) => e.state === 'on');
    groups.push({
      id: 'system_updates',
      name: 'Atualizações de Componentes',
      category: 'system',
      primaryEntity: updateEntities[0],
      entities: updateEntities,
      area: 'Sistema',
      summary: hasPending ? 'Novas atualizações disponíveis' : 'Todos os cards e componentes estão atualizados',
      stateBadge: {
        text: hasPending ? 'Atualização pendente' : 'Atualizado',
        variant: hasPending ? 'warning' : 'success',
      },
    });
  }

  // 9.5 DISPOSITIVOS IDENTIFICADOS PELO HOME ASSISTANT (via device_name nativo)
  const entitiesWithDeviceName = entities.filter(
    (e) => !consumed.has(e.entity_id) && e.device_name && e.device_name.trim() && !isTechnicalEntity(e)
  );
  if (entitiesWithDeviceName.length > 0) {
    const deviceNameMap = new Map<string, HAEntity[]>();
    entitiesWithDeviceName.forEach((e) => {
      const dName = e.device_name!.trim();
      if (!deviceNameMap.has(dName)) deviceNameMap.set(dName, []);
      deviceNameMap.get(dName)!.push(e);
    });

    deviceNameMap.forEach((deviceEnts, dName) => {
      deviceEnts.forEach((e) => consumed.add(e.entity_id));
      const primary =
        deviceEnts.find((e) => e.entity_id.startsWith('light.')) ||
        deviceEnts.find((e) => e.entity_id.startsWith('switch.')) ||
        deviceEnts.find((e) => e.entity_id.startsWith('climate.')) ||
        deviceEnts.find((e) => e.entity_id.startsWith('media_player.')) ||
        deviceEnts.find((e) => e.entity_id.startsWith('camera.')) ||
        deviceEnts.find((e) => e.entity_id.startsWith('sensor.')) ||
        deviceEnts[0];

      const [domain] = primary.entity_id.split('.');
      let cat: any = 'other';
      if (domain === 'light') cat = 'light';
      else if (domain === 'switch') cat = 'switch';
      else if (domain === 'climate') cat = 'climate';
      else if (domain === 'media_player') cat = 'media';
      else if (domain === 'camera') cat = 'camera';
      else if (domain === 'sensor' || domain === 'binary_sensor') cat = 'sensor';

      const area = deviceEnts.map((e) => resolveEntityArea(e)).find(Boolean) || resolveEntityArea(primary, dName);
      const isOn = primary.state === 'on';

      groups.push({
        id: `ha_device_${dName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        name: dName,
        category: cat,
        primaryEntity: primary,
        entities: deviceEnts,
        area,
        summary: `${deviceEnts.length} entidades integradas`,
        stateBadge: {
          text: isOn ? 'Ligado' : primary.state === 'off' ? 'Desligado' : primary.state,
          variant: isOn ? 'success' : 'neutral',
        },
      });
    });
  }

  // 10. LÂMPADAS INTELIGENTES INDIVIDUAIS (Corredor, Sala, etc.)
  const lightEntities = entities.filter((e) => e.entity_id.startsWith('light.') && !consumed.has(e.entity_id));
  lightEntities.forEach((light) => {
    consumed.add(light.entity_id);
    const friendlyName = light.attributes.friendly_name || light.entity_id.split('.')[1].replace(/_/g, ' ');
    const lightBase = light.entity_id.replace('light.', '');

    const related = entities.filter((e) => {
      if (consumed.has(e.entity_id)) return false;
      const id = e.entity_id.toLowerCase();
      if (
        id.includes('temperature') ||
        id.includes('temperatura') ||
        id.includes('humidity') ||
        id.includes('umidade') ||
        id.includes('door') ||
        id.includes('porta') ||
        id.includes('motion') ||
        id.includes('presenca') ||
        id.startsWith('camera.') ||
        id.startsWith('climate.')
      ) {
        return false;
      }
      return id.includes(lightBase);
    });
    related.forEach((r) => consumed.add(r.entity_id));

    const allEnts = [light, ...related];
    const isOn = light.state === 'on';
    const bri = light.attributes.brightness ? Math.round((light.attributes.brightness / 255) * 100) : null;
    const summary = isOn ? (bri ? `Ligada · Brilho ${bri}%` : 'Ligada') : 'Desligada';
    const area = resolveEntityArea(light, friendlyName);

    groups.push({
      id: light.entity_id,
      name: friendlyName,
      category: 'light',
      primaryEntity: light,
      entities: allEnts,
      area,
      summary,
      stateBadge: {
        text: isOn ? 'Ligada' : 'Desligada',
        variant: isOn ? 'warning' : 'neutral',
      },
    });
  });

  // 11. TOMADAS RESTANTES INDIVIDUAIS
  const remainingSwitches = entities.filter((e) => e.entity_id.startsWith('switch.') && !consumed.has(e.entity_id));
  remainingSwitches.forEach((sw) => {
    consumed.add(sw.entity_id);
    const friendlyName = sw.attributes.friendly_name || sw.entity_id.split('.')[1].replace(/_/g, ' ');
    const swBase = sw.entity_id.replace('switch.', '').toLowerCase();

    const related = entities.filter((e) => {
      if (consumed.has(e.entity_id)) return false;
      const id = e.entity_id.toLowerCase();
      if (
        id.includes('temperature') ||
        id.includes('temperatura') ||
        id.includes('humidity') ||
        id.includes('umidade') ||
        id.includes('door') ||
        id.includes('porta') ||
        id.includes('motion') ||
        id.includes('presenca') ||
        id.startsWith('camera.') ||
        id.startsWith('climate.')
      ) {
        return false;
      }
      return id.includes(swBase);
    });
    related.forEach((r) => consumed.add(r.entity_id));

    const allEnts = [sw, ...related];
    const isOn = sw.state === 'on';
    const area = resolveEntityArea(sw, friendlyName);

    groups.push({
      id: sw.entity_id,
      name: friendlyName,
      category: 'switch',
      primaryEntity: sw,
      entities: allEnts,
      area,
      summary: isOn ? 'Ligada' : 'Desligada',
      stateBadge: {
        text: isOn ? 'Ligada' : 'Desligada',
        variant: isOn ? 'success' : 'neutral',
      },
    });
  });

  // 12. DISPOSITIVOS MÓVEIS E PESSOAS
  const mobileEntities = entities.filter(
    (e) =>
      (e.entity_id.startsWith('device_tracker.') || e.entity_id.startsWith('person.')) &&
      !consumed.has(e.entity_id)
  );
  mobileEntities.forEach((mob) => {
    consumed.add(mob.entity_id);
    const mobBase = mob.entity_id.split('.')[1].toLowerCase();
    const related = entities.filter((e) => {
      if (consumed.has(e.entity_id)) return false;
      const id = e.entity_id.toLowerCase();
      return id.includes(mobBase);
    });
    related.forEach((r) => consumed.add(r.entity_id));

    const isHome = mob.state === 'home' || mob.state === 'casa';
    const area = resolveEntityArea(mob);

    groups.push({
      id: mob.entity_id,
      name: mob.attributes.friendly_name || mob.entity_id.split('.')[1].replace(/_/g, ' '),
      category: 'mobile',
      primaryEntity: mob,
      entities: [mob, ...related],
      area,
      summary: isHome ? 'Em casa' : 'Ausente',
      stateBadge: {
        text: isHome ? 'Em casa' : 'Ausente',
        variant: isHome ? 'success' : 'neutral',
      },
    });
  });

  // 13. CLIMATIZAÇÃO
  const climateList = entities.filter(
    (e) =>
      (e.entity_id.startsWith('climate.') || (e.entity_id.startsWith('sensor.') && e.entity_id.includes('temperature'))) &&
      !consumed.has(e.entity_id)
  );
  climateList.forEach((clim) => {
    consumed.add(clim.entity_id);
    const base = clim.entity_id.split('.')[1].replace(/_temperature|_temperatura/g, '');
    const related = entities.filter((e) => {
      if (consumed.has(e.entity_id)) return false;
      const id = e.entity_id.toLowerCase();
      return id.includes(base);
    });
    related.forEach((r) => consumed.add(r.entity_id));

    const friendlyName = clim.attributes.friendly_name || clim.entity_id.split('.')[1].replace(/_/g, ' ');
    const area = resolveEntityArea(clim, friendlyName);

    groups.push({
      id: clim.entity_id,
      name: friendlyName,
      category: 'climate',
      primaryEntity: clim,
      entities: [clim, ...related],
      area,
      summary: `${clim.state} ${clim.attributes.unit_of_measurement || '°C'}`,
      stateBadge: {
        text: 'Monitorado',
        variant: 'info',
      },
    });
  });

  // 14. AUTOMAÇÕES / MODOS (ex: Modo Cinema)
  const autoList = entities.filter(
    (e) =>
      (e.entity_id.startsWith('input_boolean.') || e.entity_id.startsWith('scene.') || e.entity_id.startsWith('script.')) &&
      !consumed.has(e.entity_id)
  );
  if (autoList.length > 0) {
    const mainAuto = autoList[0];
    autoList.forEach((a) => consumed.add(a.entity_id));
    groups.push({
      id: 'automations_and_modes',
      name: 'Modo Cinema & Automações',
      category: 'automation',
      primaryEntity: mainAuto,
      entities: autoList,
      area: 'Geral',
      summary: `${autoList.length} modos e atalhos rápidos configurados`,
      stateBadge: {
        text: 'Ativo',
        variant: 'warning',
      },
    });
  }

  // 15. SENSORES RESTANTES
  const remainingSensors = entities.filter((e) => !consumed.has(e.entity_id) && !isTechnicalEntity(e));
  if (remainingSensors.length > 0) {
    groups.push({
      id: 'other_sensors_group',
      name: 'Sensores Adicionais',
      category: 'sensor',
      primaryEntity: remainingSensors[0],
      entities: remainingSensors,
      area: 'Geral',
      summary: `${remainingSensors.length} sensores secundários monitorados`,
      stateBadge: {
        text: 'Monitorado',
        variant: 'info',
      },
    });
  }

  return groups;
}

