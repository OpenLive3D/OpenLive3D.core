// ol3dc/js/effect/fsr.js

const fsrVertexShader = `#version 300 es
in vec3 position;
in vec2 uv;
out vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
}`;

let fsrEASUMaterial = null;
let fsrRCASMaterial = null;

const fsrEASUFragmentShader = `#version 300 es
precision highp float;
uniform sampler2D tDiffuse;
uniform vec2 resolution;      // Final display resolution
uniform vec2 renderResolution;// Internal 3D render resolution
in vec2 vUv;
out vec4 fragColor;

// EASU logic heavily optimized for WebGL2
void main() {
    vec2 inputSize = renderResolution;
    vec2 outputSize = resolution;
    
    vec2 fragCoord = vUv * outputSize;
    vec2 pp = fragCoord * (inputSize / outputSize) - vec2(0.5);
    vec2 fp = floor(pp);
    vec2 f = pp - fp;
    
    vec2 p0 = (fp + vec2(0.5)) / inputSize;
    vec2 d = vec2(1.0) / inputSize;

    // Sample 12-tap window
    vec3 bC = texture(tDiffuse, p0 + vec2(0.0, -1.0) * d).rgb;
    vec3 cC = texture(tDiffuse, p0 + vec2(1.0, -1.0) * d).rgb;
    vec3 dC = texture(tDiffuse, p0 + vec2(-1.0, 0.0) * d).rgb;
    vec3 eC = texture(tDiffuse, p0 + vec2(0.0, 0.0) * d).rgb;
    vec3 fC = texture(tDiffuse, p0 + vec2(1.0, 0.0) * d).rgb;
    vec3 gC = texture(tDiffuse, p0 + vec2(2.0, 0.0) * d).rgb;
    vec3 hC = texture(tDiffuse, p0 + vec2(-1.0, 1.0) * d).rgb;
    vec3 iC = texture(tDiffuse, p0 + vec2(0.0, 1.0) * d).rgb;
    vec3 jC = texture(tDiffuse, p0 + vec2(1.0, 1.0) * d).rgb;
    vec3 kC = texture(tDiffuse, p0 + vec2(2.0, 1.0) * d).rgb;
    vec3 lC = texture(tDiffuse, p0 + vec2(0.0, 2.0) * d).rgb;
    vec3 mC = texture(tDiffuse, p0 + vec2(1.0, 2.0) * d).rgb;

    // Luma approximation
    float bL = bC.g + 0.5 * (bC.r + bC.b);
    float cL = cC.g + 0.5 * (cC.r + cC.b);
    float dL = dC.g + 0.5 * (dC.r + dC.b);
    float eL = eC.g + 0.5 * (eC.r + eC.b);
    float fL = fC.g + 0.5 * (fC.r + fC.b);
    float gL = gC.g + 0.5 * (gC.r + gC.b);
    float hL = hC.g + 0.5 * (hC.r + hC.b);
    float iL = iC.g + 0.5 * (iC.r + iC.b);
    float jL = jC.g + 0.5 * (jC.r + jC.b);
    float kL = kC.g + 0.5 * (kC.r + kC.b);
    float lL = lC.g + 0.5 * (lC.r + lC.b);
    float mL = mC.g + 0.5 * (mC.r + mC.b);

    // Gradients
    float dirX = -bL + cL - eL + fL - iL + jL;
    float dirY = -dL - eL - hL + fL + gL + jL;
    vec2 dir = vec2(dirX, dirY);
    
    float len = length(dir);
    if (len > 0.0) dir /= len;
    
    float maxLuma = max(max(eL, fL), max(iL, jL));
    float weight = maxLuma > 1e-5 ? clamp(len / maxLuma, 0.0, 1.0) : 0.0;
    weight *= weight;

    // Bilinear fallback for non-edge
    vec3 color = eC * (1.0 - f.x) * (1.0 - f.y) + fC * f.x * (1.0 - f.y) + iC * (1.0 - f.x) * f.y + jC * f.x * f.y;

    // Edge reconstruction (simplified to save GPU bandwidth)
    color = mix(color, (eC + fC + iC + jC) * 0.25, weight * 0.5);

    float a = texture(tDiffuse, vUv).a;
    fragColor = vec4(color, a);
} `;

const fsrRCASFragmentShader = `#version 300 es
precision highp float;
uniform sampler2D tDiffuse;
uniform vec2 resolution;
uniform float sharpness;
in vec2 vUv;
out vec4 fragColor;

vec3 linearToSRGB(vec3 color) {
    return mix(color * 12.92, 1.055 * pow(color, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, color));
}

// RCAS logic heavily optimized for WebGL2
void main() {
    vec2 d = vec2(1.0) / resolution;
    
    vec3 b = texture(tDiffuse, vUv + vec2( 0.0, -1.0) * d).rgb;
    vec3 dC = texture(tDiffuse, vUv + vec2(-1.0,  0.0) * d).rgb;
    vec3 e = texture(tDiffuse, vUv).rgb;
    vec3 f = texture(tDiffuse, vUv + vec2( 1.0,  0.0) * d).rgb;
    vec3 h = texture(tDiffuse, vUv + vec2( 0.0,  1.0) * d).rgb;
    
    float bL = b.g + 0.5 * (b.r + b.b);
    float dL = dC.g + 0.5 * (dC.r + dC.b);
    float eL = e.g + 0.5 * (e.r + e.b);
    float fL = f.g + 0.5 * (f.r + f.b);
    float hL = h.g + 0.5 * (h.r + h.b);
    
    float minL = min(eL, min(min(bL, dL), min(fL, hL)));
    float maxL = max(eL, max(max(bL, dL), max(fL, hL)));
    float limit = min(eL - minL, maxL - eL);
    
    float w = limit / (maxL + 1e-5);
    w = clamp(w, 0.0, 1.0);
    
    float s = exp2(-sharpness); 
    w = w * s * 0.5;
    
    vec3 color = (b + dC + f + h) * (-w) + e;
    color /= max(0.001, (1.0 - 4.0 * w));
    
    // Convert to sRGB to fix washed-out colors
    color = linearToSRGB(color);
    
    float a = texture(tDiffuse, vUv).a;
    fragColor = vec4(clamp(color, 0.0, 1.0), a);
} `;

function setupFSR(displayW, displayH, renderW, renderH) {
    if (!fsrEASUMaterial) {
        // Use RawShaderMaterial because we are using raw #version 300 es GLSL3
        fsrEASUMaterial = new THREE.RawShaderMaterial({
            uniforms: {
                tDiffuse: {
                    value: null
                },
                resolution: {
                    value: new THREE.Vector2(displayW, displayH)
                },
                renderResolution: {
                    value: new THREE.Vector2(renderW, renderH)
                }
            },
            vertexShader: fsrVertexShader,
            fragmentShader: fsrEASUFragmentShader,
            side: THREE.DoubleSide,
            depthTest: false,
            depthWrite: false,
            blending: THREE.NoBlending
        });
    } else {
        fsrEASUMaterial.uniforms.resolution.value.set(displayW, displayH);
        fsrEASUMaterial.uniforms.renderResolution.value.set(renderW, renderH);
    }

    if (!fsrRCASMaterial) {
        fsrRCASMaterial = new THREE.RawShaderMaterial({
            uniforms: {
                tDiffuse: {
                    value: null
                },
                resolution: {
                    value: new THREE.Vector2(displayW, displayH)
                },
                sharpness: {
                    value: 0.2
                }
            },
            vertexShader: fsrVertexShader,
            fragmentShader: fsrRCASFragmentShader,
            side: THREE.DoubleSide,
            depthTest: false,
            depthWrite: false,
            blending: THREE.NoBlending
        });
    } else {
        fsrRCASMaterial.uniforms.resolution.value.set(displayW, displayH);
    }
}
