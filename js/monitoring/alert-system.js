import { Logger } from '../utils/logger.js';
import { ProductionConfig } from '../config/production-config.js';

export class RealTimeAlertSystem {
    constructor({ database, api, tradingEngine, wallet, marketAnalyzer }) {
        this.database = database;
        this.api = api;
        this.tradingEngine = tradingEngine;
        this.wallet = wallet;
        this.marketAnalyzer = marketAnalyzer;
        this.logger = new Logger('RealTimeAlertSystem');
        
        this.alertRules = new Map();
        this.activeAlerts = new Map();
        this.alertHistory = [];
        
        this.checkInterval = ProductionConfig.ALERT_SYSTEM.CHECK_INTERVAL || 5000; // 5 seconds
        this.maxActiveAlerts = ProductionConfig.ALERT_SYSTEM.MAX_ACTIVE || 50;
        this.alertRetentionTime = ProductionConfig.ALERT_SYSTEM.RETENTION_TIME || 24 * 60 * 60 * 1000; // 24 hours
        
        this.isRunning = false;
        this.monitoringInterval = null;
        
        this.eventListeners = new Map();
        this.notificationQueue = [];
    }

    async initialize() {
        try {
            this.logger.info('Initializing Real-time Alert System...');
            
            // Load saved alert rules
            await this.loadAlertRules();
            
            // Set up default alert rules
            this.createDefaultAlertRules();
            
            // Start monitoring
            await this.startMonitoring();
            
            // Set up event listeners
            this.setupEventListeners();
            
            this.logger.info('Real-time Alert System initialized successfully');
            
        } catch (error) {
            this.logger.error('Failed to initialize Alert System:', error);
            throw error;
        }
    }

    async loadAlertRules() {
        try {
            const savedRules = await this.database.getAlertRules();
            savedRules.forEach(rule => {
                this.alertRules.set(rule.id, rule);
            });
            this.logger.info(`Loaded ${savedRules.length} alert rules`);
        } catch (error) {
            this.logger.warn('Failed to load alert rules, using defaults:', error);
        }
    }

    createDefaultAlertRules() {
        // Price movement alerts
        this.addAlertRule({
            id: 'price_spike_up',
            name: 'Price Spike Up',
            description: 'Alert when market price increases rapidly',
            type: 'price_movement',
            condition: {
                metric: 'price_change_5min',
                operator: '>',
                threshold: 0.05, // 5% increase in 5 minutes
                asset: 'ALL'
            },
            priority: 'high',
            enabled: true,
            cooldown: 300000, // 5 minutes
            actions: ['notify', 'log']
        });

        this.addAlertRule({
            id: 'price_spike_down',
            name: 'Price Spike Down', 
            description: 'Alert when market price decreases rapidly',
            type: 'price_movement',
            condition: {
                metric: 'price_change_5min',
                operator: '<',
                threshold: -0.05, // 5% decrease in 5 minutes
                asset: 'ALL'
            },
            priority: 'high',
            enabled: true,
            cooldown: 300000,
            actions: ['notify', 'log']
        });

        // Volume alerts
        this.addAlertRule({
            id: 'volume_surge',
            name: 'Volume Surge',
            description: 'Alert when trading volume increases significantly',
            type: 'volume',
            condition: {
                metric: 'volume_change_1h',
                operator: '>',
                threshold: 3.0, // 3x normal volume
                asset: 'ALL'
            },
            priority: 'medium',
            enabled: true,
            cooldown: 600000, // 10 minutes
            actions: ['notify', 'log']
        });

        // Opportunity alerts
        this.addAlertRule({
            id: 'high_opportunity',
            name: 'High Opportunity Market',
            description: 'Alert when market analyzer finds high-score opportunities',
            type: 'opportunity',
            condition: {
                metric: 'opportunity_score',
                operator: '>=',
                threshold: 80,
                asset: 'ALL'
            },
            priority: 'high',
            enabled: true,
            cooldown: 900000, // 15 minutes
            actions: ['notify', 'log', 'auto_analyze']
        });

        // P&L alerts
        this.addAlertRule({
            id: 'loss_threshold',
            name: 'Loss Threshold',
            description: 'Alert when unrealized P&L drops below threshold',
            type: 'pnl',
            condition: {
                metric: 'unrealized_pnl',
                operator: '<',
                threshold: -500, // $500 loss
                asset: 'ALL'
            },
            priority: 'critical',
            enabled: true,
            cooldown: 600000,
            actions: ['notify', 'log', 'risk_warning']
        });

        // Market event alerts
        this.addAlertRule({
            id: 'market_closing',
            name: 'Market Closing Soon',
            description: 'Alert when markets are closing within 30 minutes',
            type: 'time_based',
            condition: {
                metric: 'time_to_close',
                operator: '<',
                threshold: 30 * 60 * 1000, // 30 minutes
                asset: 'ALL'
            },
            priority: 'medium',
            enabled: true,
            cooldown: 600000,
            actions: ['notify', 'log']
        });

        this.logger.info('Default alert rules created');
    }

    addAlertRule(rule) {
        // Validate rule
        if (!this.validateAlertRule(rule)) {
            throw new Error('Invalid alert rule');
        }

        // Add timestamps
        rule.createdAt = Date.now();
        rule.lastTriggered = 0;
        rule.triggerCount = 0;

        this.alertRules.set(rule.id, rule);
        
        // Save to database
        this.database.saveAlertRule(rule).catch(error => {
            this.logger.error('Failed to save alert rule:', error);
        });

        this.logger.info(`Added alert rule: ${rule.name}`);
        return rule.id;
    }

    validateAlertRule(rule) {
        const required = ['id', 'name', 'type', 'condition', 'priority'];
        return required.every(field => rule[field] !== undefined);
    }

    async startMonitoring() {
        if (this.isRunning) return;

        this.isRunning = true;
        this.monitoringInterval = setInterval(() => {
            this.runAlertChecks().catch(error => {
                this.logger.error('Alert monitoring error:', error);
            });
        }, this.checkInterval);

        this.logger.info('Alert monitoring started');
    }

    async stopMonitoring() {
        this.isRunning = false;
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        this.logger.info('Alert monitoring stopped');
    }

    async runAlertChecks() {
        try {
            // Get current market data
            const markets = await this.api.fetchRealCryptoMarkets();
            const positions = this.tradingEngine?.getPositions() || [];
            
            // Check each alert rule
            for (const [ruleId, rule] of this.alertRules) {
                if (!rule.enabled) continue;
                
                // Check cooldown
                if (this.isOnCooldown(rule)) continue;
                
                try {
                    const shouldTrigger = await this.evaluateAlertCondition(rule, markets, positions);
                    
                    if (shouldTrigger) {
                        await this.triggerAlert(rule, markets, positions);
                    }
                } catch (error) {
                    this.logger.error(`Error evaluating alert rule ${ruleId}:`, error);
                }
            }
            
            // Clean up old alerts
            this.cleanupOldAlerts();
            
        } catch (error) {
            this.logger.error('Error running alert checks:', error);
        }
    }

    async evaluateAlertCondition(rule, markets, positions) {
        const { condition } = rule;
        
        switch (rule.type) {
            case 'price_movement':
                return this.checkPriceMovementCondition(condition, markets);
                
            case 'volume':
                return this.checkVolumeCondition(condition, markets);
                
            case 'opportunity':
                return this.checkOpportunityCondition(condition, markets);
                
            case 'pnl':
                return this.checkPnLCondition(condition, positions);
                
            case 'time_based':
                return this.checkTimeBasedCondition(condition, markets);
                
            default:
                this.logger.warn(`Unknown alert type: ${rule.type}`);
                return false;
        }
    }

    async checkPriceMovementCondition(condition, markets) {
        const relevantMarkets = condition.asset === 'ALL' ? markets : 
            markets.filter(m => m.asset === condition.asset);
        
        for (const market of relevantMarkets) {
            // Get recent price history
            const priceHistory = await this.getPriceHistory(market.id, 5); // 5 minutes
            if (priceHistory.length < 2) continue;
            
            const currentPrice = priceHistory[priceHistory.length - 1].price;
            const previousPrice = priceHistory[0].price;
            const priceChange = (currentPrice - previousPrice) / previousPrice;
            
            if (this.compareValues(priceChange, condition.operator, condition.threshold)) {
                return { market, priceChange, currentPrice, previousPrice };
            }
        }
        
        return false;
    }

    async checkVolumeCondition(condition, markets) {
        const relevantMarkets = condition.asset === 'ALL' ? markets : 
            markets.filter(m => m.asset === condition.asset);
        
        for (const market of relevantMarkets) {
            const currentVolume = market.volume;
            const historicalVolume = await this.getAverageVolume(market.id, 24); // 24 hours
            
            if (historicalVolume === 0) continue;
            
            const volumeRatio = currentVolume / historicalVolume;
            
            if (this.compareValues(volumeRatio, condition.operator, condition.threshold)) {
                return { market, volumeRatio, currentVolume, historicalVolume };
            }
        }
        
        return false;
    }

    async checkOpportunityCondition(condition, markets) {
        if (!this.marketAnalyzer) return false;
        
        const relevantMarkets = condition.asset === 'ALL' ? markets : 
            markets.filter(m => m.asset === condition.asset);
        
        for (const market of relevantMarkets) {
            try {
                const score = await this.marketAnalyzer.scoreMarket(market);
                
                if (this.compareValues(score.total, condition.operator, condition.threshold)) {
                    return { market, opportunityScore: score.total, factors: score.breakdown };
                }
            } catch (error) {
                this.logger.debug(`Failed to score market ${market.id}:`, error);
            }
        }
        
        return false;
    }

    checkPnLCondition(condition, positions) {
        let totalUnrealizedPnL = 0;
        const relevantPositions = condition.asset === 'ALL' ? positions :
            positions.filter(p => p.marketId.includes(condition.asset));
        
        totalUnrealizedPnL = relevantPositions.reduce((sum, pos) => sum + pos.unrealizedPnL, 0);
        
        if (this.compareValues(totalUnrealizedPnL, condition.operator, condition.threshold)) {
            return { positions: relevantPositions, totalUnrealizedPnL };
        }
        
        return false;
    }

    checkTimeBasedCondition(condition, markets) {
        const now = Date.now();
        const relevantMarkets = condition.asset === 'ALL' ? markets :
            markets.filter(m => m.asset === condition.asset);
        
        for (const market of relevantMarkets) {
            const timeToClose = market.endTime - now;
            
            if (this.compareValues(timeToClose, condition.operator, condition.threshold)) {
                return { market, timeToClose };
            }
        }
        
        return false;
    }

    compareValues(value, operator, threshold) {
        switch (operator) {
            case '>': return value > threshold;
            case '>=': return value >= threshold;
            case '<': return value < threshold;
            case '<=': return value <= threshold;
            case '==': return value == threshold;
            case '!=': return value != threshold;
            default: return false;
        }
    }

    async triggerAlert(rule, markets, positions) {
        const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const alert = {
            id: alertId,
            ruleId: rule.id,
            ruleName: rule.name,
            type: rule.type,
            priority: rule.priority,
            message: this.generateAlertMessage(rule, markets, positions),
            timestamp: Date.now(),
            acknowledged: false,
            data: {
                markets: markets?.slice(0, 5), // Limit data size
                positions: positions?.slice(0, 10)
            }
        };
        
        // Add to active alerts
        this.activeAlerts.set(alertId, alert);
        
        // Add to history
        this.alertHistory.push(alert);
        
        // Update rule stats
        rule.lastTriggered = Date.now();
        rule.triggerCount++;
        
        // Execute actions
        await this.executeAlertActions(rule, alert);
        
        // Emit alert event
        this.emitAlert(alert);
        
        this.logger.info(`Alert triggered: ${rule.name} (${alertId})`);
        
        return alert;
    }

    generateAlertMessage(rule, markets, positions) {
        switch (rule.type) {
            case 'price_movement':
                return `${rule.name}: Market price changed significantly`;
                
            case 'volume':
                return `${rule.name}: Unusual trading volume detected`;
                
            case 'opportunity':
                return `${rule.name}: High-value trading opportunity identified`;
                
            case 'pnl':
                return `${rule.name}: Portfolio P&L threshold reached`;
                
            case 'time_based':
                return `${rule.name}: Time-based condition triggered`;
                
            default:
                return `${rule.name}: Alert condition met`;
        }
    }

    async executeAlertActions(rule, alert) {
        for (const action of rule.actions || []) {
            try {
                switch (action) {
                    case 'notify':
                        await this.sendNotification(alert);
                        break;
                        
                    case 'log':
                        this.logger.warn(`ALERT: ${alert.message}`, alert);
                        break;
                        
                    case 'auto_analyze':
                        await this.performAutoAnalysis(alert);
                        break;
                        
                    case 'risk_warning':
                        await this.sendRiskWarning(alert);
                        break;
                        
                    default:
                        this.logger.warn(`Unknown alert action: ${action}`);
                }
            } catch (error) {
                this.logger.error(`Failed to execute alert action ${action}:`, error);
            }
        }
    }

    async sendNotification(alert) {
        // Browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`Trading Alert: ${alert.ruleName}`, {
                body: alert.message,
                icon: '/favicon.ico',
                badge: '/badge.ico',
                tag: alert.ruleId,
                requireInteraction: alert.priority === 'critical'
            });
        }
        
        // UI notification
        this.addToNotificationQueue({
            id: alert.id,
            title: alert.ruleName,
            message: alert.message,
            priority: alert.priority,
            timestamp: alert.timestamp,
            actions: this.getNotificationActions(alert)
        });
    }

    addToNotificationQueue(notification) {
        this.notificationQueue.push(notification);
        
        // Limit queue size
        if (this.notificationQueue.length > this.maxActiveAlerts) {
            this.notificationQueue.shift();
        }
        
        // Emit notification event for UI
        document.dispatchEvent(new CustomEvent('newNotification', {
            detail: notification
        }));
    }

    getNotificationActions(alert) {
        const actions = [
            { label: 'Dismiss', action: `dismissAlert('${alert.id}')` },
            { label: 'View Details', action: `viewAlertDetails('${alert.id}')` }
        ];
        
        if (alert.type === 'opportunity') {
            actions.push({ label: 'Analyze', action: `analyzeOpportunity('${alert.id}')` });
        }
        
        if (alert.type === 'pnl' && alert.priority === 'critical') {
            actions.push({ label: 'Review Positions', action: `reviewPositions('${alert.id}')` });
        }
        
        return actions;
    }

    async performAutoAnalysis(alert) {
        if (!this.marketAnalyzer || !alert.data?.markets) return;
        
        try {
            const analysisResults = [];
            
            for (const market of alert.data.markets.slice(0, 3)) { // Limit analysis
                const analysis = await this.marketAnalyzer.analyzeMarketOpportunities([market]);
                analysisResults.push({
                    marketId: market.id,
                    analysis: analysis[0]
                });
            }
            
            // Store analysis results
            alert.autoAnalysis = {
                timestamp: Date.now(),
                results: analysisResults
            };
            
            this.logger.info(`Auto-analysis completed for alert ${alert.id}`);
            
        } catch (error) {
            this.logger.error('Auto-analysis failed:', error);
        }
    }

    async sendRiskWarning(alert) {
        const riskWarning = {
            id: `risk_${alert.id}`,
            type: 'risk_warning',
            priority: 'critical',
            message: '⚠️ RISK WARNING: Significant losses detected in your portfolio',
            details: alert.data,
            timestamp: alert.timestamp,
            requiresAcknowledgment: true
        };
        
        this.addToNotificationQueue(riskWarning);
    }

    isOnCooldown(rule) {
        if (!rule.cooldown) return false;
        return (Date.now() - rule.lastTriggered) < rule.cooldown;
    }

    cleanupOldAlerts() {
        const cutoff = Date.now() - this.alertRetentionTime;
        
        // Clean active alerts
        for (const [alertId, alert] of this.activeAlerts) {
            if (alert.timestamp < cutoff || alert.acknowledged) {
                this.activeAlerts.delete(alertId);
            }
        }
        
        // Clean alert history
        this.alertHistory = this.alertHistory.filter(alert => 
            alert.timestamp >= cutoff
        );
        
        // Clean notification queue
        this.notificationQueue = this.notificationQueue.filter(notification =>
            notification.timestamp >= cutoff
        );
    }

    // Public API methods
    getActiveAlerts() {
        return Array.from(this.activeAlerts.values())
            .sort((a, b) => b.timestamp - a.timestamp);
    }

    getAlertHistory(limit = 100) {
        return this.alertHistory
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }

    acknowledgeAlert(alertId) {
        const alert = this.activeAlerts.get(alertId);
        if (alert) {
            alert.acknowledged = true;
            alert.acknowledgedAt = Date.now();
            this.logger.info(`Alert acknowledged: ${alertId}`);
        }
    }

    dismissAlert(alertId) {
        this.activeAlerts.delete(alertId);
        
        // Remove from notification queue
        this.notificationQueue = this.notificationQueue.filter(n => n.id !== alertId);
        
        this.logger.info(`Alert dismissed: ${alertId}`);
    }

    updateAlertRule(ruleId, updates) {
        const rule = this.alertRules.get(ruleId);
        if (!rule) {
            throw new Error(`Alert rule not found: ${ruleId}`);
        }
        
        Object.assign(rule, updates);
        rule.updatedAt = Date.now();
        
        // Save to database
        this.database.saveAlertRule(rule).catch(error => {
            this.logger.error('Failed to save updated alert rule:', error);
        });
        
        this.logger.info(`Alert rule updated: ${ruleId}`);
    }

    disableAlertRule(ruleId) {
        this.updateAlertRule(ruleId, { enabled: false });
    }

    enableAlertRule(ruleId) {
        this.updateAlertRule(ruleId, { enabled: true });
    }

    deleteAlertRule(ruleId) {
        this.alertRules.delete(ruleId);
        
        // Remove from database
        this.database.deleteAlertRule(ruleId).catch(error => {
            this.logger.error('Failed to delete alert rule from database:', error);
        });
        
        this.logger.info(`Alert rule deleted: ${ruleId}`);
    }

    // Utility methods
    async getPriceHistory(marketId, minutes) {
        // This would fetch from database or API
        return [];
    }

    async getAverageVolume(marketId, hours) {
        // This would calculate from historical data
        return 1000; // Placeholder
    }

    setupEventListeners() {
        // Listen for market updates
        document.addEventListener('marketUpdate', (event) => {
            // Process real-time market updates
            this.processMarketUpdate(event.detail);
        });
        
        // Listen for position updates
        document.addEventListener('positionUpdate', (event) => {
            // Process position updates
            this.processPositionUpdate(event.detail);
        });
        
        // Request notification permission
        this.requestNotificationPermission();
    }

    async requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            try {
                const permission = await Notification.requestPermission();
                this.logger.info(`Notification permission: ${permission}`);
            } catch (error) {
                this.logger.warn('Failed to request notification permission:', error);
            }
        }
    }

    processMarketUpdate(marketData) {
        // Store market update for price history
        // This would be used by price movement alerts
    }

    processPositionUpdate(positionData) {
        // Process position updates for P&L alerts
    }

    emitAlert(alert) {
        document.dispatchEvent(new CustomEvent('alertTriggered', {
            detail: alert
        }));
    }

    // Statistics and monitoring
    getAlertStatistics() {
        const rules = Array.from(this.alertRules.values());
        const activeAlerts = Array.from(this.activeAlerts.values());
        
        return {
            totalRules: rules.length,
            enabledRules: rules.filter(r => r.enabled).length,
            activeAlerts: activeAlerts.length,
            alertsByPriority: {
                critical: activeAlerts.filter(a => a.priority === 'critical').length,
                high: activeAlerts.filter(a => a.priority === 'high').length,
                medium: activeAlerts.filter(a => a.priority === 'medium').length,
                low: activeAlerts.filter(a => a.priority === 'low').length
            },
            totalTriggers: rules.reduce((sum, r) => sum + r.triggerCount, 0),
            avgTriggersPerRule: rules.length > 0 ? 
                rules.reduce((sum, r) => sum + r.triggerCount, 0) / rules.length : 0,
            notificationQueueSize: this.notificationQueue.length,
            isMonitoring: this.isRunning
        };
    }

    // Cleanup
    destroy() {
        this.stopMonitoring();
        this.alertRules.clear();
        this.activeAlerts.clear();
        this.alertHistory = [];
        this.notificationQueue = [];
        this.eventListeners.clear();
        
        this.logger.info('Alert System destroyed');
    }
}