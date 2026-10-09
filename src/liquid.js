// ============================================================
// BACKGROUND: WATERFALL SPETTROGRAMMA 3D AUDIO-REATTIVO
// Stile CP 1919 / Unknown Pleasures con LERP colore tra Side A e B
// ============================================================

export function initLiquidBackground(canvasId = 'liquid-canvas', options = {}) {
  const canvas = document.getElementById(canvasId)
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  let width = 0
  let height = 0

  function resize() {
    width = window.innerWidth
    height = window.innerHeight
    canvas.width = width
    canvas.height = height
  }
  window.addEventListener('resize', resize)
  resize()

  const NUM_LINES = 42
  const POINTS_PER_LINE = 64

  // Buffer storico delle sezioni spettrali
  const history = Array.from({ length: NUM_LINES }, () => new Float32Array(POINTS_PER_LINE))

  // Palette colori
  const COLOR_SIDE_A = { r: 212, g: 163, b: 115 } // Oro / ambra ossido
  const COLOR_SIDE_B = { r: 40,  g: 150, b: 255 } // Blu cobalto / ciano elettrico
  const currentColor = { ...COLOR_SIDE_A }

  let lastSampleTime = 0
  const sampleIntervalMs = 45

  function draw(now) {
    requestAnimationFrame(draw)

    let analyser = null
    try {
      analyser = options.getAnalyser ? options.getAnalyser() : null
    } catch (_) {}

    let currentSide = 'A'
    try {
      currentSide = options.getSide ? options.getSide() : 'A'
    } catch (_) {}

    // 1. Interpolazione colore fluida tra Lato A e Lato B
    const targetColor = currentSide === 'B' ? COLOR_SIDE_B : COLOR_SIDE_A
    currentColor.r += (targetColor.r - currentColor.r) * 0.05
    currentColor.g += (targetColor.g - currentColor.g) * 0.05
    currentColor.b += (targetColor.b - currentColor.b) * 0.05

    // 2. Acquisizione e avanzamento dello spettro audio
    if (now - lastSampleTime > sampleIntervalMs) {
      lastSampleTime = now

      const newSlice = new Float32Array(POINTS_PER_LINE)

      if (analyser) {
        const binCount = analyser.frequencyBinCount
        const freqData = new Uint8Array(binCount)
        analyser.getByteFrequencyData(freqData)

        for (let j = 0; j < POINTS_PER_LINE; j++) {
          const p = j / (POINTS_PER_LINE - 1)
          const bell = Math.exp(-Math.pow((p - 0.5) / 0.22, 2))

          const freqIndex = Math.min(
            binCount - 1,
            Math.floor(Math.pow(p, 1.8) * (binCount * 0.75))
          )
          const energy = freqData[freqIndex] / 255.0

          const idleWave = Math.sin(p * 12.0 + now * 0.002) * 0.04
          newSlice[j] = Math.max(0, (energy * 1.45 + idleWave) * bell)
        }
      } else {
        // Fruscio a nastro fermo
        for (let j = 0; j < POINTS_PER_LINE; j++) {
          const p = j / (POINTS_PER_LINE - 1)
          const bell = Math.exp(-Math.pow((p - 0.5) / 0.22, 2))
          newSlice[j] = Math.max(0, (Math.sin(p * 8.0 + now * 0.0015) * 0.06 + 0.02) * bell)
        }
      }

      history.unshift(newSlice)
      history.pop()
    }

    // 3. Rendering grafico a schermo
    ctx.fillStyle = '#040506'
    ctx.fillRect(0, 0, width, height)

    const startY = height * 0.12
    const endY = height * 0.94
    const totalSpanY = endY - startY
    const stepY = totalSpanY / NUM_LINES

    for (let i = 0; i < NUM_LINES; i++) {
      const lineProg = i / (NUM_LINES - 1)
      const baseY = startY + i * stepY

      const marginX = width * (0.16 - lineProg * 0.07)
      const spanX = width - marginX * 2
      const maxAltitude = 35 + lineProg * 85

      const sliceData = history[i]
      const coords = []

      for (let j = 0; j < POINTS_PER_LINE; j++) {
        const p = j / (POINTS_PER_LINE - 1)
        const currentX = marginX + p * spanX
        const altitude = sliceData[j] * maxAltitude
        const currentY = baseY - altitude

        coords.push({ x: currentX, y: currentY })
      }

      // Maschera occlusiva nera sotto la linea (volume 3D)
      ctx.beginPath()
      ctx.moveTo(marginX, baseY)
      for (let j = 0; j < coords.length; j++) {
        ctx.lineTo(coords[j].x, coords[j].y)
      }
      ctx.lineTo(width - marginX, height)
      ctx.lineTo(marginX, height)
      ctx.closePath()
      ctx.fillStyle = '#040506'
      ctx.fill()

      // Cresta spettrale
      ctx.beginPath()
      for (let j = 0; j < coords.length; j++) {
        if (j === 0) ctx.moveTo(coords[j].x, coords[j].y)
        else ctx.lineTo(coords[j].x, coords[j].y)
      }

      const alpha = 0.20 + lineProg * 0.75
      ctx.strokeStyle = `rgba(${Math.round(currentColor.r)}, ${Math.round(currentColor.g)}, ${Math.round(currentColor.b)}, ${alpha})`
      ctx.lineWidth = 1.35
      ctx.stroke()
    }
  }

  draw(performance.now())
}
