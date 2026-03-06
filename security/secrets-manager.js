/**
 * @file secrets-manager.js
 * @description API key management and rotation for secure tactical access.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class SecretsManager {
  constructor() {
    this.secretsFile = path.join(process.cwd(), '.secrets.json');
    this.secrets = this.loadSecrets();
  }
  
  loadSecrets() {
    try {
      if (fs.existsSync(this.secretsFile)) {
        const data = fs.readFileSync(this.secretsFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('[SECRETS] Failed to load secrets:', error.message);
    }
    
    return {
      apiKeys: {},
      rotationHistory: []
    };
  }
  
  saveSecrets() {
    try {
      fs.writeFileSync(
        this.secretsFile, 
        JSON.stringify(this.secrets, null, 2),
        { mode: 0o600 } // Secure permission: owner only
      );
    } catch (error) {
      console.error('[SECRETS] Failed to save secrets:', error.message);
    }
  }
  
  generateAPIKey(name) {
    const key = crypto.randomBytes(32).toString('base64url');
    
    this.secrets.apiKeys[name] = {
      key: key,
      created: new Date().toISOString(),
      lastUsed: null,
      usageCount: 0
    };
    
    this.saveSecrets();
    
    console.log(`[SECRETS] Generated new API key for: \${name}`);
    return key;
  }
  
  rotateAPIKey(name) {
    const oldKey = this.secrets.apiKeys[name];
    
    if (!oldKey) {
      throw new Error(`API key \${name} not found`);
    }
    
    // Save to rotation history
    this.secrets.rotationHistory.push({
      name: name,
      oldKey: oldKey.key,
      rotatedAt: new Date().toISOString(),
      reason: 'Manual rotation'
    });
    
    // Generate new key
    const newKey = this.generateAPIKey(name);
    
    console.log(`[SECRETS] Rotated API key: \${name}`);
    
    return {
      oldKey: oldKey.key,
      newKey: newKey
    };
  }
  
  validateAPIKey(name, providedKey) {
    const stored = this.secrets.apiKeys[name];
    
    if (!stored) return false;
    
    const valid = stored.key === providedKey;
    
    if (valid) {
      stored.lastUsed = new Date().toISOString();
      stored.usageCount++;
      this.saveSecrets();
    }
    
    return valid;
  }
  
  getKeyInfo(name) {
    return this.secrets.apiKeys[name] || null;
  }
}

module.exports = new SecretsManager();
