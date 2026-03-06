// Environment validation script

const REQUIRED_VARS = [
  'NODE_ENV',
  'PORT',
  'CESIUM_ACCESS_TOKEN'
];

const OPTIONAL_VARS = {
  'AISSTREAM_API_KEY': 'AIS features will be disabled',
  'TELEGRAM_BOT_TOKEN': 'Telegram alerts will be disabled',
  'ENABLE_DAILY_BRIEFING': 'Defaults to true'
};

function validateEnv() {
  console.log('🔍 Validating environment configuration...\n');
  
  const missing = [];
  const warnings = [];
  
  // Check required vars
  for (const varName of REQUIRED_VARS) {
    if (!process.env[varName]) {
      missing.push(varName);
    } else {
      console.log(`✅ ${varName}: OK`);
    }
  }
  
  // Check optional vars
  for (const [varName, message] of Object.entries(OPTIONAL_VARS)) {
    if (!process.env[varName]) {
      warnings.push(`⚠️  ${varName}: Not set - ${message}`);
    } else {
      console.log(`✅ ${varName}: OK`);
    }
  }
  
  console.log('');
  
  // Print warnings
  if (warnings.length > 0) {
    console.log('⚠️  WARNINGS:');
    warnings.forEach(w => console.log(w));
    console.log('');
  }
  
  // Check for errors
  if (missing.length > 0) {
    console.error('❌ MISSING REQUIRED VARIABLES:');
    missing.forEach(v => console.error(`   - ${v}`));
    console.error('\nPlease set these variables in your .env file');
    process.exit(1);
  }
  
  console.log('✅ Environment validation passed!\n');
}

// Run if called directly
if (require.main === module) {
  // Try to load dotenv if available, but don't fail if not (production might have real env vars)
  try {
    require('dotenv').config();
  } catch (e) {}
  validateEnv();
}

module.exports = { validateEnv };
