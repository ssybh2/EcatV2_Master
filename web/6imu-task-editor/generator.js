(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.EcatV006Config = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const VERSION = '2.0.0';
  const PRODUCT_CODE = 0x06;
  const MASTER_TO_SLAVE_PDO = 80;
  const SLAVE_TO_MASTER_PDO = 192;
  const IMU_PAYLOAD_SIZE = 21;
  const IMU_COUNT = 6;
  const DIAGNOSTIC_SIZE = 34;
  const DJI_RC_OFFSET = 160;
  const DJI_RC_SIZE = 19;
  const DSHOT_OFFSET = 0;
  const DSHOT_SIZE = 8;
  const TASK_COUNT = 8;
  const SDO_LENGTH = 91;

  const DEFINES = `#define UNKNOWN_APP_ID 999
#define DJIRC_APP_ID 1
#define LK_APP_ID 2
#define HIPNUC_IMU_CAN_APP_ID 3
#define DSHOT_APP_ID 4
#define DJICAN_APP_ID 5
#define VANILLA_PWM_APP_ID 6
#define EXTERNAL_PWM_APP_ID 7
#define MS5837_30BA_APP_ID 8
#define ADC_APP_ID 9
#define CAN_PMU_APP_ID 10

#define CAN_PORT_1 1
#define CAN_PORT_2 2
`;

  const SLOT_LAYOUT = [
    { index: 0, can: 1, slot: 1, firmware: 'slot1', ids: [1, 2, 3], offset: 0 },
    { index: 1, can: 1, slot: 2, firmware: 'slot2', ids: [4, 5, 6], offset: 21 },
    { index: 2, can: 1, slot: 3, firmware: 'slot3', ids: [7, 8, 9], offset: 42 },
    { index: 3, can: 2, slot: 1, firmware: 'slot1', ids: [1, 2, 3], offset: 63 },
    { index: 4, can: 2, slot: 2, firmware: 'slot2', ids: [4, 5, 6], offset: 84 },
    { index: 5, can: 2, slot: 3, firmware: 'slot3', ids: [7, 8, 9], offset: 105 },
  ];

  function cleanSn(value) {
    return String(value == null ? '' : value).trim().replace(/^sn/i, '');
  }

  function parseCanId(value) {
    if (typeof value === 'number' && Number.isInteger(value)) return value;
    const text = String(value == null ? '' : value).trim();
    if (!text) return NaN;
    if (/^0x[0-9a-f]+$/i.test(text)) return parseInt(text, 16);
    if (/^[0-9]+$/.test(text)) return parseInt(text, 10);
    return NaN;
  }

  function hexId(value) {
    const n = parseCanId(value);
    return Number.isFinite(n) ? `0x${n.toString(16).toUpperCase().padStart(2, '0')}` : '';
  }

  function yamlString(value) {
    return String(value == null ? '' : value).replace(/'/g, "''");
  }

  function createDefaultImus() {
    return SLOT_LAYOUT.map((layout) => ({
      index: layout.index,
      can: layout.can,
      slot: layout.slot,
      firmware: layout.firmware,
      ids: [...layout.ids],
      offset: layout.offset,
      topic: `/imu/can${layout.can}/slot${layout.slot}`,
      frame: `imu_can${layout.can}_slot${layout.slot}`,
    }));
  }

  function createDefaultModule(sn = '1234567') {
    const cleaned = cleanSn(sn) || '1234567';
    return {
      uid: `m-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      sn: cleaned,
      latencyTopic: `/ecat/sn${cleaned}/latency`,
      latencyAuto: true,
      imus: createDefaultImus(),
      rc: {
        offset: DJI_RC_OFFSET,
        topic: '/dji_rc',
      },
      dshot: {
        offset: DSHOT_OFFSET,
        connectionLostAction: 2,
        dshotId: 1,
        initValue: 0,
        topic: '/dshot',
      },
    };
  }

  function normalizeModule(module) {
    const sn = cleanSn(module && module.sn) || '1234567';
    const fresh = createDefaultModule(sn);
    const out = Object.assign(fresh, module || {});
    out.sn = sn;
    out.imus = Array.isArray(module && module.imus) && module.imus.length === IMU_COUNT
      ? module.imus.map((imu, i) => Object.assign({}, fresh.imus[i], imu))
      : fresh.imus;
    out.rc = Object.assign({}, fresh.rc, module && module.rc ? module.rc : {});
    out.dshot = Object.assign({}, fresh.dshot, module && module.dshot ? module.dshot : {});
    if (!out.uid) out.uid = fresh.uid;
    if (out.latencyAuto == null) out.latencyAuto = false;
    return out;
  }

  function cloneModule(module, newSn) {
    const cloned = JSON.parse(JSON.stringify(normalizeModule(module)));
    const cleaned = cleanSn(newSn || `${cleanSn(module.sn)}1`);
    cloned.uid = `m-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    cloned.sn = cleaned;
    cloned.latencyTopic = `/ecat/sn${cleaned}/latency`;
    cloned.latencyAuto = true;
    cloned.imus.forEach((imu) => {
      imu.topic = `/imu/sn${cleaned}/can${imu.can}/slot${imu.slot}`;
      imu.frame = `imu_sn${cleaned}_can${imu.can}_slot${imu.slot}`;
    });
    cloned.rc.topic = `/ecat/sn${cleaned}/dji_rc`;
    cloned.dshot.topic = `/ecat/sn${cleaned}/dshot`;
    return cloned;
  }

  function validateTopic(topic, label, errors) {
    const s = String(topic || '');
    if (!s.startsWith('/')) errors.push(`${label}: ROS2 topic 必须以 / 开头。`);
    if (s.includes("'")) errors.push(`${label}: ROS2 topic 不能包含单引号。`);
  }

  function validateModules(modules) {
    const errors = [];
    const warnings = [];
    const perModule = [];
    const snSeen = new Map();
    const topicSeen = new Map();

    if (!Array.isArray(modules) || modules.length === 0) {
      return { errors: ['至少需要一个 ProductCode 0x06 EtherCAT 模块。'], warnings, perModule };
    }

    modules.forEach((raw, moduleIndex) => {
      const module = normalizeModule(raw);
      const localErrors = [];
      const localWarnings = [];
      const sn = cleanSn(module.sn);
      const label = `模块 ${moduleIndex + 1}`;

      if (!/^\d{1,10}$/.test(sn)) {
        localErrors.push('Serial Number 必须是 1~10 位十进制数字。');
      } else {
        if (snSeen.has(sn)) localErrors.push(`Serial Number 与模块 ${snSeen.get(sn) + 1} 重复。`);
        else snSeen.set(sn, moduleIndex);
        if (sn.length !== 7) localWarnings.push('常见 H750 SN 是 7 位，请确认实际 slaveinfo 输出。');
      }

      validateTopic(module.latencyTopic, 'Latency', localErrors);

      if (!Array.isArray(module.imus) || module.imus.length !== IMU_COUNT) {
        localErrors.push('0x06 profile 固定要求前 6 个 task 为 HIPNUC IMU。');
      } else {
        const idsByBus = {1: new Map(), 2: new Map()};
        module.imus.forEach((imu, i) => {
          const expected = SLOT_LAYOUT[i];
          const slotLabel = `CAN${expected.can} Slot${expected.slot}`;
          if (Number(imu.can) !== expected.can) localErrors.push(`${slotLabel}: CAN 端口必须是 ${expected.can}。`);
          if (Number(imu.offset) !== expected.offset) localErrors.push(`${slotLabel}: PDO offset 必须是 ${expected.offset}。`);
          if (!Array.isArray(imu.ids) || imu.ids.length !== 3) {
            localErrors.push(`${slotLabel}: 必须有 3 个 CAN packet ID。`);
          } else {
            imu.ids.forEach((id, p) => {
              const n = parseCanId(id);
              if (!Number.isInteger(n) || n < 0 || n > 0x7ff) {
                localErrors.push(`${slotLabel}: Packet${p + 1} ID 必须在 0x000..0x7FF。`);
              } else {
                const old = idsByBus[expected.can].get(n);
                if (old) localErrors.push(`${slotLabel}: CAN ID ${hexId(n)} 与 ${old} 冲突。`);
                else idsByBus[expected.can].set(n, `${slotLabel} Packet${p + 1}`);
              }
            });
          }
          validateTopic(imu.topic, slotLabel, localErrors);
          if (!String(imu.frame || '').trim()) localErrors.push(`${slotLabel}: frame_name 不能为空。`);
        });
      }

      if (Number(module.rc.offset) !== DJI_RC_OFFSET) localErrors.push(`DJI RC: pdoread_offset 必须是 ${DJI_RC_OFFSET}。`);
      validateTopic(module.rc.topic, 'DJI RC', localErrors);

      if (Number(module.dshot.offset) !== DSHOT_OFFSET) localErrors.push(`DShot: pdowrite_offset 必须是 ${DSHOT_OFFSET}。`);
      if (![0,1,2].includes(Number(module.dshot.connectionLostAction))) localErrors.push('DShot: connection_lost_write_action 只能是 0/1/2。');
      if (!Number.isInteger(Number(module.dshot.dshotId)) || Number(module.dshot.dshotId) < 0 || Number(module.dshot.dshotId) > 255) localErrors.push('DShot: dshot_id 必须是 uint8。');
      if (!Number.isInteger(Number(module.dshot.initValue)) || Number(module.dshot.initValue) < 0 || Number(module.dshot.initValue) > 65535) localErrors.push('DShot: init_value 必须是 uint16。');
      validateTopic(module.dshot.topic, 'DShot', localErrors);

      const topics = [
        ...module.imus.map((imu, i) => ({name: `IMU${i+1}`, value: imu.topic})),
        {name: 'DJI RC', value: module.rc.topic},
        {name: 'DShot', value: module.dshot.topic},
        {name: 'Latency', value: module.latencyTopic},
      ];
      topics.forEach(({name, value}) => {
        if (!value) return;
        if (topicSeen.has(value)) {
          const old = topicSeen.get(value);
          localErrors.push(`${name}: topic ${value} 与模块 ${old.module + 1} 的 ${old.name} 重复。`);
        } else {
          topicSeen.set(value, {module: moduleIndex, name});
        }
      });

      perModule.push({ errors: localErrors, warnings: localWarnings });
      localErrors.forEach((msg) => errors.push(`${label}: ${msg}`));
      localWarnings.forEach((msg) => warnings.push(`${label}: ${msg}`));
    });

    return { errors, warnings, perModule };
  }

  function calculateModuleStats(module) {
    const m = normalizeModule(module);
    return {
      taskCount: TASK_COUNT,
      sdoLength: SDO_LENGTH,
      imuPayload: IMU_COUNT * IMU_PAYLOAD_SIZE,
      diagnostics: DIAGNOSTIC_SIZE,
      djiRcBytes: DJI_RC_SIZE,
      slaveToMasterUsed: DJI_RC_OFFSET + DJI_RC_SIZE,
      slaveToMasterCapacity: SLAVE_TO_MASTER_PDO,
      dshotBytes: DSHOT_SIZE,
      masterToSlaveUsed: DSHOT_SIZE,
      masterToSlaveCapacity: MASTER_TO_SLAVE_PDO,
      reservedS2M: SLAVE_TO_MASTER_PDO - (DJI_RC_OFFSET + DJI_RC_SIZE),
      reservedM2S: MASTER_TO_SLAVE_PDO - DSHOT_SIZE,
      module: m,
    };
  }

  function generateModuleYaml(raw) {
    const module = normalizeModule(raw);
    const sn = cleanSn(module.sn);
    const lines = [];
    lines.push(`  - sn${sn}:`);
    lines.push(`      sdo_len: !uint16_t ${SDO_LENGTH}`);
    lines.push(`      task_count: !uint8_t ${TASK_COUNT}`);
    lines.push(`      latency_pub_topic: !std::string '${yamlString(module.latencyTopic)}'`);
    lines.push('      tasks:');

    module.imus.forEach((imu, index) => {
      const expected = SLOT_LAYOUT[index];
      const ids = imu.ids.map(parseCanId);
      lines.push(`        - app_${index + 1}:`);
      lines.push('            sdowrite_task_type: !uint8_t 3');
      lines.push(`            sdowrite_can_inst: !uint8_t ${expected.can}`);
      lines.push(`            sdowrite_packet1_id: !uint32_t ${ids[0]}`);
      lines.push(`            sdowrite_packet2_id: !uint32_t ${ids[1]}`);
      lines.push(`            sdowrite_packet3_id: !uint32_t ${ids[2]}`);
      lines.push(`            pdoread_offset: !uint16_t ${expected.offset}`);
      lines.push(`            pub_topic: !std::string '${yamlString(imu.topic)}'`);
      lines.push(`            conf_frame_name: !std::string '${yamlString(imu.frame)}'`);
    });

    lines.push('        - app_7:');
    lines.push('            sdowrite_task_type: !uint8_t 1');
    lines.push(`            pdoread_offset: !uint16_t ${DJI_RC_OFFSET}`);
    lines.push(`            pub_topic: !std::string '${yamlString(module.rc.topic)}'`);

    lines.push('        - app_8:');
    lines.push('            sdowrite_task_type: !uint8_t 4');
    lines.push(`            sdowrite_connection_lost_write_action: !uint8_t ${Number(module.dshot.connectionLostAction)}`);
    lines.push(`            sdowrite_dshot_id: !uint8_t ${Number(module.dshot.dshotId)}`);
    lines.push(`            sdowrite_init_value: !uint16_t ${Number(module.dshot.initValue)}`);
    lines.push(`            pdowrite_offset: !uint16_t ${DSHOT_OFFSET}`);
    lines.push(`            sub_topic: !std::string '${yamlString(module.dshot.topic)}'`);
    return lines.join('\n');
  }

  function generateConfigYaml(modules, options = {}) {
    const normalized = (modules || []).map(normalizeModule);
    const validation = validateModules(normalized);
    if (validation.errors.length && !options.allowInvalid) {
      const error = new Error('Configuration contains validation errors.');
      error.validation = validation;
      throw error;
    }
    const chunks = [];
    if (options.includeHeader !== false) {
      chunks.push(`# Generated by ssybh2 ProductCode 0x06 TaskEditor v${VERSION}`);
      chunks.push('# Target: STM32H750 + AX58100');
      chunks.push('# ProductCode/eepid: 0x06');
      chunks.push('# Master -> Slave application PDO: 80 B; EtherCAT Outputs incl. status: 81 B');
      chunks.push('# Slave  -> Master application PDO: 192 B; EtherCAT Inputs incl. status: 193 B');
      chunks.push('# S->M: IMU 0..125, diagnostics 126..159, DJI RC 160..178, reserved 179..191');
      chunks.push('# M->S: DShot 0..7, reserved 8..79');
      chunks.push('# The first six tasks must remain HIPNUC IMU tasks.');
      chunks.push('');
      chunks.push(DEFINES.trimEnd());
      chunks.push('');
    }
    chunks.push('slaves:');
    normalized.forEach((module, i) => {
      chunks.push(generateModuleYaml(module));
      if (i !== normalized.length - 1) chunks.push('');
    });
    return `${chunks.join('\n')}\n`;
  }

  function resetModuleToProfile(module) {
    const sn = cleanSn(module.sn) || '1234567';
    const fresh = createDefaultModule(sn);
    Object.assign(module, fresh);
    module.sn = sn;
    module.latencyTopic = `/ecat/sn${sn}/latency`;
    module.latencyAuto = true;
    return module;
  }

  function updateSn(module, newSn) {
    const oldSn = cleanSn(module.sn);
    const cleaned = cleanSn(newSn);
    const oldDefault = `/ecat/sn${oldSn}/latency`;
    module.sn = cleaned;
    if (module.latencyAuto || module.latencyTopic === oldDefault) {
      module.latencyTopic = `/ecat/sn${cleaned}/latency`;
      module.latencyAuto = true;
    }
    return module;
  }

  return {
    VERSION,
    PRODUCT_CODE,
    MASTER_TO_SLAVE_PDO,
    SLAVE_TO_MASTER_PDO,
    IMU_PAYLOAD_SIZE,
    IMU_COUNT,
    DIAGNOSTIC_SIZE,
    DJI_RC_OFFSET,
    DJI_RC_SIZE,
    DSHOT_OFFSET,
    DSHOT_SIZE,
    TASK_COUNT,
    SDO_LENGTH,
    SLOT_LAYOUT,
    cleanSn,
    parseCanId,
    hexId,
    createDefaultModule,
    normalizeModule,
    cloneModule,
    validateModules,
    calculateModuleStats,
    generateConfigYaml,
    resetModuleToProfile,
    updateSn,
  };
});
