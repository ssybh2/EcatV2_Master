'use strict';
const assert = require('assert');
const C = require('./generator.js');

const module1 = C.createDefaultModule('1234567');
const validation = C.validateModules([module1]);
assert.deepStrictEqual(validation.errors, []);
assert.strictEqual(C.calculateModuleStats(module1).sdoLength, 85);
assert.strictEqual(C.calculateModuleStats(module1).imuPayload, 126);

const yaml = C.generateConfigYaml([module1]);
assert(yaml.includes('Target slave: STM32H750 + AX58100, ProductCode/eepid 0x05'));
assert(yaml.includes('  - sn1234567:'));
assert(yaml.includes('      sdo_len: !uint16_t 85'));
assert(yaml.includes('      task_count: !uint8_t 6'));
assert(yaml.includes('            pdoread_offset: !uint16_t 0'));
assert(yaml.includes('            pdoread_offset: !uint16_t 21'));
assert(yaml.includes('            pdoread_offset: !uint16_t 42'));
assert(yaml.includes('            pdoread_offset: !uint16_t 63'));
assert(yaml.includes('            pdoread_offset: !uint16_t 84'));
assert(yaml.includes('            pdoread_offset: !uint16_t 105'));
assert(yaml.includes("            pub_topic: !std::string '/imu/can2/slot3'"));

const broken = C.createDefaultModule('1234567');
broken.imus[1].ids[0] = 1;
assert(C.validateModules([broken]).errors.some((msg) => msg.includes('冲突')));

const invalidSn = C.createDefaultModule('1234567');
invalidSn.sn = 'abc';
assert(C.validateModules([invalidSn]).errors.some((msg) => msg.includes('Serial Number')));

const duplicateA = C.createDefaultModule('1234567');
const duplicateB = C.createDefaultModule('1234568');
assert(C.validateModules([duplicateA, duplicateB]).errors.some((msg) => msg.includes('topic')));

duplicateB.imus.forEach((imu) => { imu.topic = `/imu/sn1234568/can${imu.can}/slot${imu.slot}`; });
assert.deepStrictEqual(C.validateModules([duplicateA, duplicateB]).errors, []);

assert.strictEqual(C.parseCanId('0x7FF'), 2047);
assert.strictEqual(C.hexId(7), '0x07');

console.log('6-IMU TaskEditor generator tests: PASS');