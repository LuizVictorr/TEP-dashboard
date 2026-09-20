// ==========================================================================
// TEP Analytics Dashboard - Frontend Logic (ECharts + Vanilla JS)
// ==========================================================================

const STATE = {
  currentMode: 1,
  currentTab: 'overview',
  currentSampleIndex: 0,
  selectedVariables: [0, 1, 6, 8, 22, 31], // Default: Feeds, Reactor P/T, Valves
  variables: [],
  faultTypes: {},
  datasetInfo: null,
  charts: {},
  simInterval: null,
  simStep: 0,
  simData: null
};

// Distinct colors palette for faults and categories
const PALETTE = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
  '#14B8A6', '#D946EF', '#EAB308', '#0EA5E9', '#A855F7'
];

document.addEventListener('DOMContentLoaded', async () => {
  lucide.createIcons();
  setupNavigation();
  setupEventListeners();
  
  await loadInitialMetadata();
  await loadDashboardForMode(STATE.currentMode);
  
  window.addEventListener('resize', () => {
    Object.values(STATE.charts).forEach(c => c && c.resize());
  });
});

// Setup sidebar tab switching
function setupNavigation() {
  const navButtons = document.querySelectorAll('.nav-item');
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      navButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const tabName = btn.getAttribute('data-tab');
      STATE.currentTab = tabName;

      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      const activePane = document.getElementById(`pane-${tabName}`);
      if (activePane) activePane.classList.add('active');

      // Trigger charts resize when switching tab
      setTimeout(() => {
        Object.values(STATE.charts).forEach(c => c && c.resize());
        handleTabActivated(tabName);
      }, 50);
    });
  });
}

function handleTabActivated(tabName) {
  if (tabName === 'timeseries' && !STATE.charts.timeseries) {
    loadTimeSeriesData();
  } else if (tabName === 'pca' && !STATE.charts.pca) {
    loadPcaData();
  } else if (tabName === 'correlation' && !STATE.charts.correlation) {
    loadCorrelationData();
  } else if (tabName === 'simulator' && !STATE.charts.simLive) {
    initSimulator();
  }
}

// Global Event Listeners
function setupEventListeners() {
  // Mode Selector
  document.getElementById('mode-select').addEventListener('change', async (e) => {
    STATE.currentMode = parseInt(e.target.value);
    document.getElementById('mode-file-badge').textContent = `TEPDataset_Mode${STATE.currentMode}.pickle`;
    await loadDashboardForMode(STATE.currentMode);
  });

  // Refresh button
  document.getElementById('btn-refresh').addEventListener('click', async () => {
    await loadDashboardForMode(STATE.currentMode);
  });

  // Sample index navigation
  document.getElementById('btn-prev-sample').addEventListener('click', () => {
    if (STATE.currentSampleIndex > 0) {
      STATE.currentSampleIndex--;
      document.getElementById('ts-sample-index').value = STATE.currentSampleIndex;
      loadTimeSeriesData();
    }
  });

  document.getElementById('btn-next-sample').addEventListener('click', () => {
    if (STATE.currentSampleIndex < 2899) {
      STATE.currentSampleIndex++;
      document.getElementById('ts-sample-index').value = STATE.currentSampleIndex;
      loadTimeSeriesData();
    }
  });

  document.getElementById('btn-load-sample').addEventListener('click', () => {
    const val = parseInt(document.getElementById('ts-sample-index').value);
    if (!isNaN(val) && val >= 0 && val < 2900) {
      STATE.currentSampleIndex = val;
      loadTimeSeriesData();
    }
  });

  // Filter sample by fault
  document.getElementById('ts-fault-filter').addEventListener('change', async (e) => {
    const faultId = e.target.value;
    if (faultId !== "") {
      const res = await fetch(`/api/samples?mode=${STATE.currentMode}&label=${faultId}&limit=1`);
      const data = await res.json();
      if (data.samples && data.samples.length > 0) {
        STATE.currentSampleIndex = data.samples[0].index;
        document.getElementById('ts-sample-index').value = STATE.currentSampleIndex;
        loadTimeSeriesData();
      }
    }
  });

  // Correlation condition filter
  document.getElementById('corr-label-select').addEventListener('change', () => {
    loadCorrelationData();
  });

  // Comparison variable selector
  document.getElementById('compare-var-select').addEventListener('change', () => {
    loadComparisonChart();
  });

  // Variable Search filter
  document.getElementById('var-search-input').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('#variables-table-body tr');
    rows.forEach(r => {
      const text = r.textContent.toLowerCase();
      r.style.display = text.includes(q) ? '' : 'none';
    });
  });

  // Variable chip presets
  document.querySelectorAll('.chip-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.getAttribute('data-preset');
      applyVariablePreset(preset);
    });
  });

  // Simulator Playback
  document.getElementById('sim-play-btn').addEventListener('click', toggleSimulatorPlayback);
  document.getElementById('sim-reset-btn').addEventListener('click', resetSimulator);
}

// Variable Presets
function applyVariablePreset(preset) {
  if (preset === 'reactor') {
    STATE.selectedVariables = [0, 5, 6, 7, 8, 20, 31, 33];
  } else if (preset === 'separator') {
    STATE.selectedVariables = [10, 11, 12, 13, 21, 27, 28, 32];
  } else if (preset === 'stripper') {
    STATE.selectedVariables = [14, 15, 16, 17, 18, 29, 30];
  } else if (preset === 'valves') {
    STATE.selectedVariables = [22, 23, 24, 25, 26, 27, 28, 31];
  } else if (preset === 'all-feeds') {
    STATE.selectedVariables = [0, 1, 2, 3, 4, 22, 23, 24];
  } else if (preset === 'reset') {
    STATE.selectedVariables = [0, 6, 8];
  }
  updateVariableChipsUI();
  loadTimeSeriesData();
}

// Load metadata once
async function loadInitialMetadata() {
  try {
    const [varsRes, faultsRes] = await Promise.all([
      fetch('/api/variables'),
      fetch('/api/fault-types')
    ]);
    STATE.variables = await varsRes.json();
    STATE.faultTypes = await faultsRes.json();

    renderVariablesTable(STATE.variables);
    renderVariableChips(STATE.variables);
    populateFaultDropdowns(STATE.faultTypes);
    populateCompareDropdown(STATE.variables);
  } catch (err) {
    console.error("Erro ao carregar metadados:", err);
  }
}

// Populate Fault Dropdowns
function populateFaultDropdowns(faults) {
  const tsSelect = document.getElementById('ts-fault-filter');
  const corrSelect = document.getElementById('corr-label-select');
  
  tsSelect.innerHTML = '<option value="">Todas as Falhas</option>';
  corrSelect.innerHTML = '';

  Object.entries(faults).forEach(([id, info]) => {
    const opt1 = document.createElement('option');
    opt1.value = id;
    opt1.textContent = `[${id}] ${info.name}`;
    tsSelect.appendChild(opt1);

    const opt2 = document.createElement('option');
    opt2.value = id;
    opt2.textContent = `[${id}] ${info.name}`;
    corrSelect.appendChild(opt2);
  });
}

function populateCompareDropdown(vars) {
  const select = document.getElementById('compare-var-select');
  select.innerHTML = '';
  vars.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.id;
    opt.textContent = `${v.tag} - ${v.name} (${v.unit})`;
    select.appendChild(opt);
  });
  select.value = 6; // Reactor Pressure default
}

// Render Variables Table
function renderVariablesTable(vars) {
  const tbody = document.getElementById('variables-table-body');
  tbody.innerHTML = '';
  vars.forEach(v => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${v.id}</td>
      <td><span class="tag-badge">${v.tag}</span></td>
      <td><span class="type-badge ${v.type.toLowerCase() === 'medição' ? 'medicao' : 'manipulada'}">${v.type}</span></td>
      <td><strong>${v.name}</strong></td>
      <td><code>${v.unit}</code></td>
      <td>${v.desc}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Render Variable Chips
function renderVariableChips(vars) {
  const container = document.getElementById('variable-chips-list');
  container.innerHTML = '';
  vars.forEach(v => {
    const chip = document.createElement('div');
    chip.className = `var-chip ${STATE.selectedVariables.includes(v.id) ? 'active' : ''}`;
    chip.textContent = `${v.tag} (${v.name})`;
    chip.setAttribute('data-id', v.id);

    chip.addEventListener('click', () => {
      const vid = v.id;
      if (STATE.selectedVariables.includes(vid)) {
        if (STATE.selectedVariables.length > 1) {
          STATE.selectedVariables = STATE.selectedVariables.filter(id => id !== vid);
        }
      } else {
        if (STATE.selectedVariables.length >= 8) {
          STATE.selectedVariables.shift(); // Remove oldest
        }
        STATE.selectedVariables.push(vid);
      }
      updateVariableChipsUI();
      loadTimeSeriesData();
    });

    container.appendChild(chip);
  });
}

function updateVariableChipsUI() {
  document.querySelectorAll('.var-chip').forEach(chip => {
    const id = parseInt(chip.getAttribute('data-id'));
    if (STATE.selectedVariables.includes(id)) {
      chip.classList.add('active');
    } else {
      chip.classList.remove('active');
    }
  });
}

// Load data for selected mode
async function loadDashboardForMode(mode) {
  try {
    const res = await fetch(`/api/dataset-info?mode=${mode}`);
    const info = await res.json();
    STATE.datasetInfo = info;

    // Update KPI Cards
    document.getElementById('kpi-total-samples').textContent = info.totalSamples.toLocaleString('pt-BR');
    document.getElementById('kpi-timesteps').textContent = info.timeSteps;
    document.getElementById('kpi-variables').textContent = info.numVariables;
    document.getElementById('kpi-classes').textContent = info.totalClasses;
    document.getElementById('header-sample-count').textContent = `${info.totalSamples.toLocaleString('pt-BR')} Amostras`;

    renderFaultDistributionChart(info.labelDistribution);
    renderFoldDistributionChart(info.foldDistribution);

    // Refresh active tab
    if (STATE.currentTab === 'timeseries') loadTimeSeriesData();
    if (STATE.currentTab === 'pca') loadPcaData();
    if (STATE.currentTab === 'correlation') loadCorrelationData();
  } catch (err) {
    console.error("Erro ao carregar informações do dataset:", err);
  }
}

// Chart: Fault Distribution Bar Chart
function renderFaultDistributionChart(dist) {
  const chartDom = document.getElementById('chart-fault-distribution');
  if (!STATE.charts.faultDist) {
    STATE.charts.faultDist = echarts.init(chartDom, 'dark');
  }
  
  const labels = Object.keys(dist).map(k => `Falha ${k}`);
  const counts = Object.values(dist);

  const option = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { top: 20, right: 20, bottom: 40, left: 40, containLabel: true },
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: { interval: 1, rotate: 45, fontSize: 10, color: '#9CA3AF' }
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#9CA3AF' },
      splitLine: { lineStyle: { color: '#1F2937' } }
    },
    series: [{
      name: 'Amostras',
      type: 'bar',
      data: counts,
      itemStyle: {
        color: (params) => params.dataIndex === 0 ? '#10B981' : '#3B82F6',
        borderRadius: [4, 4, 0, 0]
      }
    }]
  };

  STATE.charts.faultDist.setOption(option);
}

// Chart: Fold Distribution Doughnut Chart
function renderFoldDistributionChart(folds) {
  const chartDom = document.getElementById('chart-fold-distribution');
  if (!STATE.charts.foldDist) {
    STATE.charts.foldDist = echarts.init(chartDom, 'dark');
  }

  const data = Object.entries(folds).map(([fold, count]) => ({
    name: fold,
    value: count
  }));

  const option = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', formatter: '{b}: {c} amostras ({d}%)' },
    legend: { bottom: 10, textStyle: { color: '#9CA3AF' } },
    series: [{
      name: 'Folds',
      type: 'pie',
      radius: ['45%', '70%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 6, borderColor: '#151D2E', borderWidth: 2 },
      label: { show: true, formatter: '{b}\n({c})', color: '#9CA3AF', fontSize: 11 },
      data: data
    }]
  };

  STATE.charts.foldDist.setOption(option);
}

// Load Time Series Data
async function loadTimeSeriesData() {
  try {
    const varIds = STATE.selectedVariables.join(',');
    const res = await fetch(`/api/signals?mode=${STATE.currentMode}&sample_idx=${STATE.currentSampleIndex}&variable_ids=${varIds}`);
    const data = await res.json();

    document.getElementById('ts-sample-tag').textContent = `Amostra #${data.sampleIndex}`;
    document.getElementById('ts-fault-tag').textContent = `${data.faultInfo.name} (Classe ${data.label})`;

    renderTimeSeriesChart(data);
    loadComparisonChart();
  } catch (err) {
    console.error("Erro ao carregar séries temporais:", err);
  }
}

// Chart: Time Series Multi-line
function renderTimeSeriesChart(data) {
  const chartDom = document.getElementById('chart-timeseries');
  if (!STATE.charts.timeseries) {
    STATE.charts.timeseries = echarts.init(chartDom, 'dark');
  }

  const series = [];
  const legendNames = [];

  Object.entries(data.series).forEach(([vid, values], idx) => {
    const vMeta = STATE.variables[parseInt(vid)] || { tag: `Var ${vid}`, name: '', unit: '' };
    const name = `${vMeta.tag} - ${vMeta.name}`;
    legendNames.push(name);

    series.push({
      name: name,
      type: 'line',
      smooth: true,
      showSymbol: false,
      lineStyle: { width: 2 },
      data: values
    });
  });

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1F2937',
      borderColor: '#374151',
      textStyle: { color: '#F3F4F6' }
    },
    legend: {
      type: 'scroll',
      top: 0,
      textStyle: { color: '#9CA3AF' }
    },
    grid: { top: 60, right: 30, bottom: 65, left: 50, containLabel: true },
    toolbox: {
      feature: {
        dataZoom: { yAxisIndex: 'none' },
        restore: {},
        saveAsImage: {}
      },
      iconStyle: { borderColor: '#9CA3AF' },
      right: 20
    },
    dataZoom: [
      { type: 'inside', start: 0, end: 100 },
      { type: 'slider', start: 0, end: 100, bottom: 10, textStyle: { color: '#9CA3AF' } }
    ],
    xAxis: {
      type: 'category',
      data: data.timeSteps,
      name: 'Tempo (Passos)',
      axisLabel: { color: '#9CA3AF' },
      nameTextStyle: { color: '#9CA3AF' }
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLabel: { color: '#9CA3AF' },
      splitLine: { lineStyle: { color: '#1F2937' } }
    },
    series: series
  };

  STATE.charts.timeseries.setOption(option, true);
}

// Comparison Chart (Selected Sample vs Normal Reference Sample 0)
async function loadComparisonChart() {
  const varId = parseInt(document.getElementById('compare-var-select').value) || 6;
  const sampleA = 0; // Normal reference
  const sampleB = STATE.currentSampleIndex;

  try {
    const res = await fetch(`/api/compare?mode=${STATE.currentMode}&sample_a=${sampleA}&sample_b=${sampleB}&variable_id=${varId}`);
    const data = await res.json();

    const chartDom = document.getElementById('chart-comparison');
    if (!STATE.charts.comparison) {
      STATE.charts.comparison = echarts.init(chartDom, 'dark');
    }

    const option = {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      legend: {
        data: [
          `Referência Normal (#${data.sampleA.index})`,
          `Amostra #${data.sampleB.index} - ${data.sampleB.faultInfo.name}`
        ],
        textStyle: { color: '#9CA3AF' }
      },
      grid: { top: 40, right: 30, bottom: 30, left: 50, containLabel: true },
      xAxis: { type: 'category', data: data.timeSteps, axisLabel: { color: '#9CA3AF' } },
      yAxis: {
        type: 'value',
        name: `${data.variable.tag} (${data.variable.unit})`,
        scale: true,
        axisLabel: { color: '#9CA3AF' },
        splitLine: { lineStyle: { color: '#1F2937' } }
      },
      series: [
        {
          name: `Referência Normal (#${data.sampleA.index})`,
          type: 'line',
          data: data.sampleA.data,
          itemStyle: { color: '#10B981' },
          lineStyle: { width: 2, type: 'dashed' },
          showSymbol: false
        },
        {
          name: `Amostra #${data.sampleB.index} - ${data.sampleB.faultInfo.name}`,
          type: 'line',
          data: data.sampleB.data,
          itemStyle: { color: '#EF4444' },
          lineStyle: { width: 2 },
          showSymbol: false
        }
      ]
    };

    STATE.charts.comparison.setOption(option, true);
  } catch (err) {
    console.error("Erro ao carregar gráfico comparativo:", err);
  }
}

// Load PCA 2D Data
async function loadPcaData() {
  try {
    const res = await fetch(`/api/pca?mode=${STATE.currentMode}&subsample=800`);
    const data = await res.json();

    document.getElementById('pca-variance-text').textContent = `PC1: ${data.explainedVariance[0]}% | PC2: ${data.explainedVariance[1]}%`;

    renderPcaChart(data);
    renderPcaLegend(data.points);
  } catch (err) {
    console.error("Erro ao carregar PCA:", err);
  }
}

// Chart: PCA Scatter Plot
function renderPcaChart(data) {
  const chartDom = document.getElementById('chart-pca');
  if (!STATE.charts.pca) {
    STATE.charts.pca = echarts.init(chartDom, 'dark');
  }

  // Group by Fault Type / Category for color coding
  const groupedSeries = {};

  data.points.forEach(pt => {
    const group = pt.label === 0 ? 'Operação Normal' : pt.type;
    if (!groupedSeries[group]) {
      groupedSeries[group] = [];
    }
    groupedSeries[group].push([pt.x, pt.y, pt.sampleIndex, pt.label, pt.faultName]);
  });

  const series = Object.entries(groupedSeries).map(([name, points], idx) => {
    const isNormal = name === 'Operação Normal';
    return {
      name: name,
      type: 'scatter',
      symbolSize: isNormal ? 10 : 7,
      data: points,
      itemStyle: {
        color: isNormal ? '#10B981' : PALETTE[(idx + 1) % PALETTE.length],
        opacity: isNormal ? 0.9 : 0.7
      }
    };
  });

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      formatter: (params) => {
        const [x, y, sIdx, label, faultName] = params.data;
        return `
          <strong>Amostra #${sIdx}</strong><br/>
          Classe: ${label} (${faultName})<br/>
          PC1: ${x} | PC2: ${y}
        `;
      }
    },
    legend: {
      type: 'scroll',
      top: 0,
      textStyle: { color: '#9CA3AF' }
    },
    grid: { top: 50, right: 30, bottom: 40, left: 50, containLabel: true },
    xAxis: {
      type: 'value',
      name: 'Componente Principal 1 (PC1)',
      axisLabel: { color: '#9CA3AF' },
      splitLine: { lineStyle: { color: '#1F2937' } }
    },
    yAxis: {
      type: 'value',
      name: 'Componente Principal 2 (PC2)',
      axisLabel: { color: '#9CA3AF' },
      splitLine: { lineStyle: { color: '#1F2937' } }
    },
    series: series
  };

  STATE.charts.pca.setOption(option, true);
}

function renderPcaLegend(points) {
  const legendDom = document.getElementById('pca-legend-list');
  legendDom.innerHTML = '';
  const seen = new Set();

  points.forEach(pt => {
    if (!seen.has(pt.label)) {
      seen.add(pt.label);
      const item = document.createElement('div');
      item.className = 'pca-legend-item';
      const color = pt.label === 0 ? '#10B981' : PALETTE[pt.label % PALETTE.length];
      item.innerHTML = `
        <span class="pca-color-dot" style="background-color: ${color}"></span>
        <span>[${pt.label}] ${pt.faultName}</span>
      `;
      legendDom.appendChild(item);
    }
  });
}

// Load Correlation Heatmap
async function loadCorrelationData() {
  const label = parseInt(document.getElementById('corr-label-select').value) || 0;
  try {
    const res = await fetch(`/api/correlation?mode=${STATE.currentMode}&label=${label}`);
    const data = await res.json();

    const chartDom = document.getElementById('chart-correlation');
    if (!STATE.charts.correlation) {
      STATE.charts.correlation = echarts.init(chartDom, 'dark');
    }

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        position: 'top',
        formatter: (params) => {
          const varX = data.variables[params.value[0]];
          const varY = data.variables[params.value[1]];
          return `${varX} &harr; ${varY}<br/><strong>Correlação: ${params.value[2]}</strong>`;
        }
      },
      grid: { top: 20, right: 80, bottom: 60, left: 60, containLabel: true },
      xAxis: {
        type: 'category',
        data: data.variables,
        axisLabel: { interval: 0, rotate: 90, fontSize: 9, color: '#9CA3AF' }
      },
      yAxis: {
        type: 'category',
        data: data.variables,
        axisLabel: { interval: 0, fontSize: 9, color: '#9CA3AF' }
      },
      visualMap: {
        min: -1,
        max: 1,
        calculable: true,
        orient: 'vertical',
        right: '10',
        top: 'center',
        inRange: {
          color: ['#3B82F6', '#111827', '#EF4444']
        },
        textStyle: { color: '#9CA3AF' }
      },
      series: [{
        name: 'Correlação',
        type: 'heatmap',
        data: data.heatmapData,
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' }
        }
      }]
    };

    STATE.charts.correlation.setOption(option, true);
  } catch (err) {
    console.error("Erro ao carregar correlação:", err);
  }
}

// Simulator Functions
async function initSimulator() {
  try {
    // Load current sample series
    const res = await fetch(`/api/signals?mode=${STATE.currentMode}&sample_idx=${STATE.currentSampleIndex}&variable_ids=6,8,11,31`);
    STATE.simData = await res.json();

    const chartDom = document.getElementById('chart-sim-live');
    if (!STATE.charts.simLive) {
      STATE.charts.simLive = echarts.init(chartDom, 'dark');
    }

    updateSimulatorFrame(0);
  } catch (err) {
    console.error("Erro ao iniciar simulador:", err);
  }
}

function updateSimulatorFrame(step) {
  if (!STATE.simData) return;
  STATE.simStep = step;

  document.getElementById('sim-current-step').textContent = `${step} / 600`;
  document.getElementById('sim-progress-fill').style.width = `${(step / 600) * 100}%`;

  const pReac = STATE.simData.series[6] ? STATE.simData.series[6][step] : 0;
  const tReac = STATE.simData.series[8] ? STATE.simData.series[8][step] : 0;
  const lSep = STATE.simData.series[11] ? STATE.simData.series[11][step] : 0;
  const vCool = STATE.simData.series[31] ? STATE.simData.series[31][step] : 0;

  document.getElementById('gauge-reactor-p').textContent = pReac.toFixed(1);
  document.getElementById('gauge-reactor-t').textContent = tReac.toFixed(1);
  document.getElementById('gauge-sep-level').textContent = lSep.toFixed(1);
  document.getElementById('gauge-cool-vlv').textContent = vCool.toFixed(1);

  document.getElementById('fill-reactor-p').style.width = `${Math.min(100, (pReac / 3000) * 100)}%`;
  document.getElementById('fill-reactor-t').style.width = `${Math.min(100, (tReac / 150) * 100)}%`;
  document.getElementById('fill-sep-level').style.width = `${Math.min(100, lSep)}%`;
  document.getElementById('fill-cool-vlv').style.width = `${Math.min(100, vCool)}%`;

  // Plot slice up to current step
  const timeSlice = STATE.simData.timeSteps.slice(0, step + 1);
  const option = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    legend: {
      data: ['Pressão Reator (XMEAS 7)', 'Temp Reator (XMEAS 9)', 'Nível Separador (XMEAS 12)'],
      textStyle: { color: '#9CA3AF' }
    },
    grid: { top: 40, right: 30, bottom: 30, left: 50, containLabel: true },
    xAxis: { type: 'category', data: timeSlice, axisLabel: { color: '#9CA3AF' } },
    yAxis: { type: 'value', scale: true, axisLabel: { color: '#9CA3AF' }, splitLine: { lineStyle: { color: '#1F2937' } } },
    series: [
      { name: 'Pressão Reator (XMEAS 7)', type: 'line', data: STATE.simData.series[6].slice(0, step + 1), showSymbol: false, itemStyle: { color: '#3B82F6' } },
      { name: 'Temp Reator (XMEAS 9)', type: 'line', data: STATE.simData.series[8].slice(0, step + 1), showSymbol: false, itemStyle: { color: '#EF4444' } },
      { name: 'Nível Separador (XMEAS 12)', type: 'line', data: STATE.simData.series[11].slice(0, step + 1), showSymbol: false, itemStyle: { color: '#10B981' } }
    ]
  };

  STATE.charts.simLive.setOption(option);
}

function toggleSimulatorPlayback() {
  const btn = document.getElementById('sim-play-btn');
  if (STATE.simInterval) {
    clearInterval(STATE.simInterval);
    STATE.simInterval = null;
    btn.innerHTML = '<i data-lucide="play"></i> Iniciar Playback';
    lucide.createIcons();
  } else {
    btn.innerHTML = '<i data-lucide="pause"></i> Pausar Playback';
    lucide.createIcons();
    const speed = parseInt(document.getElementById('sim-speed-select').value) || 20;

    STATE.simInterval = setInterval(() => {
      if (STATE.simStep >= 599) {
        clearInterval(STATE.simInterval);
        STATE.simInterval = null;
        btn.innerHTML = '<i data-lucide="play"></i> Iniciar Playback';
        lucide.createIcons();
      } else {
        updateSimulatorFrame(STATE.simStep + 1);
      }
    }, speed);
  }
}

function resetSimulator() {
  if (STATE.simInterval) {
    clearInterval(STATE.simInterval);
    STATE.simInterval = null;
    document.getElementById('sim-play-btn').innerHTML = '<i data-lucide="play"></i> Iniciar Playback';
    lucide.createIcons();
  }
  updateSimulatorFrame(0);
}
