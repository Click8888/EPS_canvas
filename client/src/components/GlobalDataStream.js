// services/GlobalDataStream.js

class GlobalDataStream {
    constructor() {
        this.subscribers = new Map();
        this.dataCache = new Map();
        this.pollingInterval = null;
        this.isPolling = false;
        this.pollingFrequency = 20;
        this.apiUrl = 'http://localhost:8080/api/batch-query';
        
        this.pendingQueries = new Map();
        this.batchTimeout = null;
        
        this.stats = {
            totalQueries: 0,
            totalBatches: 0,
            avgBatchSize: 0
        };
    }

    subscribe(nodeId, lines, updateInterval, callback) {
        const subscriptionId = `${nodeId}_${Date.now()}_${Math.random()}`;
        
        this.subscribers.set(subscriptionId, {
            nodeId,
            lines: JSON.parse(JSON.stringify(lines)),
            interval: updateInterval,
            callback,
            lastUpdate: 0,
            lastDataHash: null
        });
        
        console.log(`[DataStream] Подписка #${subscriptionId} создана для узла ${nodeId} (интервал: ${updateInterval}ms)`);
        
        this.startGlobalPolling();
        
        return subscriptionId;
    }

    unsubscribe(subscriptionId) {
        const deleted = this.subscribers.delete(subscriptionId);
        if (deleted) {
            console.log(`[DataStream] Отписка #${subscriptionId} удалена`);
        }
        
        if (this.subscribers.size === 0) {
            this.stopGlobalPolling();
        }
    }

    updateSubscriptionInterval(subscriptionId, newInterval) {
        const subscription = this.subscribers.get(subscriptionId);
        if (subscription) {
            subscription.interval = newInterval;
            console.log(`[DataStream] Интервал обновлен для #${subscriptionId}: ${newInterval}ms`);
        }
    }

    startGlobalPolling() {
        if (this.isPolling) return;
        
        this.isPolling = true;
        console.log(`[DataStream] Глобальный опрос запущен (частота: ${this.pollingFrequency}ms)`);
        
        this.pollDatabase();
        
        this.pollingInterval = setInterval(() => {
            this.pollDatabase();
        }, this.pollingFrequency);
    }

    stopGlobalPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        this.isPolling = false;
        console.log('[DataStream] Глобальный опрос остановлен');
    }

    async pollDatabase() {
        if (this.pendingQueries.size > 0) {
            return;
        }
        
        const now = Date.now();
        const activeSubscriptions = [];
        
        for (const [subId, sub] of this.subscribers.entries()) {
            const timeSinceLastUpdate = now - sub.lastUpdate;
            
            if (timeSinceLastUpdate >= sub.interval) {
                activeSubscriptions.push({
                    subId,
                    subscription: sub,
                    timeSinceLastUpdate
                });
            }
        }
        
        if (activeSubscriptions.length === 0) {
            return;
        }
        
        console.log(`[DataStream] Сбор запросов от ${activeSubscriptions.length} подписчиков`);
        
        const allQueries = [];
        const subscriptionMap = new Map();
        
        for (const { subId, subscription } of activeSubscriptions) {
            for (const line of subscription.lines) {
                if (!line.table || !line.xAxis || !line.yAxis) continue;
                
                let sql;
                if (subscription.lastUpdate > 0) {
                    const lastUpdateTime = new Date(subscription.lastUpdate).toISOString();
                    sql = `SELECT * FROM ${line.table} 
                           WHERE ${line.xAxis} > '${lastUpdateTime}' 
                           ORDER BY ${line.xAxis} DESC LIMIT 500`;
                } else {
                    sql = `SELECT * FROM ${line.table} ORDER BY ${line.xAxis} DESC LIMIT 500`;
                }
                
                const queryId = `${subId}_${line.id}_${Date.now()}`;
                allQueries.push({
                    id: queryId,
                    sql: sql,
                    subId: subId,
                    lineId: line.id
                });
                
                subscriptionMap.set(queryId, { subId, lineId: line.id });
            }
        }
        
        if (allQueries.length === 0) return;
        
        await this.sendBatchQuery(allQueries, subscriptionMap, activeSubscriptions);
    }

    async sendBatchQuery(queries, subscriptionMap, activeSubscriptions) {
        const startTime = Date.now();
        
        try {
            const batchRequest = {
                queries: queries.map(q => ({
                    id: q.id,
                    sql: q.sql
                }))
            };
            
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(batchRequest)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            const results = result.results || {};
            
            const endTime = Date.now();
            
            this.stats.totalQueries += queries.length;
            this.stats.totalBatches++;
            this.stats.avgBatchSize = this.stats.totalQueries / this.stats.totalBatches;
            
            console.log(`[DataStream] Batch запрос: ${queries.length} запросов за ${endTime - startTime}ms (средний размер: ${this.stats.avgBatchSize.toFixed(1)})`);
            
            const subscriptionResults = new Map();
            
            for (const query of queries) {
                const { subId, lineId } = subscriptionMap.get(query.id);
                const queryResult = results[query.id];
                
                if (!subscriptionResults.has(subId)) {
                    subscriptionResults.set(subId, {
                        lines: [],
                        timestamp: Date.now()
                    });
                }
                
                const subResult = subscriptionResults.get(subId);
                const subscription = this.subscribers.get(subId);
                const originalLine = subscription?.lines.find(l => l.id === lineId);
                
                if (originalLine && queryResult && !queryResult.error) {
                    const formattedData = this.formatLineData(queryResult, originalLine);
                    
                    subResult.lines.push({
                        ...originalLine,
                        data: formattedData
                    });
                }
            }
            
            for (const { subId, subscription } of activeSubscriptions) {
                const subResult = subscriptionResults.get(subId);
                
                if (subResult) {
                    subscription.lastUpdate = Date.now();
                    
                    const dataHash = JSON.stringify(subResult.lines.map(l => ({
                        id: l.id,
                        dataLength: l.data?.length,
                        lastPoint: l.data?.[l.data?.length - 1]
                    })));
                    
                    if (subscription.lastDataHash !== dataHash) {
                        subscription.lastDataHash = dataHash;
                        subscription.callback(subResult.lines, subResult.timestamp);
                    }
                }
            }
            
        } catch (error) {
            console.error('[DataStream] Ошибка batch запроса:', error);
        }
    }

    formatLineData(dbData, line) {
        if (!dbData || !Array.isArray(dbData)) return [];
        
        const formattedData = dbData
            .filter(row => row[line.xAxis] != null && row[line.yAxis] != null)
            .map((row) => {
                const yValue = parseFloat(row[line.yAxis]);
                const xValue = row[line.xAxis];
                
                let timeValue;
                if (xValue instanceof Date) {
                    timeValue = xValue.getTime() / 1000;
                } else if (typeof xValue === 'string') {
                    const date = new Date(xValue);
                    if (!isNaN(date.getTime())) {
                        timeValue = date.getTime() / 1000;
                    } else {
                        const timeMatch = xValue.match(/(\d{1,2}):(\d{1,2}):(\d{1,2})(?:\.(\d+))?/);
                        if (timeMatch) {
                            const hours = parseInt(timeMatch[1]) || 0;
                            const minutes = parseInt(timeMatch[2]) || 0;
                            const seconds = parseInt(timeMatch[3]) || 0;
                            let milliseconds = 0;
                            if (timeMatch[4]) {
                                const msString = timeMatch[4].padEnd(3, '0').substring(0, 3);
                                milliseconds = parseInt(msString, 10);
                            }
                            timeValue = hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
                        } else {
                            timeValue = parseFloat(xValue) || 0;
                        }
                    }
                } else {
                    timeValue = parseFloat(xValue) || 0;
                }
                
                return {
                    time: timeValue,
                    value: isNaN(yValue) ? 0 : yValue,
                    originalTime: xValue,
                    originalValue: row[line.yAxis],
                    seriesId: line.id,
                    timestamp: Date.now()
                };
            });
        
        formattedData.sort((a, b) => a.time - b.time);
        return formattedData;
    }

    getStats() {
        return {
            ...this.stats,
            activeSubscribers: this.subscribers.size,
            pollingFrequency: this.pollingFrequency,
            isPolling: this.isPolling
        };
    }
}

// ВАЖНО: создаем и экспортируем экземпляр ПРАВИЛЬНО
const globalDataStreamInstance = new GlobalDataStream();
export default globalDataStreamInstance;