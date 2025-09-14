export class Logger {
    constructor(name) {
        this.name = name;
        this.levels = {
            ERROR: 0,
            WARN: 1,
            INFO: 2,
            DEBUG: 3
        };
        this.currentLevel = this.levels.INFO;
        this.enableConsole = true;
        this.enableStorage = false;
        this.maxStorageEntries = 1000;
        this.storageKey = 'polymarket-agent-logs';
    }

    setLevel(level) {
        if (typeof level === 'string') {
            this.currentLevel = this.levels[level.toUpperCase()];
        } else {
            this.currentLevel = level;
        }
    }

    enableStorageLogging(enable = true) {
        this.enableStorage = enable;
    }

    log(level, message, ...args) {
        if (level > this.currentLevel) {
            return;
        }

        const timestamp = new Date().toISOString();
        const levelName = Object.keys(this.levels)[level];
        const logEntry = {
            timestamp,
            level: levelName,
            name: this.name,
            message,
            args
        };

        if (this.enableConsole) {
            this.logToConsole(logEntry);
        }

        if (this.enableStorage) {
            this.logToStorage(logEntry);
        }
    }

    logToConsole(logEntry) {
        const { timestamp, level, name, message, args } = logEntry;
        const prefix = `[${timestamp}] ${level} [${name}]:`;
        
        switch (level) {
            case 'ERROR':
                console.error(prefix, message, ...args);
                break;
            case 'WARN':
                console.warn(prefix, message, ...args);
                break;
            case 'INFO':
                console.info(prefix, message, ...args);
                break;
            case 'DEBUG':
                console.debug(prefix, message, ...args);
                break;
            default:
                console.log(prefix, message, ...args);
        }
    }

    logToStorage(logEntry) {
        try {
            let logs = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
            logs.push(logEntry);

            // Keep only the latest entries
            if (logs.length > this.maxStorageEntries) {
                logs = logs.slice(-this.maxStorageEntries);
            }

            localStorage.setItem(this.storageKey, JSON.stringify(logs));
        } catch (error) {
            console.error('Failed to store log entry:', error);
        }
    }

    error(message, ...args) {
        this.log(this.levels.ERROR, message, ...args);
    }

    warn(message, ...args) {
        this.log(this.levels.WARN, message, ...args);
    }

    info(message, ...args) {
        this.log(this.levels.INFO, message, ...args);
    }

    debug(message, ...args) {
        this.log(this.levels.DEBUG, message, ...args);
    }

    getStoredLogs() {
        try {
            return JSON.parse(localStorage.getItem(this.storageKey) || '[]');
        } catch (error) {
            console.error('Failed to retrieve stored logs:', error);
            return [];
        }
    }

    clearStoredLogs() {
        try {
            localStorage.removeItem(this.storageKey);
        } catch (error) {
            console.error('Failed to clear stored logs:', error);
        }
    }

    exportLogs() {
        const logs = this.getStoredLogs();
        const logText = logs.map(log => {
            const argsText = log.args.length > 0 ? ' ' + log.args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' ') : '';
            return `[${log.timestamp}] ${log.level} [${log.name}]: ${log.message}${argsText}`;
        }).join('\n');

        return logText;
    }

    downloadLogs() {
        const logText = this.exportLogs();
        const blob = new Blob([logText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `polymarket-agent-logs-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}