(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.SixImuConfig = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const VERSION = '1.0.0';
  const PRODUCT_CODE = 0x05;
  const MASTER_TO_SLAVE_PDO = 80;
  const SLAVE_TO_MASTER_PDO = 160;
  const IMU_PAYLOAD_SIZE = 21;
  const IMU_COUNT = 6;
  const DIAGNOSTIC_SIZE = 34;
  const SDO_LENGTH = 85;

  const DEFINES = `#define UNKNOWN_APP_ID 999\n#define DJIRC_APP_ID 1\n#define LK_APP_ID 2\n#define HIPNUC_IMU_CAN_APP_ID 3\n#define DSHOT_APP_ID 4\n#define DJICAN_APP_ID 5\n#define VANILLA_PWM_APP_ID 6\n#define EXTERNAL_PWM_APP_ID 7\n#define MS5837_30BA_APP_ID 8\n#define ADC_APP_ID 9\n#define CAN_PMU_APP_ID 10\n\n#define CAN_PORT_1 1\n#define CAN_PORT_2 2\n`;

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
    const num = parseCanId(value);
    if (!Number.isFinite(num)) return '—';
    return `0x${num.toString(16).toUpperCase().padStart(2, '0')}`;
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
    };
  }

  function cloneModule(module, newSn) {
    const cloned = JSON.parse(JSON.stringify(module));
    const cleaned = cleanSn(newSn || `${cleanSn(module.sn)}1`);
    cloned.uid = `m-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    cloned.sn = cleaned;
    cloned.latencyTopic = `/ecat/sn${cleaned}/latency`;
    cloned.latencyAuto = true;
    cloned.imus = cloned.imus.map((imu) => ({ ...imu }));
    return cloned;
  }

  function expectedImu(index) {
    return SLOT_LAYOUT[index];
  }

  function validateModules(modules) {
    const errors = [];
    const warnings = [];
    const perModule = [];
    const snSeen = new Map();
    const topicSeen = new Map();

    if (!Array.isArray(modules) || modules.length === 0) {
      errors.push('至少需要一个 6-IMU EtherCAT 从站模块。');
      return { errors, warnings, perModule };
    }

    modules.forEach((module, moduleIndex) => {
      const localErrors = [];
      const localWarnings = [];
      const sn = cleanSn(module.sn);
      const label = `模块 ${moduleIndex + 1}`;

      if (!/^\d{1,10}$/.test(sn)) {
        localErrors.push('Serial Number 必须是 1~10 位十进制数字（不要输入 sn 前缀也可以，网页会自动处理）。');
      } else {
        if (snSeen.has(sn)) {
          localErrors.push(`Serial Number 与模块 ${snSeen.get(sn) + 1} 重复。`);
        } else {
          snSeen.set(sn, moduleIndex);
        }
        if (sn.length !== 7) {
          localWarnings.push('常见 H750 板 SN 是 7 位；当前位数不是 7 位，请确认这是实际 slaveinfo 读到的 SN。');
        }
      }

      if (!String(module.latencyTopic || '').startsWith('/')) {
        localErrors.push('Latency topic 必须以 / 开头。');
      }
      if (String(module.latencyTopic || '').includes("'")) {
        localErrors.push("Latency topic 不能包含单引号 '。 ");
      }

      if (!Array.isArray(module.imus) || module.imus.length !== IMU_COUNT) {
        localErrors.push('ProductCode 0x05 当前固定要求 6 个 HIPNUC IMU task；不要删除 slot。');
      } else {
        const busIds = { 1: new Map(), 2: new Map() };

        module.imus.forEach((imu, imuIndex) => {
          const expected = expectedImu(imuIndex);
          const slotLabel = `CAN${expected.can} Slot${expected.slot}`;

          if (Number(imu.can) !== expected.can) {
            localErrors.push(`${slotLabel}: CAN 端口必须是 ${expected.can}。`);
          }
          if (Number(imu.offset) !== expected.offset) {
            localErrors.push(`${slotLabel}: PDO offset 必须是 ${expected.offset}。`);
          }
          if (!Array.isArray(imu.ids) || imu.ids.length !== 3) {
            localErrors.push(`${slotLabel}: 必须配置 Packet1/2/3 三个 CAN ID。`);
          } else {
            imu.ids.forEach((rawId, packetIndex) => {
              const id = parseCanId(rawId);
              if (!Number.isInteger(id) || id < 0 || id > 0x7ff) {
                localErrors.push(`${slotLabel} Packet${packetIndex + 1}: CAN ID 必须在 0x000~0x7FF。`);
                return;
              }
              const busMap = busIds[expected.can];
              if (busMap.has(id)) {
                localErrors.push(`${slotLabel} Packet${packetIndex + 1}: ${hexId(id)} 与 ${busMap.get(id)} 冲突（同一条 CAN 总线 ID 必须唯一）。`);
              } else {
                busMap.set(id, `${slotLabel} Packet${packetIndex + 1}`);
              }
            });
          }

          const topic = String(imu.topic || '');
          if (!topic.startsWith('/')) {
            localErrors.push(`${slotLabel}: ROS2 topic 必须以 / 开头。`);
          }
          if (topic.includes("'")) {
            localErrors.push(`${slotLabel}: ROS2 topic 不能包含单引号 '。`);
          }
          if (!String(imu.frame || '').trim()) {
            localErrors.push(`${slotLabel}: frame_name 不能为空。`);
          }
          if (String(imu.frame || '').includes("'")) {
            localErrors.push(`${slotLabel}: frame_name 不能包含单引号 '。`);
          }

          if (topic) {
            if (topicSeen.has(topic)) {
              const old = topicSeen.get(topic);
              localErrors.push(`${slotLabel}: topic ${topic} 与模块 ${old.module + 1} 的 ${old.slot} 重复。`);
            } else {
              topicSeen.set(topic, { module: moduleIndex, slot: slotLabel });
            }
          }
        });
      }

      perModule.push({ errors: localErrors, warnings: localWarnings });
      localErrors.forEach((msg) => errors.push(`${label}: ${msg}`));
      localWarnings.forEach((msg) => warnings.push(`${label}: ${msg}`));
    });

    return { errors, warnings, perModule };
  }

  function calculateModuleStats(module) {
    const taskCount = Array.isArray(module.imus) ? module.imus.length : 0;
    const sdoLength = 1 + taskCount * (1 + 1 + 4 + 4 + 4);
    const imuPayload = taskCount * IMU_PAYLOAD_SIZE;
    return {
      taskCount,
      sdoLength,
      imuPayload,
      diagnostics: DIAGNOSTIC_SIZE,
      slaveToMasterCapacity: SLAVE_TO_MASTER_PDO,
      masterToSlaveCapacity: MASTER_TO_SLAVE_PDO,
      slaveToMasterUsed: taskCount === IMU_COUNT ? SLAVE_TO_MASTER_PDO : imuPayload + DIAGNOSTIC_SIZE,
      masterToSlaveTaskUsed: 0,
    };
  }

  function generateModuleYaml(module) {
    const sn = cleanSn(module.sn);
    const lines = [];
    lines.push(`  - sn${sn}:`);
    lines.push(`      sdo_len: !uint16_t ${SDO_LENGTH}`);
    lines.push(`      task_count: !uint8_t ${IMU_COUNT}`);
    lines.push(`      latency_pub_topic: !std::string '${yamlString(module.latencyTopic)}'`);
    lines.push('');
    lines.push('      tasks:');

    module.imus.forEach((imu, index) => {
      const expected = expectedImu(index);
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
      if (index !== module.imus.length - 1) lines.push('');
    });

    return lines.join('\n');
  }

  function generateConfigYaml(modules, options = {}) {
    const includeHeader = options.includeHeader !== false;
    const validation = validateModules(modules);
    if (validation.errors.length && !options.allowInvalid) {
      const error = new Error('Configuration contains validation errors.');
      error.validation = validation;
      throw error;
    }

    const chunks = [];
    if (includeHeader) {
      chunks.push(`# Generated by ssybh2 6-IMU TaskEditor v${VERSION}`);
      chunks.push('# Target slave: STM32H750 + AX58100, ProductCode/eepid 0x05');
      chunks.push('# Master -> Slave PDO: 80 bytes');
      chunks.push('# Slave  -> Master PDO: 160 bytes = 6*21B IMU + 34B diagnostics');
      chunks.push('# ProductCode 0x05 is stored in the AX58100 EEPROM and is NOT a YAML field.');
      chunks.push('#');
      chunks.push('# CAN1: slot1 0x01-03, slot2 0x04-06, slot3 0x07-09');
      chunks.push('# CAN2: slot1 0x01-03, slot2 0x04-06, slot3 0x07-09');
      chunks.push('');
      chunks.push(DEFINES.trimEnd());
      chunks.push('');
    }
    chunks.push('slaves:');
    modules.forEach((module, index) => {
      chunks.push(generateModuleYaml(module));
      if (index !== modules.length - 1) chunks.push('');
    });
    return `${chunks.join('\n')}\n`;
  }

  function resetModuleToProfile(module) {
    const sn = cleanSn(module.sn) || '1234567';
    const fresh = createDefaultModule(sn);
    module.sn = fresh.sn;
    module.latencyTopic = `/ecat/sn${sn}/latency`;
    module.latencyAuto = true;
    module.imus = fresh.imus;
    return module;
  }

  function updateSn(module, newSn) {
    const oldSn = cleanSn(module.sn);
    const cleaned = cleanSn(newSn);
    const oldDefaultLatency = `/ecat/sn${oldSn}/latency`;
    module.sn = cleaned;
    if (module.latencyAuto || module.latencyTopic === oldDefaultLatency) {
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
    SDO_LENGTH,
    SLOT_LAYOUT,
    cleanSn,
    parseCanId,
    hexId,
    createDefaultModule,
    cloneModule,
    validateModules,
    calculateModuleStats,
    generateConfigYaml,
    resetModuleToProfile,
    updateSn,
  };
});