/**
 * @file error-handler.js
 * @description Centralized error logging and notification system for Intel Dashboard.
 */

class ErrorLogger {
    constructor() {
        this.logs = [];
        this.maxLogs = 100;
        this.categories = {
            CESIUM: 'CESIUM',
            ADSB: 'ADSB',
            AIS: 'AIS',
            MAP: 'MAP',
            GENERAL: 'GENERAL'
        };
    }

    /**
     * Logs an error with category and timestamp.
     * @param {string} category 
     * @param {string} message 
     * @param {Error} [error] 
     */
    log(category, message, error = null) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            category,
            timestamp,
            message,
            stack: error ? error.stack : null
        };

        this.logs.push(logEntry);
        if (this.logs.length > this.maxLogs) this.logs.shift();

        const logString = `[${category}] [${timestamp}] ${message}`;
        console.error(logString, error || '');

        // Show toast notification for critical errors
        if (category === this.categories.CESIUM || category === this.categories.MAP) {
            this.showToast(`System Alert: ${message}`, 'error');
        }
    }

    /**
     * Displays a toast notification to the user.
     * @param {string} message 
     * @param {string} type - 'error', 'warn', 'info'
     */
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-icon">${type === 'error' ? '⚠️' : 'ℹ️'}</span>
                <span class="toast-message">${message}</span>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        `;

        container.appendChild(toast);

        // Auto-remove after 8 seconds
        setTimeout(() => {
            if (toast.parentElement) toast.remove();
        }, 8000);
    }

    getLogs(category = null) {
        if (category) return this.logs.filter(l => l.category === category);
        return this.logs;
    }

    export() {
        return JSON.stringify(this.logs, null, 2);
    }
}

// Global instance
window.Logger = new ErrorLogger();

// Global Error Listener
window.addEventListener('error', (event) => {
    const isCesium = event.message.toLowerCase().includes('cesium') || 
                     (event.filename && event.filename.includes('Cesium'));
    
    const category = isCesium ? 'CESIUM' : 'GENERAL';
    window.Logger.log(category, event.message, event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    window.Logger.log('GENERAL', `Unhandled Promise Rejection: ${event.reason}`);
});
