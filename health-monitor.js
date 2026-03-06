/**
 * @file health-monitor.js
 * @description Comprehensive health tracking and metrics aggregator for SENTINEL OMEGA.
 */

class HealthMonitor {
    constructor() {
        this.startTime = Date.now();
        this.metrics = {
            requests: { total: 0, success: 0, errors: 0 },
            adsb: { polls: 0, success: 0, errors: 0, lastPoll: null },
            ais: { messages: 0, connected: false, lastMessage: null },
            assets: { current: 0, peak: 0, total: 0 },
            briefings: { generated: 0, lastGenerated: null },
            alerts: { sent: 0, failed: 0 }
        };
    }

    getUptime() {
        return Date.now() - this.startTime;
    }

    getUptimeFormatted() {
        const uptime = this.getUptime();
        const days = Math.floor(uptime / (1000 * 60 * 60 * 24));
        const hours = Math.floor((uptime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((uptime % (1000 * 60)) / 1000);
        return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    }

    recordRequest(success = true) {
        this.metrics.requests.total++;
        if (success) this.metrics.requests.success++;
        else this.metrics.requests.errors++;
    }

    recordAdsbPoll(success = true) {
        this.metrics.adsb.polls++;
        this.metrics.adsb.lastPoll = Date.now();
        if (success) this.metrics.adsb.success++;
        else this.metrics.adsb.errors++;
    }

    recordAisMessage() {
        this.metrics.ais.messages++;
        this.metrics.ais.lastMessage = Date.now();
    }

    setAisConnected(connected) {
        this.metrics.ais.connected = connected;
    }

    updateAssetCount(current) {
        this.metrics.assets.current = current;
        if (current > this.metrics.assets.peak) {
            this.metrics.assets.peak = current;
        }
        this.metrics.assets.total++;
    }

    recordBriefing() {
        this.metrics.briefings.generated++;
        this.metrics.briefings.lastGenerated = Date.now();
    }

    recordAlert(success = true) {
        if (success) this.metrics.alerts.sent++;
        else this.metrics.alerts.failed++;
    }

    calculateRPM() {
        const uptimeMinutes = this.getUptime() / (1000 * 60);
        if (uptimeMinutes === 0) return 0;
        return Math.round(this.metrics.requests.total / uptimeMinutes);
    }

    getHealth() {
        const now = Date.now();
        const adsbHealthy = this.metrics.adsb.lastPoll && (now - this.metrics.adsb.lastPoll) < 60000;
        const aisHealthy = this.metrics.ais.connected && this.metrics.ais.lastMessage && (now - this.metrics.ais.lastMessage) < 300000;
        const healthy = adsbHealthy || aisHealthy;

        return {
            status: healthy ? 'healthy' : 'degraded',
            uptime: this.getUptimeFormatted(),
            uptimeMs: this.getUptime(),
            timestamp: new Date().toISOString(),
            services: {
                adsb: {
                    status: adsbHealthy ? 'up' : 'down',
                    lastPoll: this.metrics.adsb.lastPoll ? new Date(this.metrics.adsb.lastPoll).toISOString() : null,
                    polls: this.metrics.adsb.polls,
                    successRate: this.metrics.adsb.polls > 0 ? ((this.metrics.adsb.success / this.metrics.adsb.polls) * 100).toFixed(2) + '%' : 'N/A'
                },
                ais: {
                    status: aisHealthy ? 'up' : 'down',
                    connected: this.metrics.ais.connected,
                    lastMessage: this.metrics.ais.lastMessage ? new Date(this.metrics.ais.lastMessage).toISOString() : null,
                    messages: this.metrics.ais.messages
                }
            },
            assets: {
                current: this.metrics.assets.current,
                peak: this.metrics.assets.peak
            },
            performance: {
                requestsPerMinute: this.calculateRPM(),
                errorRate: this.metrics.requests.total > 0 ? ((this.metrics.requests.errors / this.metrics.requests.total) * 100).toFixed(2) + '%' : '0%'
            },
            system: {
                memory: process.memoryUsage(),
                cpu: process.cpuUsage(),
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch
            }
        };
    }

    getMetrics() {
        return {
            ...this.metrics,
            uptime: this.getUptime(),
            requestsPerMinute: this.calculateRPM()
        };
    }

    getSystemInfo() {
        return {
            version: process.env.npm_package_version || '1.0.0',
            environment: process.env.NODE_ENV || 'production',
            node: process.version,
            platform: process.platform,
            arch: process.arch,
            pid: process.pid,
            uptime: this.getUptimeFormatted(),
            memory: {
                total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
                used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
                rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB'
            }
        };
    }
}

module.exports = new HealthMonitor();
