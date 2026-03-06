# 🛰️ SENTINEL OMEGA

**Real-Time Geospatial Intelligence Dashboard**

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Status](https://img.shields.io/badge/status-Production-success.svg)]()

## 📋 Overview

SENTINEL OMEGA is a sophisticated real-time geospatial intelligence platform that combines military aircraft tracking (ADS-B), maritime vessel monitoring (AIS), and satellite constellation tracking into a unified 3D visualization dashboard powered by CesiumJS.

### Key Features

- 🛩️ **Multi-Source Intelligence**
  - ADS-B Military Aircraft Tracking
  - AIS Maritime Vessel Monitoring
  - Multi-Constellation Satellite Tracking

- 🌍 **3D Visualization**
  - CesiumJS-powered globe rendering
  - Real-time position updates
  - Predictive intercept path calculation
  - Cinematic camera controls

- 🎯 **Intelligence Analysis**
  - Automatic target classification
  - Spoofing detection via confidence scoring
  - ADIZ boundary monitoring
  - Threat level assessment

- 📊 **Automated Reporting**
  - Daily strategic briefings (20:00 WIB)
  - Telegram alert integration
  - OMEGA Protocol: RAM-only intelligence buffer

- 🔒 **Security & Reliability**
  - Input validation & sanitization
  - Rate limiting
  - API key management
  - Health monitoring

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Valid API keys (Cesium, AIS Stream)

### Installation
```bash
# Clone repository
git clone <repository-url>
cd sentinel-omega

# Install dependencies
npm install

# Setup environment
cp .env.example .env
nano .env  # Add your API keys

# Validate configuration
npm run validate

# Start development server
npm run dev
```

Visit `http://localhost:8888`

## 📖 Documentation

- [User Guide](docs/USER_GUIDE.md) - Dashboard operation manual
- [Developer Guide](docs/DEVELOPER_GUIDE.md) - Architecture & maintenance
- [API Documentation](docs/API.md) - Endpoint reference
- [Deployment Guide](docs/DEPLOYMENT.md) - Production setup
- [Thesis Integration](docs/THESIS_INTEGRATION.md) - AI Literacy Case Studies

## 🏗️ Architecture
```
sentinel-omega/
├── asset-tracker/        # Modular tracking system
│   ├── index.js         # Main entry point
│   ├── adsb-handler.js  # ADS-B data processing
│   ├── ais-handler.js   # AIS data processing
│   ├── confidence-engine.js
│   └── trail-manager.js
├── security/            # Security modules
├── tests/              # Test suites
├── briefings/          # Generated reports
├── map.js             # Cesium visualization
├── server.js          # Express server
└── index.html         # Frontend UI
```

## 🧪 Testing
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## 🔐 Security

See [SECURITY.md](SECURITY.md) for security policies and best practices.

## 📊 Performance

- **Real-time Updates**: 15-second ADS-B polling
- **Asset Limit**: 200 concurrent live assets
- **Memory Efficient**: DOM caching + trail optimization
- **Uptime**: 99.9% target (health monitoring)

## 🎓 Academic Context

This project was developed as part of a thesis on **AI Literacy in Non-Technical Domains** at Universitas Sriwijaya, demonstrating how AI tools (Gemini CLI) can empower non-technical students to build production-grade applications.

**Key Contributions:**
- Prompt engineering methodology
- AI-assisted debugging workflows
- Multimodal learning integration

## 📝 License

MIT License - see [LICENSE](LICENSE) file

## 🙏 Acknowledgments

- Data Sources: ADS-B Exchange, AIS Stream
- Technologies: CesiumJS, Node.js, Express
- AI Assistance: Google Gemini CLI
- Institution: Universitas Sriwijaya

## 📞 Contact

**Developer:** Oktavian Triantoko
**Email:** otriantoko@gmail.com
**Institution:** Universitas Sriwijaya, English Education

---

*Built with ❤️ for the advancement of AI literacy in education*
