'use strict';
const assert = require('assert');
const C = require('./generator.js');

const m = C.createDefaultModule('2883658');
const v = C.validateModules([m]);
assert.deepStrictEqual(v.errors, []);

const s = C.calculateModuleStats(m);
assert.strictEqual(s.taskCount, 8);
assert.strictEqual(s.sdoLength, 91);
assert.strictEqual(s.slaveToMasterCapacity, 192);
assert.strictEqual(s.slaveToMasterUsed, 179);
assert.strictEqual(s.masterToSlaveUsed, 8);

const yaml = C.generateConfigYaml([m]);
[
  'ProductCode/eepid: 0x06',
  'sdo_len: !uint16_t 91',
  'task_count: !uint8_t 8',
  '- app_7:',
  'sdowrite_task_type: !uint8_t 1',
  'pdoread_offset: !uint16_t 160',
  "pub_topic: !std::string '/dji_rc'",
  '- app_8:',
  'sdowrite_task_type: !uint8_t 4',
  'sdowrite_connection_lost_write_action: !uint8_t 2',
  'sdowrite_dshot_id: !uint8_t 1',
  'sdowrite_init_value: !uint16_t 0',
  'pdowrite_offset: !uint16_t 0',
  "sub_topic: !std::string '/dshot'",
].forEach(x => assert(yaml.includes(x), `missing: ${x}`));

console.log('ProductCode 0x06 TaskEditor generator tests: PASS');
