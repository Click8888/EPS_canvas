const CONFIG_TYPE = 'eps-canvas-config';
const CONFIG_VERSION = 1;

const stripLineData = (line) => {
  const { data, ...config } = line;
  return config;
};


const serializeNode = (node) => {
  const {
    lines,
    updateConfig,
    initialData,      // тяжёлые данные — не сохраняем
    updateTimestamp,  // транзиентная метка — не сохраняем
    ...restData
  } = node.data || {};

  const out = {
    id: node.id,
    type: node.type,
    position: node.position,
    data: { ...restData }
  };

  if (node.dragHandle) out.dragHandle = node.dragHandle;
  if (Array.isArray(lines)) out.data.lines = lines.map(stripLineData);
  if (updateConfig) out.data.updateConfig = { ...updateConfig, isAutoUpdate: false };

  return out;
};

// Собирает объект конфигурации полотна из текущего состояния React Flow
export const serializeCanvas = (nodes, edges, nodeCounter) => ({
  type: CONFIG_TYPE,
  version: CONFIG_VERSION,
  savedAt: new Date().toISOString(),
  nodeCounter,
  nodes: (nodes || []).map(serializeNode),
  edges: edges || []
});

// Имя файла по умолчанию: eps-canvas-YYYYMMDD-HHmmss.json
const defaultFilename = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  return `eps-canvas-${stamp}.json`;
};

// Скачивает конфигурацию как .json-файл.
export const downloadConfig = (config, filename) => {
  const json = JSON.stringify(config, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || defaultFilename();
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Проверяет, что объект — валидная конфигурация полотна. Бросает Error с понятным текстом.
export const validateConfig = (config) => {
  if (!config || typeof config !== 'object') {
    throw new Error('Файл не является конфигурацией полотна');
  }
  if (config.type !== CONFIG_TYPE) {
    throw new Error('Неверный формат файла: это не конфигурация рабочего полотна EPS');
  }
  if (!Array.isArray(config.nodes)) {
    throw new Error('Повреждённый файл: отсутствует список узлов');
  }
  return config;
};

// Читает выбранный файл, парсит JSON и валидирует. Возвращает Promise<config>.
export const parseConfigFile = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        resolve(validateConfig(parsed));
      } catch (err) {
        reject(new Error(`Не удалось прочитать конфигурацию: ${err.message}`));
      }
    };
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.readAsText(file);
  });

// Восстанавливает узлы/связи и счётчик id из конфигурации.
// Гарантирует пустые lines[].data — точки будут дозагружены отдельно.
export const deserializeCanvas = (config) => {
  const nodes = (config.nodes || []).map((node) => {
    const data = { ...(node.data || {}) };
    if (Array.isArray(data.lines)) {
      data.lines = data.lines.map((line) => ({ ...line, data: [] }));
    }
    return { ...node, data };
  });

  // nodeCounter из файла, иначе — максимум числовых id + 1 (чтобы новые узлы не конфликтовали).
  let nodeCounter = Number(config.nodeCounter);
  if (!Number.isFinite(nodeCounter) || nodeCounter < 1) {
    const maxId = nodes.reduce((max, n) => {
      const num = parseInt(n.id, 10);
      return Number.isFinite(num) && num > max ? num : max;
    }, 0);
    nodeCounter = maxId + 1;
  }

  return {
    nodes,
    edges: config.edges || [],
    nodeCounter
  };
};
