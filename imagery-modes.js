// imagery-modes.js — EO/FLIR/CRT Imaging Mode System
// Provides classified intelligence system visual modes for the Cesium viewer

const IMAGERY_MODES = {
    STANDARD: {
        id: 'standard',
        label: 'EO STANDARD',
        description: 'Electro-Optical Standard Imagery',
        cssFilter: 'saturate(0.4) contrast(1.2) sepia(0.2) hue-rotate(180deg) brightness(0.8)',
        postProcess: null,
        hudColor: '#00ff41',
        classification: 'UNCLASSIFIED'
    },
    THERMAL: {
        id: 'thermal',
        label: 'FLIR / THERMAL',
        description: 'Forward-Looking Infrared',
        cssFilter: 'none',
        postProcess: 'thermal',
        hudColor: '#ff9100',
        classification: 'SECRET'
    },
    NIGHT_VISION: {
        id: 'nightvision',
        label: 'NVG / LOW-LIGHT',
        description: 'Night Vision Green Phosphor',
        cssFilter: 'none',
        postProcess: 'nightvision',
        hudColor: '#00ff41',
        classification: 'SECRET'
    },
    CRT: {
        id: 'crt',
        label: 'CRT TERMINAL',
        description: 'Cathode Ray Tube Monitor Emulation',
        cssFilter: 'none',
        postProcess: 'crt',
        hudColor: '#00ff41',
        classification: 'TOP SECRET'
    },
    SAR: {
        id: 'sar',
        label: 'SAR RADAR',
        description: 'Synthetic Aperture Radar',
        cssFilter: 'none',
        postProcess: 'sar',
        hudColor: '#00e5ff',
        classification: 'SECRET'
    },
    MULTISPECTRAL: {
        id: 'multispectral',
        label: 'MSI / NDVI',
        description: 'Multispectral False Color Composite',
        cssFilter: 'none',
        postProcess: 'multispectral',
        hudColor: '#c882ff',
        classification: 'CONFIDENTIAL'
    }
};

// GLSL shader fragments for each mode
const SHADER_LIBRARY = {
    thermal: `
        uniform sampler2D colorTexture;
        in vec2 v_textureCoordinates;
        out vec4 fragColor;
        void main(void) {
            vec4 color = texture(colorTexture, v_textureCoordinates);
            float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
            
            // Iron palette thermal mapping
            vec3 thermal;
            if (luminance < 0.25) {
                thermal = mix(vec3(0.0, 0.0, 0.2), vec3(0.5, 0.0, 0.5), luminance * 4.0);
            } else if (luminance < 0.5) {
                thermal = mix(vec3(0.5, 0.0, 0.5), vec3(1.0, 0.3, 0.0), (luminance - 0.25) * 4.0);
            } else if (luminance < 0.75) {
                thermal = mix(vec3(1.0, 0.3, 0.0), vec3(1.0, 0.8, 0.0), (luminance - 0.5) * 4.0);
            } else {
                thermal = mix(vec3(1.0, 0.8, 0.0), vec3(1.0, 1.0, 0.9), (luminance - 0.75) * 4.0);
            }
            
            // Hot spots glow
            float hotspot = smoothstep(0.7, 1.0, luminance);
            thermal += vec3(hotspot * 0.3, hotspot * 0.1, 0.0);
            
            fragColor = vec4(thermal, 1.0);
        }
    `,
    nightvision: `
        uniform sampler2D colorTexture;
        uniform float time;
        in vec2 v_textureCoordinates;
        out vec4 fragColor;
        void main(void) {
            vec4 color = texture(colorTexture, v_textureCoordinates);
            float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
            
            // Green phosphor with gain
            float gain = luminance * 2.2;
            gain = min(gain, 1.0);
            
            // Noise grain simulation
            float noise = fract(sin(dot(v_textureCoordinates * 543.21, vec2(12.9898, 78.233))) * 43758.5453);
            gain += (noise - 0.5) * 0.06;
            
            // Vignette
            vec2 center = v_textureCoordinates - vec2(0.5);
            float vignette = 1.0 - dot(center, center) * 1.5;
            gain *= vignette;
            
            // Green phosphor color
            vec3 nvg = vec3(gain * 0.15, gain * 1.0, gain * 0.15);
            
            fragColor = vec4(nvg, 1.0);
        }
    `,
    crt: `
        uniform sampler2D colorTexture;
        uniform float time;
        in vec2 v_textureCoordinates;
        out vec4 fragColor;
        void main(void) {
            vec2 uv = v_textureCoordinates;
            
            // CRT barrel distortion
            vec2 center = uv - 0.5;
            float r = length(center);
            float distortion = 1.0 + r * r * 0.15;
            uv = center * distortion + 0.5;
            
            // Check bounds
            if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
                fragColor = vec4(0.0, 0.0, 0.0, 1.0);
                return;
            }
            
            vec4 color = texture(colorTexture, uv);
            float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
            
            // Scanlines
            float scanline = sin(uv.y * 800.0) * 0.08;
            luminance -= scanline;
            
            // Green phosphor
            vec3 crt = vec3(luminance * 0.1, luminance * 0.9, luminance * 0.2);
            
            // Flicker
            float flicker = 0.97 + 0.03 * sin(time * 8.0);
            crt *= flicker;
            
            // Vignette
            float vig = 1.0 - r * r * 2.0;
            crt *= max(vig, 0.0);
            
            // RGB shadow mask
            float pixelX = fract(uv.x * 400.0);
            if (pixelX < 0.33) crt.r *= 1.3;
            else if (pixelX < 0.66) crt.g *= 1.3;
            else crt.b *= 1.3;
            
            fragColor = vec4(crt, 1.0);
        }
    `,
    sar: `
        uniform sampler2D colorTexture;
        in vec2 v_textureCoordinates;
        out vec4 fragColor;
        void main(void) {
            vec4 color = texture(colorTexture, v_textureCoordinates);
            float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
            
            // SAR speckle noise
            float speckle = fract(sin(dot(v_textureCoordinates * 100.0, vec2(12.9898, 78.233))) * 43758.5453);
            luminance *= (0.8 + speckle * 0.4);
            
            // Grayscale with slight blue tint (radar return)
            vec3 sar = vec3(luminance * 0.85, luminance * 0.9, luminance * 1.0);
            
            // Edge enhancement
            vec4 left = texture(colorTexture, v_textureCoordinates + vec2(-0.001, 0.0));
            vec4 right = texture(colorTexture, v_textureCoordinates + vec2(0.001, 0.0));
            float edge = abs(dot(right.rgb - left.rgb, vec3(1.0)));
            sar += vec3(edge * 0.3);
            
            fragColor = vec4(sar, 1.0);
        }
    `,
    multispectral: `
        uniform sampler2D colorTexture;
        in vec2 v_textureCoordinates;
        out vec4 fragColor;
        void main(void) {
            vec4 color = texture(colorTexture, v_textureCoordinates);
            
            // False color composite (NIR-R-G -> R-G-B)
            float nir = dot(color.rgb, vec3(0.1, 0.8, 0.1)); // Simulate NIR from green
            float red = color.r;
            float green = color.g;
            
            // NDVI-like vegetation highlighting
            float ndvi = (nir - red) / max(nir + red, 0.001);
            
            vec3 falseColor;
            if (ndvi > 0.3) {
                // Vegetation - bright red
                falseColor = vec3(0.9, 0.2, 0.1) * (0.5 + ndvi);
            } else if (ndvi > 0.0) {
                // Sparse vegetation - yellow/orange
                falseColor = vec3(0.8, 0.6, 0.2);
            } else {
                // Water/urban - blue/cyan
                float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
                falseColor = vec3(0.1, 0.3 + luminance * 0.4, 0.5 + luminance * 0.5);
            }
            
            fragColor = vec4(falseColor, 1.0);
        }
    `
};

class ImageryModeSystem {
    constructor() {
        this.currentMode = 'standard';
        this.stages = {};
        this.initialized = false;
        this.hudOverlay = null;
    }

    init(viewer) {
        if (!viewer || this.initialized) return;

        // Create post-process stages for each shader
        Object.entries(SHADER_LIBRARY).forEach(([key, shader]) => {
            try {
                const stage = new Cesium.PostProcessStage({
                    fragmentShader: shader,
                    uniforms: key === 'nightvision' || key === 'crt' ? { time: 0.0 } : {}
                });
                viewer.scene.postProcessStages.add(stage);
                stage.enabled = false;
                this.stages[key] = stage;
            } catch (e) {
                console.warn(`[IMAGERY] Failed to create ${key} shader:`, e.message);
            }
        });

        // Time uniform updater for animated shaders
        viewer.scene.preUpdate.addEventListener((scene, time) => {
            const t = performance.now() / 1000.0;
            if (this.stages.nightvision && this.stages.nightvision.uniforms) {
                this.stages.nightvision.uniforms.time = t;
            }
            if (this.stages.crt && this.stages.crt.uniforms) {
                this.stages.crt.uniforms.time = t;
            }
        });

        this.initialized = true;
        this._createHUDOverlay();
    }

    setMode(modeId) {
        const mode = Object.values(IMAGERY_MODES).find(m => m.id === modeId);
        if (!mode) return;

        this.currentMode = modeId;

        // Disable all post-process stages
        Object.values(this.stages).forEach(s => { if (s) s.enabled = false; });

        // Apply CSS filter
        const mapContainer = document.getElementById('satellite-map');
        if (mapContainer) {
            mapContainer.style.filter = mode.cssFilter || 'none';
        }

        // Enable specific post-process
        if (mode.postProcess && this.stages[mode.postProcess]) {
            this.stages[mode.postProcess].enabled = true;
        }

        // Update HUD
        this._updateHUD(mode);
        this._updateModeButtons(modeId);

        console.log(`[IMAGERY] Mode switched to: ${mode.label}`);
    }

    getCurrentMode() {
        return Object.values(IMAGERY_MODES).find(m => m.id === this.currentMode) || IMAGERY_MODES.STANDARD;
    }

    getModes() {
        return Object.values(IMAGERY_MODES);
    }

    _createHUDOverlay() {
        let hud = document.getElementById('imagery-hud');
        if (!hud) {
            hud = document.createElement('div');
            hud.id = 'imagery-hud';
            hud.className = 'imagery-hud';
            const mapContainer = document.getElementById('map-container');
            if (mapContainer) mapContainer.appendChild(hud);
        }
        this.hudOverlay = hud;
        this._updateHUD(IMAGERY_MODES.STANDARD);
    }

    _updateHUD(mode) {
        if (!this.hudOverlay) return;

        const now = new Date();
        this.hudOverlay.innerHTML = `
            <div class="hud-top-left" style="color:${mode.hudColor}">
                <div class="hud-mode-label">${mode.label}</div>
                <div class="hud-classification">${mode.classification}</div>
            </div>
            <div class="hud-top-right" style="color:${mode.hudColor}">
                <div class="hud-timestamp">${now.toISOString().replace('T', ' ').split('.')[0]}Z</div>
                <div class="hud-gain">GAIN: AUTO</div>
            </div>
            <div class="hud-bottom-left" style="color:${mode.hudColor}">
                <div class="hud-fov">FOV: 24.5°</div>
                <div class="hud-zoom">ZOOM: 1.0x</div>
            </div>
            <div class="hud-bottom-right" style="color:${mode.hudColor}">
                <div class="hud-reticle">◎</div>
            </div>
            <div class="hud-crosshair" style="border-color:${mode.hudColor}40"></div>
        `;

        // Update HUD timestamp every second
        if (this._hudTimer) clearInterval(this._hudTimer);
        this._hudTimer = setInterval(() => {
            const ts = this.hudOverlay?.querySelector('.hud-timestamp');
            if (ts) ts.textContent = new Date().toISOString().replace('T', ' ').split('.')[0] + 'Z';
        }, 1000);

        this.hudOverlay.style.display = 'block';
    }

    _updateModeButtons(activeId) {
        document.querySelectorAll('.imagery-mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === activeId);
        });
    }
}

window.ImageryModes = new ImageryModeSystem();
export default window.ImageryModes;
