/**
 * @file briefing-scheduler.js
 * @description Automated daily strategic briefing generator.
 */

const schedule = require('node-schedule');
const fs = require('fs');
const path = require('path');
const { sendTelegramMessage } = require('./telegram-alerts');
const { checkADIZEntry } = require('./adiz-zones');

const BRIEFING_CONFIG = {
    enabled: process.env.ENABLE_DAILY_BRIEFING === 'true',
    cronTime: '0 20 * * *', // 20:00 daily
    timezone: 'Asia/Jakarta',
    outputDir: path.join(process.cwd(), 'briefings'),
    sendToTelegram: process.env.BRIEFING_TO_TELEGRAM === 'true'
};

class BriefingScheduler {
    constructor(intelligenceBuffer) {
        this.intelligenceBuffer = intelligenceBuffer;
        this.job = null;
        this.stats = {
            lastGenerated: null,
            totalGenerated: 0
        };

        if (!fs.existsSync(BRIEFING_CONFIG.outputDir)) {
            fs.mkdirSync(BRIEFING_CONFIG.outputDir, { recursive: true });
        }
    }

    async generateBriefing() {
        console.log('[BRIEFING] Initializing daily strategic synthesis...');
        
        const assets = Array.from(this.intelligenceBuffer.values());
        const timestamp = new Date();
        
        const analysis = this.analyzeAssets(assets);
        const report = this.formatReport(analysis, timestamp);
        
        const filename = `briefing_${timestamp.toISOString().split('T')[0]}.md`;
        const filepath = path.join(BRIEFING_CONFIG.outputDir, filename);
        
        fs.writeFileSync(filepath, report, 'utf8');
        
        if (BRIEFING_CONFIG.sendToTelegram) {
            await this.sendBriefingNotification(analysis, filename);
        }
        
        this.stats.lastGenerated = timestamp;
        this.stats.totalGenerated++;
        
        return { success: true, filename, filepath, analysis };
    }

    analyzeAssets(assets) {
        const priorityAssets = assets.filter(a => a.history && a.history.length > 0);
        const adizIncursions = [];
        const unusualPatterns = [];
        
        const typeDistribution = {};
        assets.forEach(a => {
            const type = a.type || 'UNKNOWN';
            typeDistribution[type] = (typeDistribution[type] || 0) + 1;
            
            // ADIZ Check
            const lastPos = a.history[a.history.length - 1];
            const zones = checkADIZEntry({ lat: lastPos.lat, lon: lastPos.lon });
            if (zones.length > 0) {
                adizIncursions.push({
                    callsign: a.callsign,
                    type: a.type,
                    zones: zones.map(z => z.name).join(', ')
                });
            }

            // Pattern Check: High speed low altitude
            if (lastPos.spd > 450 && lastPos.alt < 5000) {
                unusualPatterns.push({
                    callsign: a.callsign,
                    pattern: 'High-speed penetration profile',
                    details: `${lastPos.spd}kts at ${lastPos.alt}ft`
                });
            }
        });

        const threatLevel = this.calculateThreatLevel(priorityAssets.length, adizIncursions.length);

        return {
            totalAssets: assets.length,
            priorityCount: priorityAssets.length,
            priorityAssets: priorityAssets.slice(0, 10),
            adizIncursions,
            unusualPatterns,
            typeDistribution,
            threatLevel
        };
    }

    calculateThreatLevel(priorityCount, incursionCount) {
        const score = (priorityCount * 5) + (incursionCount * 15);
        if (score > 100) return 'CRITICAL';
        if (score > 50) return 'ELEVATED';
        if (score > 20) return 'MODERATE';
        return 'NORMAL';
    }

    formatReport(analysis, timestamp) {
        return `
# SENTINEL OMEGA: DAILY STRATEGIC BRIEFING
**DATE:** ${timestamp.toLocaleDateString('en-US', { dateStyle: 'full' })}
**SECURITY CLEARANCE:** TOP SECRET // OMEGA

---

## 🎯 EXECUTIVE SUMMARY
**OVERALL THREAT LEVEL: ${analysis.threatLevel}**

During this 24-hour cycle, SENTINEL OMEGA monitored **${analysis.totalAssets}** unique strategic assets. 
Significant activity was noted regarding **${analysis.priorityCount}** high-value targets.

---

## 🛩️ TOP PRIORITY ASSETS
${analysis.priorityAssets.length > 0 ? analysis.priorityAssets.map(a => `- **${a.callsign}** [${a.type}] (${a.id})`).join('\n') : '_No priority assets detected during this period._'}

---

## 🚨 ADIZ INCURSIONS & BORDER ACTIVITY
${analysis.adizIncursions.length > 0 ? analysis.adizIncursions.map(i => `- **${i.callsign}** (${i.type}) detected in **${i.zones}**`).join('\n') : '_No unauthorized ADIZ incursions recorded._'}

---

## ⚠️ TACTICAL ANOMALIES
${analysis.unusualPatterns.length > 0 ? analysis.unusualPatterns.map(p => `- **${p.callsign}**: ${p.pattern} (${p.details})`).join('\n') : '_No unusual operational patterns detected._'}

---

## 📊 ASSET INTELLIGENCE
${Object.entries(analysis.typeDistribution).map(([type, count]) => `- ${type}: ${count}`).join('\n')}

---

## 💡 STRATEGIC RECOMMENDATIONS
${analysis.threatLevel === 'CRITICAL' ? '- Initiate full defensive posture\n- Alert regional command hubs' : 
  analysis.threatLevel === 'ELEVATED' ? '- Increase sweep frequency\n- Cross-reference SIGINT data' : 
  '- Maintain standard sentinel sweep protocols'}

---
*REPORT GENERATED BY SENTINEL OMEGA AUTOMATED ANALYST*
        `.trim();
    }

    async sendBriefingNotification(analysis, filename) {
        const message = `
📊 *DAILY STRATEGIC BRIEFING READY*
━━━━━━━━━━━━━━━━━━━━━
*Threat Level:* ${analysis.threatLevel}
*Priority Targets:* ${analysis.priorityCount}
*ADIZ Incursions:* ${analysis.adizIncursions.length}
*Anomalies:* ${analysis.unusualPatterns.length}

*Report:* \`${filename}\`
━━━━━━━━━━━━━━━━━━━━━
_Access full logs in Dashboard_
        `.trim();
        await sendTelegramMessage(message);
    }

    start() {
        if (!BRIEFING_CONFIG.enabled) return;
        this.job = schedule.scheduleJob({ hour: 20, minute: 0, tz: BRIEFING_CONFIG.timezone }, () => {
            this.generateBriefing().catch(e => console.error('[BRIEFING] Job failed:', e));
        });
        console.log(`[BRIEFING] Scheduler active: 20:00 ${BRIEFING_CONFIG.timezone}`);
    }

    getStats() {
        return {
            enabled: BRIEFING_CONFIG.enabled,
            totalGenerated: this.stats.totalGenerated,
            lastGenerated: this.stats.lastGenerated,
            nextRun: this.job ? this.job.nextInvocation() : null
        };
    }
}

module.exports = BriefingScheduler;
