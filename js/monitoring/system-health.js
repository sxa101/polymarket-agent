import { Logger } from '../utils/logger.js';
import { ProductionConfig } from '../config/production-config.js';

export class SystemHealthMonitor {
    constructor() {
        this.logger = new Logger('SystemHealthMonitor');
        this.healthChecks = new Map();
        this.healthHistory = [];
        this.maxHistoryEntries = 100;
        
        // Health thresholds
        this.alertThresholds = {
            memoryUsage: 150, // MB
            responseTime: 3000, // ms
            errorRate: 0.05, // 5%
            diskUsage: 100, // MB in IndexedDB
            cpuUsage: 80, // % (if available)
            networkLatency: 5000, // ms
            batteryLevel: 20 // % (if available)
        };
        
        // Monitoring intervals
        this.monitoringIntervals = {
            health: 2 * 60 * 1000,      // 2 minutes
            performance: 30 * 1000,     // 30 seconds
            network: 60 * 1000,         // 1 minute
            storage: 5 * 60 * 1000      // 5 minutes
        };
        
        // Health status
        this.currentHealth = {
            overall: 'unknown',
            system: 'unknown',
            network: 'unknown',
            storage: 'unknown',
            security: 'unknown',
            performance: 'unknown'
        };
        
        // Performance metrics
        this.performanceMetrics = {
            startTime: Date.now(),
            totalRequests: 0,
            totalErrors: 0,
            totalResponseTime: 0,
            memoryPeaks: [],
            networkErrors: []
        };
        
        // Event listeners
        this.eventListeners = new Map();
        
        // Monitoring state
        this.isMonitoring = false;
        this.monitoringStartTime = null;
    }

    async initialize() {
        this.logger.info('🏥 Initializing System Health Monitor...');
        
        try {
            // Setup performance observers
            this.setupPerformanceObservers();
            
            // Setup error tracking
            this.setupErrorTracking();
            
            // Setup network monitoring
            this.setupNetworkMonitoring();
            
            // Setup storage monitoring
            this.setupStorageMonitoring();
            
            // Start health monitoring
            await this.startHealthMonitoring();
            
            this.logger.info('✅ System Health Monitor initialized successfully');
            
            return {
                initialized: true,
                monitoring: this.isMonitoring,
                startTime: this.monitoringStartTime
            };
            
        } catch (error) {
            this.logger.error('❌ System Health Monitor initialization failed:', error);
            throw error;
        }
    }

    async startHealthMonitoring() {
        if (this.isMonitoring) {
            this.logger.warn('Health monitoring already running');
            return;
        }
        
        this.isMonitoring = true;
        this.monitoringStartTime = Date.now();
        
        // Start different monitoring intervals
        this.setupMonitoringIntervals();
        
        // Run initial health check
        await this.runComprehensiveHealthCheck();
        
        this.logger.info('🔍 Health monitoring started');
    }

    async stopHealthMonitoring() {
        this.isMonitoring = false;
        
        // Clear all monitoring intervals
        for (const [key, intervalId] of this.eventListeners) {
            if (key.includes('interval_')) {
                clearInterval(intervalId);
            }
        }
        
        this.logger.info('⏹️ Health monitoring stopped');
    }

    setupMonitoringIntervals() {
        // Main health check interval
        const healthInterval = setInterval(() => {
            this.runHealthChecks().catch(error => {
                this.logger.error('Health check failed:', error);
            });
        }, this.monitoringIntervals.health);
        this.eventListeners.set('interval_health', healthInterval);
        
        // Performance monitoring interval
        const performanceInterval = setInterval(() => {
            this.checkPerformanceMetrics().catch(error => {
                this.logger.error('Performance check failed:', error);
            });
        }, this.monitoringIntervals.performance);
        this.eventListeners.set('interval_performance', performanceInterval);
        
        // Network monitoring interval
        const networkInterval = setInterval(() => {
            this.checkNetworkHealth().catch(error => {
                this.logger.error('Network check failed:', error);
            });
        }, this.monitoringIntervals.network);
        this.eventListeners.set('interval_network', networkInterval);
        
        // Storage monitoring interval
        const storageInterval = setInterval(() => {
            this.checkStorageHealth().catch(error => {
                this.logger.error('Storage check failed:', error);
            });
        }, this.monitoringIntervals.storage);
        this.eventListeners.set('interval_storage', storageInterval);
    }

    async runComprehensiveHealthCheck() {
        this.logger.info('🔍 Running comprehensive health check...');
        
        try {
            const healthResult = {
                timestamp: Date.now(),
                system: await this.checkSystemHealth(),
                network: await this.checkNetworkHealth(),
                storage: await this.checkStorageHealth(),
                security: await this.checkSecurityHealth(),
                performance: await this.checkPerformanceHealth(),
                apis: await this.checkAPIHealth(),
                database: await this.checkDatabaseHealth()
            };
            
            // Calculate overall health
            healthResult.overall = this.calculateOverallHealth(healthResult);
            
            // Update current health status
            this.updateCurrentHealth(healthResult);
            
            // Store in history
            this.addToHealthHistory(healthResult);
            
            // Check for alerts
            this.checkHealthAlerts(healthResult);
            
            this.logger.info(`📊 Health check complete - Overall: ${healthResult.overall.status}`);
            
            return healthResult;
            
        } catch (error) {
            this.logger.error('Comprehensive health check failed:', error);
            throw error;
        }
    }

    async runHealthChecks() {
        try {
            const quickHealth = {
                timestamp: Date.now(),
                system: await this.quickSystemCheck(),
                performance: await this.quickPerformanceCheck(),
                network: await this.quickNetworkCheck()
            };
            
            quickHealth.overall = this.calculateQuickHealth(quickHealth);
            this.updateCurrentHealth(quickHealth);
            
            return quickHealth;
            
        } catch (error) {
            this.logger.error('Quick health check failed:', error);
        }
    }

    async checkSystemHealth() {
        const systemHealth = {
            browser: this.getBrowserHealth(),
            memory: await this.getMemoryHealth(),
            performance: await this.getPerformanceHealth(),
            battery: await this.getBatteryHealth(),
            connection: this.getConnectionHealth()
        };
        
        const healthScores = Object.values(systemHealth).map(h => h.score || 0);
        const avgScore = healthScores.reduce((sum, score) => sum + score, 0) / healthScores.length;
        
        return {
            score: Math.round(avgScore),
            status: this.getHealthStatus(avgScore),
            details: systemHealth,
            timestamp: Date.now()
        };
    }

    async checkNetworkHealth() {
        const networkHealth = {
            connectivity: await this.testNetworkConnectivity(),
            latency: await this.testNetworkLatency(),
            bandwidth: await this.estimateBandwidth(),
            stability: this.getNetworkStability()
        };
        
        const avgScore = Object.values(networkHealth).reduce((sum, test) => sum + (test.score || 0), 0) / Object.keys(networkHealth).length;
        
        return {
            score: Math.round(avgScore),
            status: this.getHealthStatus(avgScore),
            details: networkHealth,
            timestamp: Date.now()
        };
    }

    async checkStorageHealth() {
        const storageHealth = {
            localStorage: await this.testLocalStorage(),
            indexedDB: await this.testIndexedDB(),
            quota: await this.checkStorageQuota(),
            performance: await this.testStoragePerformance()
        };
        
        const avgScore = Object.values(storageHealth).reduce((sum, test) => sum + (test.score || 0), 0) / Object.keys(storageHealth).length;
        
        return {
            score: Math.round(avgScore),
            status: this.getHealthStatus(avgScore),
            details: storageHealth,
            timestamp: Date.now()
        };
    }

    async checkSecurityHealth() {
        const securityHealth = {
            https: this.checkHTTPSStatus(),
            csp: this.checkContentSecurityPolicy(),
            permissions: await this.checkPermissions(),
            isolation: this.checkSecurityIsolation()
        };
        
        const avgScore = Object.values(securityHealth).reduce((sum, test) => sum + (test.score || 0), 0) / Object.keys(securityHealth).length;
        
        return {
            score: Math.round(avgScore),
            status: this.getHealthStatus(avgScore),
            details: securityHealth,
            timestamp: Date.now()
        };
    }

    async checkPerformanceHealth() {
        const performanceHealth = {
            memory: this.getMemoryMetrics(),
            timing: await this.getTimingMetrics(),
            resources: await this.getResourceMetrics(),
            interaction: this.getInteractionMetrics()
        };
        
        const avgScore = Object.values(performanceHealth).reduce((sum, test) => sum + (test.score || 0), 0) / Object.keys(performanceHealth).length;
        
        return {
            score: Math.round(avgScore),
            status: this.getHealthStatus(avgScore),
            details: performanceHealth,
            timestamp: Date.now()
        };
    }

    async checkAPIHealth() {
        const apiEndpoints = [
            'https://gamma-api.polymarket.com/ping',
            'https://clob.polymarket.com/ping'
        ];
        
        const apiTests = {};
        
        for (const endpoint of apiEndpoints) {
            apiTests[endpoint] = await this.testAPIEndpoint(endpoint);
        }
        
        const avgScore = Object.values(apiTests).reduce((sum, test) => sum + (test.score || 0), 0) / Object.keys(apiTests).length;
        
        return {
            score: Math.round(avgScore),
            status: this.getHealthStatus(avgScore),
            details: apiTests,
            timestamp: Date.now()
        };
    }

    async checkDatabaseHealth() {
        const dbHealth = {
            connectivity: await this.testDatabaseConnection(),
            performance: await this.testDatabasePerformance(),
            integrity: await this.testDatabaseIntegrity(),
            size: await this.checkDatabaseSize()
        };
        
        const avgScore = Object.values(dbHealth).reduce((sum, test) => sum + (test.score || 0), 0) / Object.keys(dbHealth).length;
        
        return {
            score: Math.round(avgScore),
            status: this.getHealthStatus(avgScore),
            details: dbHealth,
            timestamp: Date.now()
        };
    }

    // Quick health checks for frequent monitoring
    async quickSystemCheck() {
        const memInfo = this.getMemoryUsage();
        const score = memInfo.usedMB < this.alertThresholds.memoryUsage ? 100 : 50;
        
        return {
            score: score,
            status: this.getHealthStatus(score),
            memoryUsage: memInfo.usedMB
        };
    }

    async quickPerformanceCheck() {
        const responseTime = await this.measureResponseTime();
        const score = responseTime < this.alertThresholds.responseTime ? 100 : 50;
        
        return {
            score: score,
            status: this.getHealthStatus(score),
            responseTime: responseTime
        };
    }

    async quickNetworkCheck() {
        const online = navigator.onLine;
        const score = online ? 100 : 0;
        
        return {
            score: score,
            status: online ? 'healthy' : 'critical',
            online: online
        };
    }

    // Health calculation methods
    calculateOverallHealth(healthResult) {
        const categories = ['system', 'network', 'storage', 'security', 'performance'];
        const scores = categories.map(cat => healthResult[cat]?.score || 0);
        const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
        
        return {
            score: Math.round(avgScore),
            status: this.getHealthStatus(avgScore),
            categories: categories.length,
            timestamp: Date.now()
        };
    }

    calculateQuickHealth(quickResult) {
        const scores = Object.values(quickResult).filter(r => r.score !== undefined).map(r => r.score);
        const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
        
        return {
            score: Math.round(avgScore),
            status: this.getHealthStatus(avgScore)
        };
    }

    getHealthStatus(score) {
        if (score >= 90) return 'excellent';
        if (score >= 75) return 'good';
        if (score >= 50) return 'warning';
        if (score >= 25) return 'poor';
        return 'critical';
    }

    // Detailed health check methods
    getBrowserHealth() {
        const userAgent = navigator.userAgent;
        const isModern = 'fetch' in window && 'Promise' in window && 'crypto' in window;
        const hasRequiredFeatures = 'indexedDB' in window && 'serviceWorker' in navigator;
        
        let score = 50;
        if (isModern) score += 25;
        if (hasRequiredFeatures) score += 25;
        
        return {
            score: score,
            userAgent: userAgent,
            modern: isModern,
            features: hasRequiredFeatures
        };
    }

    async getMemoryHealth() {
        const memInfo = this.getMemoryUsage();
        const score = Math.max(0, 100 - (memInfo.usedMB / this.alertThresholds.memoryUsage) * 100);
        
        return {
            score: Math.round(score),
            usedMB: memInfo.usedMB,
            totalMB: memInfo.totalMB,
            percentage: memInfo.percentage
        };
    }

    async getPerformanceHealth() {
        if (!('performance' in window)) {
            return { score: 50, available: false };
        }
        
        const timing = performance.timing;
        const loadTime = timing.loadEventEnd - timing.navigationStart;
        const score = Math.max(0, 100 - (loadTime / 10000) * 100); // 10s = 0 score
        
        return {
            score: Math.round(score),
            loadTime: loadTime,
            available: true
        };
    }

    async getBatteryHealth() {
        if (!('getBattery' in navigator)) {
            return { score: 100, available: false };
        }
        
        try {
            const battery = await navigator.getBattery();
            const level = battery.level * 100;
            const score = level < this.alertThresholds.batteryLevel ? 25 : 100;
            
            return {
                score: score,
                level: level,
                charging: battery.charging,
                available: true
            };
        } catch (error) {
            return { score: 100, available: false, error: error.message };
        }
    }

    getConnectionHealth() {
        if (!('connection' in navigator)) {
            return { score: 75, available: false };
        }
        
        const connection = navigator.connection;
        const effectiveType = connection.effectiveType;
        
        let score = 50;
        switch (effectiveType) {
            case '4g': score = 100; break;
            case '3g': score = 75; break;
            case '2g': score = 25; break;
            case 'slow-2g': score = 10; break;
        }
        
        return {
            score: score,
            effectiveType: effectiveType,
            downlink: connection.downlink,
            rtt: connection.rtt,
            available: true
        };
    }

    async testNetworkConnectivity() {
        try {
            const response = await fetch('https://www.google.com/favicon.ico', {
                method: 'HEAD',
                cache: 'no-cache'
            });
            
            return {
                score: response.ok ? 100 : 0,
                status: response.status,
                connected: response.ok
            };
        } catch (error) {
            return {
                score: 0,
                connected: false,
                error: error.message
            };
        }
    }

    async testNetworkLatency() {
        const tests = [];
        const testCount = 3;
        
        for (let i = 0; i < testCount; i++) {
            const startTime = performance.now();
            try {
                await fetch('https://www.google.com/favicon.ico', {
                    method: 'HEAD',
                    cache: 'no-cache'
                });
                const latency = performance.now() - startTime;
                tests.push(latency);
            } catch (error) {
                tests.push(5000); // Assume high latency on error
            }
        }
        
        const avgLatency = tests.reduce((sum, lat) => sum + lat, 0) / tests.length;
        const score = Math.max(0, 100 - (avgLatency / this.alertThresholds.networkLatency) * 100);
        
        return {
            score: Math.round(score),
            averageLatency: Math.round(avgLatency),
            tests: tests.length
        };
    }

    async estimateBandwidth() {
        try {
            const testSize = 50000; // 50KB test
            const testUrl = 'data:text/plain;base64,' + btoa('x'.repeat(testSize));
            
            const startTime = performance.now();
            await fetch(testUrl);
            const duration = performance.now() - startTime;
            
            const bandwidth = (testSize * 8) / (duration / 1000); // bits per second
            const score = Math.min(100, (bandwidth / 1000000) * 100); // 1Mbps = 100 score
            
            return {
                score: Math.round(score),
                bandwidth: Math.round(bandwidth),
                testSize: testSize,
                duration: Math.round(duration)
            };
        } catch (error) {
            return {
                score: 50,
                error: error.message
            };
        }
    }

    getNetworkStability() {
        const errorRate = this.performanceMetrics.networkErrors.length / Math.max(1, this.performanceMetrics.totalRequests);
        const score = Math.max(0, 100 - (errorRate / this.alertThresholds.errorRate) * 100);
        
        return {
            score: Math.round(score),
            errorRate: errorRate,
            totalErrors: this.performanceMetrics.networkErrors.length,
            totalRequests: this.performanceMetrics.totalRequests
        };
    }

    // Storage health methods
    async testLocalStorage() {
        try {
            const testKey = 'health_test_' + Date.now();
            const testData = 'test_data';
            
            localStorage.setItem(testKey, testData);
            const retrieved = localStorage.getItem(testKey);
            localStorage.removeItem(testKey);
            
            const score = retrieved === testData ? 100 : 0;
            
            return {
                score: score,
                working: retrieved === testData
            };
        } catch (error) {
            return {
                score: 0,
                working: false,
                error: error.message
            };
        }
    }

    async testIndexedDB() {
        try {
            const dbName = 'health_test_db';
            const request = indexedDB.open(dbName, 1);
            
            return new Promise((resolve) => {
                request.onerror = () => {
                    resolve({
                        score: 0,
                        working: false,
                        error: 'Failed to open IndexedDB'
                    });
                };
                
                request.onsuccess = (event) => {
                    const db = event.target.result;
                    db.close();
                    indexedDB.deleteDatabase(dbName);
                    
                    resolve({
                        score: 100,
                        working: true
                    });
                };
            });
        } catch (error) {
            return {
                score: 0,
                working: false,
                error: error.message
            };
        }
    }

    async checkStorageQuota() {
        try {
            if ('storage' in navigator && 'estimate' in navigator.storage) {
                const estimate = await navigator.storage.estimate();
                const usedMB = estimate.usage / (1024 * 1024);
                const availableMB = (estimate.quota - estimate.usage) / (1024 * 1024);
                
                const score = availableMB > this.alertThresholds.diskUsage ? 100 : 25;
                
                return {
                    score: score,
                    usedMB: Math.round(usedMB),
                    availableMB: Math.round(availableMB),
                    totalMB: Math.round(estimate.quota / (1024 * 1024))
                };
            }
        } catch (error) {
            // Fallback
        }
        
        return {
            score: 75,
            available: false
        };
    }

    async testStoragePerformance() {
        const testData = 'x'.repeat(1000); // 1KB test
        const iterations = 100;
        
        const startTime = performance.now();
        
        for (let i = 0; i < iterations; i++) {
            const key = 'perf_test_' + i;
            localStorage.setItem(key, testData);
            localStorage.getItem(key);
            localStorage.removeItem(key);
        }
        
        const duration = performance.now() - startTime;
        const score = Math.max(0, 100 - (duration / 1000) * 100); // 1s = 0 score
        
        return {
            score: Math.round(score),
            duration: Math.round(duration),
            iterations: iterations
        };
    }

    // API health testing
    async testAPIEndpoint(endpoint) {
        try {
            const startTime = performance.now();
            const response = await fetch(endpoint, {
                method: 'GET',
                cache: 'no-cache'
            });
            const duration = performance.now() - startTime;
            
            const score = response.ok ? Math.max(0, 100 - (duration / this.alertThresholds.responseTime) * 100) : 0;
            
            return {
                score: Math.round(score),
                status: response.status,
                responseTime: Math.round(duration),
                ok: response.ok
            };
        } catch (error) {
            return {
                score: 0,
                error: error.message,
                ok: false
            };
        }
    }

    // Database health testing
    async testDatabaseConnection() {
        try {
            // This would test actual database connection
            return {
                score: 100,
                connected: true
            };
        } catch (error) {
            return {
                score: 0,
                connected: false,
                error: error.message
            };
        }
    }

    async testDatabasePerformance() {
        // Placeholder for database performance testing
        return {
            score: 85,
            responseTime: 50
        };
    }

    async testDatabaseIntegrity() {
        // Placeholder for database integrity checking
        return {
            score: 100,
            integrity: true
        };
    }

    async checkDatabaseSize() {
        // Placeholder for database size checking
        return {
            score: 90,
            sizeMB: 25
        };
    }

    // Security health methods
    checkHTTPSStatus() {
        const isHTTPS = location.protocol === 'https:';
        return {
            score: isHTTPS ? 100 : 0,
            https: isHTTPS
        };
    }

    checkContentSecurityPolicy() {
        const hasMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
        return {
            score: hasMeta ? 100 : 75,
            present: !!hasMeta
        };
    }

    async checkPermissions() {
        const permissions = ['notifications', 'persistent-storage'];
        const results = {};
        let totalScore = 0;
        
        for (const permission of permissions) {
            try {
                if ('permissions' in navigator) {
                    const result = await navigator.permissions.query({ name: permission });
                    results[permission] = result.state;
                    totalScore += result.state === 'granted' ? 100 : 50;
                } else {
                    results[permission] = 'unavailable';
                    totalScore += 50;
                }
            } catch (error) {
                results[permission] = 'error';
                totalScore += 25;
            }
        }
        
        return {
            score: Math.round(totalScore / permissions.length),
            permissions: results
        };
    }

    checkSecurityIsolation() {
        const isolated = window.crossOriginIsolated;
        return {
            score: isolated ? 100 : 75,
            crossOriginIsolated: isolated
        };
    }

    // Performance monitoring setup
    setupPerformanceObservers() {
        if (!('PerformanceObserver' in window)) return;
        
        try {
            // Navigation timing
            const navObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    this.recordPerformanceMetric('navigation', entry);
                }
            });
            navObserver.observe({ entryTypes: ['navigation'] });
            
            // Resource timing
            const resourceObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    this.recordPerformanceMetric('resource', entry);
                }
            });
            resourceObserver.observe({ entryTypes: ['resource'] });
            
            // Measure timing
            const measureObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    this.recordPerformanceMetric('measure', entry);
                }
            });
            measureObserver.observe({ entryTypes: ['measure'] });
            
        } catch (error) {
            this.logger.warn('Performance observers setup failed:', error);
        }
    }

    setupErrorTracking() {
        window.addEventListener('error', (event) => {
            this.recordError('javascript', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error
            });
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            this.recordError('promise', {
                reason: event.reason,
                promise: event.promise
            });
        });
    }

    setupNetworkMonitoring() {
        const originalFetch = window.fetch;
        
        window.fetch = async (...args) => {
            const startTime = performance.now();
            this.performanceMetrics.totalRequests++;
            
            try {
                const response = await originalFetch(...args);
                const duration = performance.now() - startTime;
                
                this.performanceMetrics.totalResponseTime += duration;
                
                if (!response.ok) {
                    this.recordNetworkError(args[0], response.status, duration);
                }
                
                return response;
            } catch (error) {
                this.performanceMetrics.totalErrors++;
                this.recordNetworkError(args[0], 0, performance.now() - startTime);
                throw error;
            }
        };
    }

    setupStorageMonitoring() {
        // Monitor localStorage usage
        const originalSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function(key, value) {
            try {
                return originalSetItem.call(this, key, value);
            } catch (error) {
                console.warn('Storage quota exceeded:', error);
                throw error;
            }
        };
    }

    // Data recording methods
    recordPerformanceMetric(type, entry) {
        // Store performance metrics for analysis
    }

    recordError(type, errorData) {
        this.performanceMetrics.totalErrors++;
        
        this.logger.error(`${type} error recorded:`, errorData);
    }

    recordNetworkError(url, status, duration) {
        this.performanceMetrics.networkErrors.push({
            url: url,
            status: status,
            duration: duration,
            timestamp: Date.now()
        });
        
        // Keep only recent errors
        if (this.performanceMetrics.networkErrors.length > 50) {
            this.performanceMetrics.networkErrors.shift();
        }
    }

    // Utility methods
    getMemoryUsage() {
        if ('memory' in performance) {
            const memInfo = performance.memory;
            return {
                usedMB: Math.round(memInfo.usedJSHeapSize / 1024 / 1024),
                totalMB: Math.round(memInfo.totalJSHeapSize / 1024 / 1024),
                limitMB: Math.round(memInfo.jsHeapSizeLimit / 1024 / 1024),
                percentage: Math.round((memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit) * 100)
            };
        }
        
        return {
            usedMB: 0,
            totalMB: 0,
            limitMB: 0,
            percentage: 0,
            available: false
        };
    }

    async measureResponseTime() {
        const startTime = performance.now();
        
        // Simulate a typical operation
        await new Promise(resolve => setTimeout(resolve, 1));
        
        return performance.now() - startTime;
    }

    updateCurrentHealth(healthResult) {
        this.currentHealth = {
            overall: healthResult.overall?.status || 'unknown',
            system: healthResult.system?.status || 'unknown',
            network: healthResult.network?.status || 'unknown',
            storage: healthResult.storage?.status || 'unknown',
            security: healthResult.security?.status || 'unknown',
            performance: healthResult.performance?.status || 'unknown',
            lastUpdate: Date.now()
        };
    }

    addToHealthHistory(healthResult) {
        this.healthHistory.push({
            timestamp: healthResult.timestamp,
            overall: healthResult.overall,
            summary: {
                system: healthResult.system?.score,
                network: healthResult.network?.score,
                storage: healthResult.storage?.score,
                security: healthResult.security?.score,
                performance: healthResult.performance?.score
            }
        });
        
        // Keep history size manageable
        if (this.healthHistory.length > this.maxHistoryEntries) {
            this.healthHistory.shift();
        }
    }

    checkHealthAlerts(healthResult) {
        const alerts = [];
        
        // Check system alerts
        if (healthResult.system?.score < 50) {
            alerts.push({
                category: 'system',
                severity: 'warning',
                message: 'System health is poor',
                score: healthResult.system.score
            });
        }
        
        // Check performance alerts
        if (healthResult.performance?.score < 50) {
            alerts.push({
                category: 'performance',
                severity: 'warning',
                message: 'Performance issues detected',
                score: healthResult.performance.score
            });
        }
        
        // Check network alerts
        if (healthResult.network?.score < 30) {
            alerts.push({
                category: 'network',
                severity: 'critical',
                message: 'Network connectivity issues',
                score: healthResult.network.score
            });
        }
        
        // Emit alerts
        if (alerts.length > 0) {
            this.emitHealthAlerts(alerts);
        }
    }

    emitHealthAlerts(alerts) {
        for (const alert of alerts) {
            this.logger.warn(`🚨 Health Alert: ${alert.message}`, alert);
            
            // Emit custom event for alert system integration
            document.dispatchEvent(new CustomEvent('healthAlert', {
                detail: alert
            }));
        }
    }

    // Public API methods
    getCurrentHealth() {
        return { ...this.currentHealth };
    }

    getHealthHistory() {
        return [...this.healthHistory];
    }

    getPerformanceMetrics() {
        return {
            ...this.performanceMetrics,
            uptime: Date.now() - this.performanceMetrics.startTime,
            averageResponseTime: this.performanceMetrics.totalRequests > 0 ? 
                this.performanceMetrics.totalResponseTime / this.performanceMetrics.totalRequests : 0,
            errorRate: this.performanceMetrics.totalRequests > 0 ?
                this.performanceMetrics.totalErrors / this.performanceMetrics.totalRequests : 0
        };
    }

    async generateHealthReport() {
        const health = await this.runComprehensiveHealthCheck();
        const metrics = this.getPerformanceMetrics();
        const history = this.getHealthHistory();
        
        return {
            timestamp: Date.now(),
            currentHealth: health,
            performanceMetrics: metrics,
            healthTrends: this.analyzeHealthTrends(history),
            recommendations: this.generateHealthRecommendations(health),
            uptime: metrics.uptime
        };
    }

    analyzeHealthTrends(history) {
        if (history.length < 2) return { trend: 'insufficient_data' };
        
        const recent = history.slice(-10);
        const scores = recent.map(h => h.overall.score);
        
        const trend = scores[scores.length - 1] - scores[0];
        
        return {
            trend: trend > 5 ? 'improving' : trend < -5 ? 'declining' : 'stable',
            change: trend,
            dataPoints: scores.length
        };
    }

    generateHealthRecommendations(health) {
        const recommendations = [];
        
        if (health.system?.score < 75) {
            recommendations.push({
                category: 'system',
                priority: 'medium',
                message: 'Consider closing unused tabs or restarting the application'
            });
        }
        
        if (health.performance?.score < 60) {
            recommendations.push({
                category: 'performance',
                priority: 'high',
                message: 'Performance issues detected. Check memory usage and network connectivity'
            });
        }
        
        if (health.storage?.score < 50) {
            recommendations.push({
                category: 'storage',
                priority: 'medium',
                message: 'Storage space is low. Consider clearing old data'
            });
        }
        
        return recommendations;
    }

    // Cleanup
    destroy() {
        this.stopHealthMonitoring();
        
        // Clear all event listeners
        for (const [key, value] of this.eventListeners) {
            if (typeof value === 'function') {
                window.removeEventListener(key, value);
            } else if (typeof value === 'number') {
                clearInterval(value);
            }
        }
        
        this.eventListeners.clear();
        this.healthHistory = [];
        
        this.logger.info('🏥 System Health Monitor destroyed');
    }

    // Additional utility methods
    getMemoryMetrics() {
        const memory = this.getMemoryUsage();
        const score = Math.max(0, 100 - (memory.usedMB / this.alertThresholds.memoryUsage) * 100);
        
        return {
            score: Math.round(score),
            ...memory
        };
    }

    async getTimingMetrics() {
        if (!performance.timing) {
            return { score: 50, available: false };
        }
        
        const timing = performance.timing;
        const loadTime = timing.loadEventEnd - timing.navigationStart;
        const score = Math.max(0, 100 - (loadTime / 10000) * 100);
        
        return {
            score: Math.round(score),
            loadTime: loadTime,
            available: true
        };
    }

    async getResourceMetrics() {
        const resources = performance.getEntriesByType('resource');
        const avgDuration = resources.length > 0 ? 
            resources.reduce((sum, r) => sum + r.duration, 0) / resources.length : 0;
        
        const score = Math.max(0, 100 - (avgDuration / 1000) * 100);
        
        return {
            score: Math.round(score),
            resourceCount: resources.length,
            averageDuration: Math.round(avgDuration)
        };
    }

    getInteractionMetrics() {
        // Placeholder for user interaction metrics
        return {
            score: 85,
            available: false
        };
    }

    async checkPerformanceMetrics() {
        const memInfo = this.getMemoryUsage();
        
        // Track memory peaks
        if (memInfo.usedMB > 0) {
            this.performanceMetrics.memoryPeaks.push({
                usage: memInfo.usedMB,
                timestamp: Date.now()
            });
            
            // Keep only recent peaks
            const cutoff = Date.now() - (60 * 60 * 1000); // 1 hour
            this.performanceMetrics.memoryPeaks = this.performanceMetrics.memoryPeaks.filter(
                peak => peak.timestamp > cutoff
            );
        }
        
        // Check for memory alerts
        if (memInfo.usedMB > this.alertThresholds.memoryUsage) {
            this.logger.warn(`🚨 High memory usage: ${memInfo.usedMB}MB`);
            
            document.dispatchEvent(new CustomEvent('memoryAlert', {
                detail: { usage: memInfo.usedMB, threshold: this.alertThresholds.memoryUsage }
            }));
        }
    }
}