(function () {
  'use strict';

  const C = window.SixImuConfig;
  const STORAGE_KEY = 'ssybh2-6imu-task-editor-v1';

  let state = loadState();
  let activeTab = 'settings';
  let toastTimer = null;

  const moduleList = document.getElementById('moduleList');
  const moduleTemplate = document.getElementById('moduleTemplate');
  const imuTemplate = document.getElementById('imuTemplate');
  const yamlPreview = document.getElementById('yamlPreview');
  const validationSummary = document.getElementById('validationSummary');
  const pdoOverview = document.getElementById('pdoOverview');
  const globalStatusBadge = document.getElementById('globalStatusBadge');
  const downloadButton = document.getElementById('downloadYamlButton');
  const copyButton = document.getElementById('copyYamlButton');

  document.getElementById('versionText').textContent = C.VERSION;

  document.querySelectorAll('.tab').forEach((button) => {
    button.addEventListener('click', () => switchTab(button.dataset.tab));
  });

  document.getElementById('addModuleButton').addEventListener('click', () => {
    const base = state.modules.length === 0 ? '1234567' : nextSuggestedSn();
    const module = C.createDefaultModule(base);
    if (state.modules.length > 0) {
      module.imus.forEach((imu) => {
        imu.topic = `/imu/sn${module.sn}/can${imu.can}/slot${imu.slot}`;
        imu.frame = `imu_sn${module.sn}_can${imu.can}_slot${imu.slot}`;
      });
    }
    state.modules.push(module);
    persistAndRender();
  });

  document.getElementById('resetAllButton').addEventListener('click', () => {
    if (!window.confirm('恢复默认 1 块 6-IMU 模块？当前网页内的编辑内容会被清除。')) return;
    state = { modules: [C.createDefaultModule('1234567')] };
    persistAndRender();
    toast('已恢复默认 6-IMU 配置');
  });

  copyButton.addEventListener('click', async () => {
    const validation = C.validateModules(state.modules);
    if (validation.errors.length) {
      toast('请先修复红色错误，再复制配置');
      return;
    }
    const yaml = C.generateConfigYaml(state.modules);
    try {
      await navigator.clipboard.writeText(yaml);
      toast('config.yaml 已复制到剪贴板');
    } catch (error) {
      const textarea = document.createElement('textarea');
      textarea.value = yaml;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      toast('config.yaml 已复制到剪贴板');
    }
  });

  downloadButton.addEventListener('click', () => {
    const validation = C.validateModules(state.modules);
    if (validation.errors.length) {
      toast('请先修复红色错误，再下载配置');
      return;
    }
    const yaml = C.generateConfigYaml(state.modules);
    const blob = new Blob([yaml], { type: 'text/yaml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'config.yaml';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast('config.yaml 下载完成');
  });

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { modules: [C.createDefaultModule('1234567')] };
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.modules) || parsed.modules.length === 0) {
        return { modules: [C.createDefaultModule('1234567')] };
      }
      parsed.modules.forEach((module) => {
        if (!module.uid) module.uid = `m-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        if (module.latencyAuto == null) module.latencyAuto = false;
      });
      return parsed;
    } catch (error) {
      return { modules: [C.createDefaultModule('1234567')] };
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function nextSuggestedSn() {
    const nums = state.modules
      .map((m) => Number(C.cleanSn(m.sn)))
      .filter((n) => Number.isFinite(n));
    const max = nums.length ? Math.max(...nums) : 1234566;
    return String(max + 1);
  }

  function switchTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.tab').forEach((button) => {
      button.classList.toggle('active', button.dataset.tab === tab);
    });
    document.querySelectorAll('.tab-panel').forEach((panel) => panel.classList.remove('active'));
    document.getElementById(tab === 'settings' ? 'settingsPanel' : 'generatorPanel').classList.add('active');
    if (tab === 'generator') renderGenerator();
  }

  function persistAndRender() {
    saveState();
    renderAll();
  }

  function renderAll() {
    renderModules();
    renderGenerator();
  }

  function renderModules() {
    moduleList.innerHTML = '';
    const validation = C.validateModules(state.modules);

    if (state.modules.length === 0) {
      moduleList.innerHTML = '<div class="empty-state"><strong>还没有 EtherCAT Module</strong>点击右上角 “Add 6-IMU Module” 添加一块 ProductCode 0x05 从站。</div>';
      return;
    }

    state.modules.forEach((module, moduleIndex) => {
      const node = moduleTemplate.content.firstElementChild.cloneNode(true);
      const local = validation.perModule[moduleIndex] || { errors: [], warnings: [] };
      const status = node.querySelector('.module-status');
      setStatusBadge(status, local.errors.length ? 'error' : local.warnings.length ? 'warn' : 'ok', local.errors.length ? `${local.errors.length} errors` : local.warnings.length ? `${local.warnings.length} warnings` : 'Ready');

      const snInput = node.querySelector('.module-sn');
      const latencyInput = node.querySelector('.module-latency');
      snInput.value = module.sn;
      latencyInput.value = module.latencyTopic;

      snInput.addEventListener('input', () => {
        C.updateSn(module, snInput.value);
        latencyInput.value = module.latencyTopic;
        saveState();
        renderGenerator();
        refreshModuleValidation(node, moduleIndex);
      });

      latencyInput.addEventListener('input', () => {
        module.latencyTopic = latencyInput.value;
        module.latencyAuto = false;
        saveState();
        renderGenerator();
        refreshModuleValidation(node, moduleIndex);
      });

      node.querySelector('.collapse-button').addEventListener('click', () => node.classList.toggle('collapsed'));
      node.querySelector('.delete-module').addEventListener('click', () => {
        if (!window.confirm(`删除 sn${C.cleanSn(module.sn)} 这块模块？`)) return;
        state.modules.splice(moduleIndex, 1);
        persistAndRender();
      });
      node.querySelector('.duplicate-module').addEventListener('click', () => {
        const clone = C.cloneModule(module, nextSuggestedSn());
        clone.imus.forEach((imu) => {
          imu.topic = `/imu/sn${clone.sn}/can${imu.can}/slot${imu.slot}`;
          imu.frame = `imu_sn${clone.sn}_can${imu.can}_slot${imu.slot}`;
        });
        state.modules.splice(moduleIndex + 1, 0, clone);
        persistAndRender();
      });
      node.querySelector('.reset-module').addEventListener('click', () => {
        if (!window.confirm(`恢复 sn${C.cleanSn(module.sn)} 的默认 6-IMU CAN ID / topic / offset？`)) return;
        C.resetModuleToProfile(module);
        persistAndRender();
      });

      node.querySelectorAll('.bus-card').forEach((busCard) => {
        const bus = Number(busCard.dataset.bus);
        const list = busCard.querySelector('.imu-list');
        module.imus.filter((imu) => Number(imu.can) === bus).forEach((imu) => {
          list.appendChild(renderImuCard(module, imu, moduleIndex));
        });
      });

      moduleList.appendChild(node);
    });
  }

  function renderImuCard(module, imu, moduleIndex) {
    const node = imuTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector('.imu-name').textContent = `CAN${imu.can} Slot${imu.slot}`;
    node.querySelector('.firmware-pill').textContent = `${imu.firmware} firmware`;
    node.querySelector('.offset-pill').textContent = `PDO offset ${imu.offset}`;

    const inputs = [node.querySelector('.id1'), node.querySelector('.id2'), node.querySelector('.id3')];
    inputs.forEach((input, idx) => {
      input.value = C.hexId(imu.ids[idx]);
      input.addEventListener('input', () => {
        imu.ids[idx] = input.value;
        saveState();
        renderGenerator();
        refreshImuError(node, moduleIndex, imu);
      });
      input.addEventListener('blur', () => {
        const parsed = C.parseCanId(input.value);
        if (Number.isInteger(parsed)) {
          imu.ids[idx] = parsed;
          input.value = C.hexId(parsed);
          saveState();
          renderGenerator();
        }
      });
    });

    const topic = node.querySelector('.imu-topic');
    const frame = node.querySelector('.imu-frame');
    topic.value = imu.topic;
    frame.value = imu.frame;
    topic.addEventListener('input', () => {
      imu.topic = topic.value;
      saveState();
      renderGenerator();
      refreshImuError(node, moduleIndex, imu);
    });
    frame.addEventListener('input', () => {
      imu.frame = frame.value;
      saveState();
      renderGenerator();
      refreshImuError(node, moduleIndex, imu);
    });

    refreshImuError(node, moduleIndex, imu);
    return node;
  }

  function refreshModuleValidation(node, moduleIndex) {
    const validation = C.validateModules(state.modules);
    const local = validation.perModule[moduleIndex] || { errors: [], warnings: [] };
    const badge = node.querySelector('.module-status');
    setStatusBadge(badge, local.errors.length ? 'error' : local.warnings.length ? 'warn' : 'ok', local.errors.length ? `${local.errors.length} errors` : local.warnings.length ? `${local.warnings.length} warnings` : 'Ready');
  }

  function refreshImuError(node, moduleIndex, imu) {
    const validation = C.validateModules(state.modules);
    const local = validation.perModule[moduleIndex] || { errors: [] };
    const prefix = `CAN${imu.can} Slot${imu.slot}`;
    const messages = local.errors.filter((message) => message.startsWith(prefix));
    const box = node.querySelector('.imu-error');
    box.textContent = messages.join(' · ');
    box.classList.toggle('visible', messages.length > 0);
  }

  function renderGenerator() {
    const validation = C.validateModules(state.modules);
    const hasErrors = validation.errors.length > 0;
    const hasWarnings = validation.warnings.length > 0;

    setStatusBadge(globalStatusBadge, hasErrors ? 'error' : hasWarnings ? 'warn' : 'ok', hasErrors ? `${validation.errors.length} errors` : hasWarnings ? `${validation.warnings.length} warnings` : 'Ready to download');
    downloadButton.disabled = hasErrors;
    copyButton.disabled = hasErrors;

    if (!hasErrors) {
      yamlPreview.textContent = C.generateConfigYaml(state.modules);
    } else {
      try {
        yamlPreview.textContent = C.generateConfigYaml(state.modules, { allowInvalid: true });
      } catch (error) {
        yamlPreview.textContent = '# Fix validation errors to generate config.yaml\n';
      }
    }

    if (!hasErrors && !hasWarnings) {
      validationSummary.innerHTML = '<div class="validation-ok">✓ 配置通过检查。CAN ID、6 个 task、固定 PDO offset、topic 和 SN 都可以生成。</div>';
    } else {
      const items = [];
      validation.errors.forEach((message) => items.push(`<li class="validation-item error">✕ ${escapeHtml(message)}</li>`));
      validation.warnings.forEach((message) => items.push(`<li class="validation-item warn">⚠ ${escapeHtml(message)}</li>`));
      validationSummary.innerHTML = `<ul class="validation-list">${items.join('')}</ul>`;
    }

    pdoOverview.innerHTML = state.modules.map((module) => {
      const stats = C.calculateModuleStats(module);
      const sn = escapeHtml(C.cleanSn(module.sn) || 'invalid');
      return `
        <div class="module-overview">
          <div class="module-overview-head">
            <span>sn${sn}</span>
            <span>ProductCode 0x05</span>
          </div>
          <div class="metric-row">
            <span>IMU payload</span>
            <div class="meter"><span style="width:${Math.min(100, stats.imuPayload / 126 * 100)}%"></span></div>
            <strong>${stats.imuPayload}/126B</strong>
          </div>
          <div class="metric-row">
            <span>Diagnostics</span>
            <div class="meter diag"><span style="width:100%"></span></div>
            <strong>34B</strong>
          </div>
          <div class="metric-row">
            <span>Slave→Master PDO</span>
            <div class="meter"><span style="width:${Math.min(100, stats.slaveToMasterUsed / stats.slaveToMasterCapacity * 100)}%"></span></div>
            <strong>${stats.slaveToMasterUsed}/${stats.slaveToMasterCapacity}B</strong>
          </div>
          <div class="metric-row">
            <span>SDO task config</span>
            <div class="meter"><span style="width:${Math.min(100, stats.sdoLength / 85 * 100)}%"></span></div>
            <strong>${stats.sdoLength}B</strong>
          </div>
        </div>`;
    }).join('');
  }

  function setStatusBadge(element, mode, text) {
    element.classList.remove('ok', 'warn', 'error');
    element.classList.add(mode);
    element.textContent = text;
  }

  function toast(message) {
    const node = document.getElementById('toast');
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove('show'), 2200);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  renderAll();
  switchTab(activeTab);
})();