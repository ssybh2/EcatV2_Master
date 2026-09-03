(function () {
  'use strict';
  const C = window.EcatV006Config;
  const STORAGE_KEY = 'ssybh2-ecat-v006-task-editor-v2';

  const moduleList = document.getElementById('moduleList');
  const yamlPreview = document.getElementById('yamlPreview');
  const validationSummary = document.getElementById('validationSummary');
  const pdoOverview = document.getElementById('pdoOverview');
  const copyButton = document.getElementById('copyYamlButton');
  const downloadButton = document.getElementById('downloadYamlButton');
  const addButton = document.getElementById('addModuleButton');
  const resetAllButton = document.getElementById('resetAllButton');
  const versionText = document.getElementById('versionText');
  const toastNode = document.getElementById('toast');
  let toastTimer = null;

  versionText.textContent = C.VERSION;

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { modules: [C.createDefaultModule('1234567')] };
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.modules) || parsed.modules.length === 0) {
        return { modules: [C.createDefaultModule('1234567')] };
      }
      return { modules: parsed.modules.map(C.normalizeModule) };
    } catch (_) {
      return { modules: [C.createDefaultModule('1234567')] };
    }
  }

  let state = loadState();

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function toast(text) {
    toastNode.textContent = text;
    toastNode.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastNode.classList.remove('show'), 2200);
  }

  function nextSn() {
    const vals = state.modules.map(m => Number(C.cleanSn(m.sn))).filter(Number.isFinite);
    return String((vals.length ? Math.max(...vals) : 1234566) + 1);
  }

  function taskCard(title, badge, body, extraClass='') {
    return `<section class="task-card ${extraClass}">
      <div class="task-head"><strong>${title}</strong><span class="pill">${badge}</span></div>
      ${body}
    </section>`;
  }

  function moduleHtml(raw, mi, local) {
    const m = C.normalizeModule(raw);
    state.modules[mi] = m;
    const status = local.errors.length ? `${local.errors.length} errors`
      : local.warnings.length ? `${local.warnings.length} warnings` : 'Ready';
    const statusClass = local.errors.length ? 'bad' : local.warnings.length ? 'warn' : 'ok';

    const imuCards = m.imus.map((imu, ii) => taskCard(
      `Task ${ii + 1} · HIPNUC IMU · CAN${imu.can} Slot${imu.slot}`,
      `read @ ${imu.offset}`,
      `<div class="grid three">
        ${imu.ids.map((id, pi) => `<label><span>Packet${pi + 1} ID</span>
          <input data-mi="${mi}" data-kind="imu-id" data-ii="${ii}" data-pi="${pi}" value="${esc(C.hexId(id))}">
        </label>`).join('')}
      </div>
      <div class="grid two">
        <label><span>ROS2 Publish Topic</span>
          <input data-mi="${mi}" data-kind="imu-topic" data-ii="${ii}" value="${esc(imu.topic)}">
        </label>
        <label><span>frame_name</span>
          <input data-mi="${mi}" data-kind="imu-frame" data-ii="${ii}" value="${esc(imu.frame)}">
        </label>
      </div>`
    )).join('');

    const rcCard = taskCard(
      'Task 7 · DJI RC / DBUS',
      'read @ 160 · 19 B',
      `<div class="grid two">
        <label><span>ROS2 Publish Topic</span>
          <input data-mi="${mi}" data-kind="rc-topic" value="${esc(m.rc.topic)}">
        </label>
        <div class="readonly"><span>Payload</span><strong>18 B DBUS + 1 B online</strong></div>
      </div>`,
      'rc'
    );

    const dshotCard = taskCard(
      'Task 8 · DShot',
      'write @ 0 · 8 B',
      `<div class="grid four">
        <label><span>ROS2 Subscribe Topic</span>
          <input data-mi="${mi}" data-kind="dshot-topic" value="${esc(m.dshot.topic)}">
        </label>
        <label><span>DShot ID</span>
          <input type="number" min="0" max="255" data-mi="${mi}" data-kind="dshot-id" value="${esc(m.dshot.dshotId)}">
        </label>
        <label><span>Init Value</span>
          <input type="number" min="0" max="65535" data-mi="${mi}" data-kind="dshot-init" value="${esc(m.dshot.initValue)}">
        </label>
        <label><span>Connection Lost Action</span>
          <select data-mi="${mi}" data-kind="dshot-lost">
            <option value="0" ${Number(m.dshot.connectionLostAction)===0?'selected':''}>0</option>
            <option value="1" ${Number(m.dshot.connectionLostAction)===1?'selected':''}>1</option>
            <option value="2" ${Number(m.dshot.connectionLostAction)===2?'selected':''}>2 · RESET_TO_DEFAULT</option>
          </select>
        </label>
      </div>
      <p class="hint">安全默认：lost action = 2，init_value = 0。首次实机 DShot 测试请拆桨/解除机械负载。</p>`,
      'dshot'
    );

    return `<article class="module-card">
      <div class="module-head">
        <div>
          <h2>H750 Universal Module — ProductCode 0x06</h2>
          <p>80 B M→S / 192 B S→M · 6 IMU + diagnostics + DJI RC + DShot</p>
        </div>
        <div class="actions">
          <span class="status ${statusClass}">${status}</span>
          <button data-action="duplicate" data-mi="${mi}">Duplicate</button>
          <button data-action="reset" data-mi="${mi}">Reset</button>
          <button class="danger" data-action="delete" data-mi="${mi}">Delete</button>
        </div>
      </div>
      <div class="grid four module-meta">
        <label><span>Slave Serial</span>
          <input data-mi="${mi}" data-kind="sn" value="${esc(m.sn)}">
        </label>
        <label><span>Latency Topic</span>
          <input data-mi="${mi}" data-kind="latency" value="${esc(m.latencyTopic)}">
        </label>
        <div class="readonly"><span>SDO Length</span><strong>91 B</strong></div>
        <div class="readonly"><span>Task Count</span><strong>8</strong></div>
      </div>
      <div class="section-title">Tasks 1–6 · HIPNUC IMU</div>
      <div class="task-grid">${imuCards}</div>
      <div class="section-title">Tasks 7–8 · Added I/O</div>
      <div class="task-grid io">${rcCard}${dshotCard}</div>
    </article>`;
  }

  function render() {
    const validation = C.validateModules(state.modules);
    moduleList.innerHTML = state.modules.map((m, i) =>
      moduleHtml(m, i, validation.perModule[i] || {errors:[], warnings:[]})
    ).join('');

    if (validation.errors.length) {
      validationSummary.innerHTML = `<div class="validation badbox"><strong>不能生成：</strong><ul>${
        validation.errors.map(x => `<li>${esc(x)}</li>`).join('')
      }</ul></div>`;
    } else if (validation.warnings.length) {
      validationSummary.innerHTML = `<div class="validation warnbox"><strong>可生成，但请检查：</strong><ul>${
        validation.warnings.map(x => `<li>${esc(x)}</li>`).join('')
      }</ul></div>`;
    } else {
      validationSummary.innerHTML = '<div class="validation okbox">✓ 0x06 / 8-task 配置通过检查。</div>';
    }

    try {
      yamlPreview.textContent = C.generateConfigYaml(state.modules, {allowInvalid: true});
    } catch (_) {
      yamlPreview.textContent = '# Configuration generation failed\n';
    }

    pdoOverview.innerHTML = state.modules.map((m) => {
      const s = C.calculateModuleStats(m);
      return `<div class="overview">
        <strong>sn${esc(C.cleanSn(m.sn))}</strong>
        <span>Tasks ${s.taskCount} · SDO ${s.sdoLength} B</span>
        <span>S→M ${s.slaveToMasterUsed}/${s.slaveToMasterCapacity} B used + ${s.reservedS2M} B reserved</span>
        <span>M→S ${s.masterToSlaveUsed}/${s.masterToSlaveCapacity} B used + ${s.reservedM2S} B reserved</span>
      </div>`;
    }).join('');

    copyButton.disabled = validation.errors.length > 0;
    downloadButton.disabled = validation.errors.length > 0;
  }

  moduleList.addEventListener('input', (ev) => {
    const t = ev.target;
    const mi = Number(t.dataset.mi);
    if (!Number.isInteger(mi) || !state.modules[mi]) return;
    const m = state.modules[mi];
    const kind = t.dataset.kind;

    if (kind === 'sn') C.updateSn(m, t.value);
    else if (kind === 'latency') { m.latencyTopic = t.value; m.latencyAuto = false; }
    else if (kind === 'imu-id') m.imus[Number(t.dataset.ii)].ids[Number(t.dataset.pi)] = t.value;
    else if (kind === 'imu-topic') m.imus[Number(t.dataset.ii)].topic = t.value;
    else if (kind === 'imu-frame') m.imus[Number(t.dataset.ii)].frame = t.value;
    else if (kind === 'rc-topic') m.rc.topic = t.value;
    else if (kind === 'dshot-topic') m.dshot.topic = t.value;
    else if (kind === 'dshot-id') m.dshot.dshotId = Number(t.value);
    else if (kind === 'dshot-init') m.dshot.initValue = Number(t.value);
    save();
    render();
  });

  moduleList.addEventListener('change', (ev) => {
    const t = ev.target;
    const mi = Number(t.dataset.mi);
    if (!Number.isInteger(mi) || !state.modules[mi]) return;
    if (t.dataset.kind === 'dshot-lost') {
      state.modules[mi].dshot.connectionLostAction = Number(t.value);
      save(); render();
    }
  });

  moduleList.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-action]');
    if (!btn) return;
    const mi = Number(btn.dataset.mi);
    if (!Number.isInteger(mi) || !state.modules[mi]) return;
    const action = btn.dataset.action;
    if (action === 'delete') {
      if (state.modules.length === 1) return toast('至少保留一个模块');
      state.modules.splice(mi, 1);
    } else if (action === 'reset') {
      C.resetModuleToProfile(state.modules[mi]);
    } else if (action === 'duplicate') {
      state.modules.splice(mi + 1, 0, C.cloneModule(state.modules[mi], nextSn()));
    }
    save(); render();
  });

  addButton.addEventListener('click', () => {
    const m = C.createDefaultModule(nextSn());
    if (state.modules.length) {
      m.imus.forEach(imu => {
        imu.topic = `/imu/sn${m.sn}/can${imu.can}/slot${imu.slot}`;
        imu.frame = `imu_sn${m.sn}_can${imu.can}_slot${imu.slot}`;
      });
      m.rc.topic = `/ecat/sn${m.sn}/dji_rc`;
      m.dshot.topic = `/ecat/sn${m.sn}/dshot`;
    }
    state.modules.push(m);
    save(); render();
  });

  resetAllButton.addEventListener('click', () => {
    if (!confirm('恢复默认 ProductCode 0x06 8-task 配置？')) return;
    state = {modules: [C.createDefaultModule('1234567')]};
    save(); render();
  });

  copyButton.addEventListener('click', async () => {
    const yaml = C.generateConfigYaml(state.modules);
    try {
      await navigator.clipboard.writeText(yaml);
      toast('config.yaml 已复制');
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = yaml; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove();
      toast('config.yaml 已复制');
    }
  });

  downloadButton.addEventListener('click', () => {
    const yaml = C.generateConfigYaml(state.modules);
    const blob = new Blob([yaml], {type:'text/yaml;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'config.yaml'; a.click();
    URL.revokeObjectURL(url);
    toast('config.yaml 已下载');
  });

  render();
})();
