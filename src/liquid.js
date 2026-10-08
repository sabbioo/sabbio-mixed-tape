// ============================================================
// BACKGROUND: SHADER FLUIDO MELMOSO REATTIVO (DOMAIN WARP)
// ============================================================

export function initLiquidBackground(canvasId = 'liquid-canvas') {
  const canvas = document.getElementById(canvasId)
  if (!canvas) return

  const gl = canvas.getContext('webgl', { powerPreference: 'low-power', antialias: false })
  if (!gl) return

  const vsSource = `
    attribute vec2 a_pos;
    void main() {
      gl_Position = vec4(a_pos, 0.0, 1.0);
    }
  `

  const fsSource = `
    precision mediump float;
    uniform vec2 u_res;
    uniform float u_time;

    vec2 hash(vec2 p) {
      p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
      return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);

      return mix(
        mix(dot(hash(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
            dot(hash(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
        mix(dot(hash(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
            dot(hash(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
        u.y
      );
    }

    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.55;
      mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
      for (int i = 0; i < 4; i++) {
        v += a * noise(p);
        p = rot * p * 2.15;
        a *= 0.48;
      }
      return v;
    }

    void main() {
      vec2 p = (gl_FragCoord.xy * 2.0 - u_res.xy) / min(u_res.x, u_res.y);

      // Velocità del flusso vischioso
      float t = u_time * 0.12;

      // Matrici di rotazione per far girare e rimescolare i vortici
      mat2 r1 = mat2(cos(t * 0.25), -sin(t * 0.25), sin(t * 0.25), cos(t * 0.25));
      mat2 r2 = mat2(cos(t * 0.18), sin(t * 0.18), -sin(t * 0.18), cos(t * 0.18));

      // 1° livello di deformazione (massa primaria)
      vec2 q = vec2(
        fbm((r1 * p) * 1.1 + vec2(0.0, 1.2) + t * 0.3),
        fbm((r2 * p) * 1.1 + vec2(4.2, 2.7) - t * 0.25)
      );

      // 2° livello di deformazione (pieghe e striature)
      vec2 r = vec2(
        fbm(p * 1.4 + 3.2 * q + vec2(1.7, 9.2) + t * 0.35),
        fbm(p * 1.4 + 3.2 * q + vec2(8.3, 2.8) - t * 0.4)
      );

      // Risultante dell'interferenza melmosa
      float f = fbm(p * 1.3 + 3.5 * r);

      // Palette cromatica ad alto contrasto organico
      vec3 colDeep    = vec3(0.04, 0.05, 0.06);  // Fondo abisso/petrolio
      vec3 colSlime   = vec3(0.08, 0.28, 0.18);  // Verde muschio melmoso vivo
      vec3 colAmber   = vec3(0.36, 0.24, 0.10);  // Oro antico / resina bronzea
      vec3 colHighlight = vec3(0.45, 0.55, 0.40); // Cresta oleosa bagnata

      // Missaggio degli strati di colore in base alla densità
      vec3 col = mix(colDeep, colAmber, clamp(f * 1.6, 0.0, 1.0));
      col = mix(col, colSlime, clamp(length(q) * 0.9, 0.0, 1.0));
      col = mix(col, colHighlight, clamp(pow(r.y, 2.0) * 1.4, 0.0, 1.0));

      // Bagliori lucidi di rifrazione superficiale
      float sheen = pow(clamp(f * 1.3, 0.0, 1.0), 3.5) * 0.65;
      col += vec3(sheen * 0.8, sheen * 1.0, sheen * 0.7);

      // Vignettatura morbida per dare profondità volumetrica
      float vig = 1.0 - smoothstep(0.5, 1.8, length(p * 0.8));
      col *= vig;

      gl_FragColor = vec4(col, 1.0);
    }
  `

  function createShader(type, source) {
    const s = gl.createShader(type)
    gl.shaderSource(s, source)
    gl.compileShader(s)
    return s
  }

  const program = gl.createProgram()
  gl.attachShader(program, createShader(gl.VERTEX_SHADER, vsSource))
  gl.attachShader(program, createShader(gl.FRAGMENT_SHADER, fsSource))
  gl.linkProgram(program)
  gl.useProgram(program)

  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW
  )

  const aPos = gl.getAttribLocation(program, 'a_pos')
  gl.enableVertexAttribArray(aPos)
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

  const uRes = gl.getUniformLocation(program, 'u_res')
  const uTime = gl.getUniformLocation(program, 'u_time')

  function resize() {
    const scale = Math.min(window.devicePixelRatio || 1, 1.5) * 0.75
    canvas.width = Math.floor(window.innerWidth * scale)
    canvas.height = Math.floor(window.innerHeight * scale)
    gl.viewport(0, 0, canvas.width, canvas.height)
  }

  window.addEventListener('resize', resize)
  resize()

  const startTime = performance.now()
  function render() {
    const t = (performance.now() - startTime) * 0.001
    gl.uniform2f(uRes, canvas.width, canvas.height)
    gl.uniform1f(uTime, t)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
    requestAnimationFrame(render)
  }
  render()
}
