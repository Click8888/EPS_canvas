
const API_BASE_URL = 'http://localhost:8080/api';

// Преобразует значение оси X к числу секунд (epoch или wall-clock в секундах).
// Поддерживает Date, ISO-строку с датой, строку времени 'HH:MM:SS[.mmm]' и число.
const parseXValueToSeconds = (xValue) => {
  if (xValue instanceof Date) {
    return xValue.getTime() / 1000;
  }
  if (typeof xValue === 'string') {
    const fullDateMatch = xValue.match(/\d{4}-\d{2}-\d{2}/);
    if (fullDateMatch) {
      const date = new Date(xValue);
      if (!isNaN(date.getTime())) {
        return date.getTime() / 1000;
      }
      return parseFloat(xValue) || 0;
    }
    const timeMatch = xValue.match(/^(\d{1,2}):(\d{1,2}):(\d{1,2})(?:\.(\d+))?$/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1]) || 0;
      const minutes = parseInt(timeMatch[2]) || 0;
      const seconds = parseInt(timeMatch[3]) || 0;
      let milliseconds = 0;
      if (timeMatch[4]) {
        const msString = timeMatch[4].padEnd(3, '0').substring(0, 3);
        milliseconds = parseInt(msString, 10);
      }
      return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
    }
    return parseFloat(xValue) || 0;
  }
  return parseFloat(xValue) || 0;
};

// Загрузить данные для конкретной линии линейного графика.
export const loadLineData = async (line) => {
  if (!line.table || !line.xAxis || !line.yAxis) {
    return null;
  }

  try {
    const sql = `SELECT * FROM ${line.table} ORDER BY 1 DESC LIMIT 200`;

    const response = await fetch(`${API_BASE_URL}/execute-query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql })
    });

    if (!response.ok) throw new Error('Ошибка загрузки данных');

    const result = await response.json();
    const data = result.data || result;

    const formattedData = data
      .filter(row => row[line.xAxis] != null && row[line.yAxis] != null)
      .map((row) => {
        const yValue = parseFloat(row[line.yAxis]);
        const xValue = row[line.xAxis];
        return {
          time: parseXValueToSeconds(xValue),
          value: isNaN(yValue) ? 0 : yValue,
          originalTime: xValue,
          originalValue: row[line.yAxis],
          seriesId: line.id,
          timestamp: Date.now()
        };
      });

    formattedData.sort((a, b) => a.time - b.time);

    return formattedData;
  } catch (err) {
    console.error(`Ошибка загрузки данных для линии ${line.id}:`, err);
    return null;
  }
};

// Загрузить данные для линии радиального графика (угол + длина).
export const loadRadialLineData = async (line) => {
  if (!line.table || !line.angleAxis || !line.magnitudeAxis) {
    return null;
  }

  try {
    const sql = `SELECT * FROM ${line.table} ORDER BY 1 DESC LIMIT 200`;

    const response = await fetch(`${API_BASE_URL}/execute-query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql })
    });

    if (!response.ok) throw new Error('Ошибка загрузки данных');

    const result = await response.json();
    const data = result.data || result;

    const formattedData = data
      .filter(row => row[line.angleAxis] != null && row[line.magnitudeAxis] != null)
      .map((row) => {
        const angleValue = parseFloat(row[line.angleAxis]);
        const magnitudeValue = parseFloat(row[line.magnitudeAxis]);
        return {
          angle: isNaN(angleValue) ? 0 : angleValue,
          value: isNaN(magnitudeValue) ? 0 : magnitudeValue,
          originalAngle: row[line.angleAxis],
          originalMagnitude: row[line.magnitudeAxis],
          seriesId: line.id,
          timestamp: Date.now()
        };
      });

    return formattedData;
  } catch (err) {
    console.error(`Ошибка загрузки данных для радиальной линии ${line.id}:`, err);
    return null;
  }
};

// Дозагрузить данные всех линий узла-графика (по его типу) и вернуть массив линий
// с заполненным полем data. Используется при импорте конфигурации полотна.
export const reloadLinesData = async (node) => {
  const lines = node?.data?.lines;
  if (!Array.isArray(lines) || lines.length === 0) return [];

  const isRadial = node.type === 'radialChartNode';
  const loadPromises = lines.map(line =>
    isRadial ? loadRadialLineData(line) : loadLineData(line)
  );
  const allData = await Promise.all(loadPromises);

  return lines.map((line, index) => ({
    ...line,
    data: allData[index] || []
  }));
};
