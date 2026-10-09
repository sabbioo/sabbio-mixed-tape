import { initStrudel, getAudioContext } from '@strudel/web'
import './style.css'
import { initLiquidBackground } from './liquid.js'

// Inizializza lo sfondo fluido melmoso

// Inizializza lo sfondo waterfall collegato a motore audio e lato cassetta
initLiquidBackground('liquid-canvas', {
  getAnalyser: () => analyserNode,
  getSide: () => currentSide
})

// ============================================================
// HOOK WEBAUDIO: INTERCETTAZIONE DIRETTA DEL MASTER STRUDEL
// ============================================================

let analyserNode = null

const originalConnect = AudioNode.prototype.connect
AudioNode.prototype.connect = function (target, ...args) {
  if (target && (target instanceof AudioDestinationNode || target === this.context?.destination)) {
    if (!analyserNode && this.context) {
      analyserNode = this.context.createAnalyser()
      analyserNode.fftSize = 1024
      analyserNode.smoothingTimeConstant = 0.8
    }
    if (analyserNode && this !== analyserNode && this.context === analyserNode.context) {
      try {
        originalConnect.call(this, analyserNode)
      } catch (_) {}
    }
  }
  return originalConnect.call(this, target, ...args)
}

initStrudel()

const runButton = document.querySelector('#run')
const playButton = document.querySelector('#play')
const stopButton = document.querySelector('#stop')
const flipButton = document.querySelector('#flip')
const output = document.querySelector('#output')
const canvas = document.querySelector('#spectrum')
const cassetteEl = document.querySelector('.cassette')
const tapeWindow = document.querySelector('.tape-window')
const sideBadge = document.querySelector('.side-badge')
const formatBadge = document.querySelector('.format-badge')
const speedBadge = document.querySelector('.speed-badge')
const tapeSubtitle = document.querySelector('.tape-subtitle')
const ctx = canvas.getContext('2d')

if (playButton) playButton.innerHTML = '<span class="icon">↻</span> RIGENERA'

let sysAudioContext

// Stato globale della cassetta
let currentSide = 'A' // 'A' o 'B'
let genereBSelezionato = null
let tonalitaAttuale = 'C'
let scalaAttuale = 'dorian'
let nomeWavAttuale = '.wav'
let durataLatoBSec = 75.0

// Inizializza lo sfondo waterfall collegato a motore audio e lato cassetta
initLiquidBackground('liquid-canvas', {
  getAnalyser: () => analyserNode,
  getSide: () => currentSide
})

// ============================================================
// NOMI
// ============================================================

function generaNomeWav() {
  const moduli = [
    '0x7FF0_MEMDUMP',
    'COME_MAI_SE_POSSO_0x08048',
    'SYS_IRQ07_0x9F4B',
    'ELECTROSABBA_A0FE',
    '0x_STREAM',
    'BUFFER_0x2A7C_RAW',
    'X86_REG_0x00FF82',
    '_0x4B12',
    '_0x03E8_CORE',
    'SODEEPLY_0x',
    '_0x5F2D',
    'CAROLINA_REAPER_0x0B00',
    'MMMMHHHHHHHH_0x1C8A',
    'MUNE_NO_OKU_NI_ISTUITERU_MERODII_0xFE90',
    'MEM_0x004000',
    'FANCULO_MONETA'
  ]
  const tag = ['v1', 'v2', 'dbg', 'rel', 'dump', 'raw', 'hex', 'bin']
  const m = moduli[Math.floor(Math.random() * moduli.length)]
  const t = tag[Math.floor(Math.random() * tag.length)]
  const hex = Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, '0')
  return `${m}_${t}_0x${hex}.wav`
}

// ============================================================
// OSCILLOSCOPIO CRT REATTIVO
// ============================================================

function drawOscilloscope() {
  requestAnimationFrame(drawOscilloscope)

  const width = canvas.width
  const height = canvas.height

  ctx.fillStyle = '#030a08'
  ctx.fillRect(0, 0, width, height)

  ctx.strokeStyle = 'rgba(0, 255, 170, 0.12)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, height / 2)
  ctx.lineTo(width, height / 2)
  ctx.stroke()

  let hasSignal = false
  let dataArray = null

  if (analyserNode) {
    const bufferLength = analyserNode.frequencyBinCount
    dataArray = new Uint8Array(bufferLength)
    analyserNode.getByteTimeDomainData(dataArray)

    for (let i = 0; i < bufferLength; i++) {
      if (Math.abs(dataArray[i] - 128) > 2) {
        hasSignal = true
        break
      }
    }
  }

  ctx.lineWidth = 2.5
  ctx.strokeStyle = '#00ffaa'
  ctx.shadowBlur = 8
  ctx.shadowColor = '#00ffaa'
  ctx.beginPath()

  if (hasSignal && dataArray) {
    const bufferLength = dataArray.length
    const sliceWidth = width / bufferLength
    let x = 0

    for (let i = 0; i < bufferLength; i++) {
      const deviation = (dataArray[i] - 128) / 128.0
      const amplified = deviation * 3.5
      const y = height / 2 + amplified * (height / 2)

      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
      x += sliceWidth
    }
  } else {
    const sliceWidth = width / 80
    let x = 0
    for (let i = 0; i <= 80; i++) {
      const jitter = (Math.random() - 0.5) * 1.5
      const y = height / 2 + jitter
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
      x += sliceWidth
    }
  }

  ctx.stroke()
  ctx.shadowBlur = 0
}

drawOscilloscope()

// ============================================================
// TONALITÀ E SCALE PER IL LATO B (INVISIBILI A SCHERMO)
// ============================================================

const RADICI = ['C', 'D', 'Eb', 'F', 'G', 'A', 'Bb']

function estraiTonalita() {
  return RADICI[Math.floor(Math.random() * RADICI.length)]
}

// ============================================================
// MOTORE BATTERIA SINTETICA ANALOGICA (ZERO RETE, 100% AFFIDABILE)
// ============================================================

function creaBatteria(kPat, snPat, hhPat, percPat = "~") {
  const kick = note(kPat).s("sine")
    .decay(0.24).sustain(0)
    .gain(1.4)

  const snareNoise = note(snPat).s("white")
    .decay(0.15).sustain(0)
    .lpf(4200).hpf(700)
    .gain(0.85)

  const snareBody = note(snPat).s("triangle")
    .decay(0.08).sustain(0)
    .gain(0.7)

  const hats = note(hhPat).s("white")
    .decay(0.04).sustain(0)
    .hpf(7000)
    .gain(0.6)

  const perc = note(percPat).s("square")
    .decay(0.10).sustain(0)
    .lpf(2600).hpf(600)
    .gain(0.55)

  return stack(kick, snareNoise, snareBody, hats, perc)
}

// ============================================================
// 6 GENERI MUSICALI LATO B CON SCELTA CASUALE
// ============================================================

const GENERI_LATO_B = [
  // 1. ELEKTROFUNK
  {
    id: 'elektrofunk',
    tempo: '124 BPM',
    cps: 1.03,
    badge: 'TYPE II / CrO₂',
    scaleCompatibili: ['dorian', 'minor'],
    creaPattern: (root, scaleName) => {
      const drums = creaBatteria(
        "<[c1 ~] [~ c1] [c1 ~] [~ c1]>",
        "<~ [c2 ~] ~ [c2 c2?]>",
        "<c4*16>",
        "<~ [d5 ~] ~ [d5 d5]>"
      )

      const bass = n("<[0 0 12 7] [0 12 10 12] [0 0 12 7] [10 12 7 5]>*2")
        .scale(`${root}1:${scaleName}`)
        .s("sawtooth")
        .decay(0.14).sustain(0.05)
        .lpf(sine.range(400, 2400).slow(4))
        .lpq(8)
        .gain(0.85)

      const stabs = n("<~ [0,3,7] ~ [0,3,7] [~ 0,3,7] ~ [0,3,7] ~>")
        .scale(`${root}4:${scaleName}`)
        .s("square")
        .decay(0.14).sustain(0)
        .lpf(2600)
        .gain(0.5)

      return stack(drums, bass, stabs)
    }
  },

  // 2. BRAINDANCE / IDM
  {
    id: 'idm',
    tempo: '142 BPM',
    cps: 1.18,
    badge: 'HIGH BIAS / CrO₂',
    scaleCompatibili: ['phrygian', 'dorian'],
    creaPattern: (root, scaleName) => {
      const drums = creaBatteria(
        "<[c1 c1? ~ c1] [~ c1 ~ c1] [c1 ~ c1 ~] [~ c1 c1 ~]>",
        "<~ c2 ~ [c2 c2*2]>",
        "<c4*16 c4*24 c4*16 c4*32>",
        "<~ ~ c3? ~>"
      )

      const bass = n("<[0 12] [3 7] [10 5] [12 10]>*2")
        .scale(`${root}1:${scaleName}`)
        .s("sawtooth")
        .lpf(sine.range(300, 2600).slow(6))
        .lpq(9)
        .decay(0.16)
        .gain(0.75)

      const bleeps = n("<[0 2] [4 7] [9 11] [12 14]>*4")
        .scale(`${root}4:${scaleName}`)
        .s("triangle")
        .decay(0.08)
        .room(0.45)
        .gain(0.45)

      return stack(drums, bass, bleeps)
    }
  },

  // 3. LO-FI BOOM-BAP
  {
    id: 'lofi',
    tempo: '84 BPM',
    cps: 0.70,
    badge: 'TYPE I / NORMAL',
    scaleCompatibili: ['minor', 'dorian'],
    creaPattern: (root, scaleName) => {
      const drums = creaBatteria(
        "<[c1 ~] ~ [~ c1] [c1? ~]>",
        "<~ c2 ~ c2>",
        "<[c4 c4]*2>",
        "<~ ~ [c5 ~] ~>"
      )

      const chords = n("<[0,3,7,10] [5,8,12,15] [3,7,10,14] [7,10,14,17]>")
        .scale(`${root}3:${scaleName}`)
        .s("sine")
        .decay(0.85).sustain(0.2).release(0.4)
        .lpf(1300)
        .room(0.4)
        .gain(0.6)

      const bass = n("<0 5 3 7>")
        .scale(`${root}1:${scaleName}`)
        .s("triangle")
        .lpf(260)
        .gain(0.85)

      return stack(drums, chords, bass)
    }
  },

  // 4. MOTORIK TECHNO & ACID
  {
    id: 'techno',
    tempo: '132 BPM',
    cps: 1.10,
    badge: 'TYPE II / 70µs',
    scaleCompatibili: ['minor', 'phrygian'],
    creaPattern: (root, scaleName) => {
      const drums = creaBatteria(
        "<c1*4>",
        "<~ c2 ~ c2>",
        "<[~ c4]*4>",
        "<~ c3*2 ~ c3>"
      )

      const acid = n("<[0 0 12 3] [5 7 10 12] [3 5 7 10] [12 10 7 3]>")
        .scale(`${root}1:${scaleName}`)
        .s("sawtooth")
        .lpf(sine.range(350, 3000).slow(8))
        .lpq(9)
        .decay(0.12)
        .gain(0.78)

      return stack(drums, acid)
    }
  },

  // 5. DARK JUNGLE / D&B
  {
    id: 'jungle',
    tempo: '164 BPM',
    cps: 1.36,
    badge: 'METAL / 70µs',
    scaleCompatibili: ['minor', 'dorian'],
    creaPattern: (root, scaleName) => {
      const drums = creaBatteria(
        "<[c1 ~] ~ [~ c1] ~>",
        "<~ c2 ~ [c2 c2]>",
        "<c4*16>",
        "<c3*4>"
      )

      const sub = n("<[0 ~ 0 ~] [~ ~ 5 ~] [3 ~ ~ ~] [~ 7 ~ ~]>")
        .scale(`${root}0:${scaleName}`)
        .s("sine")
        .decay(0.6).sustain(0.3)
        .gain(0.95)

      const pad = n("<[0,3,7] [5,8,12] [3,7,10] [2,5,9]>")
        .scale(`${root}3:${scaleName}`)
        .s("sawtooth")
        .lpf(950)
        .room(0.6)
        .gain(0.42)

      return stack(drums, sub, pad)
    }
  },

  // 6. DUB TECHNO & SPACE
  {
    id: 'dub',
    tempo: '116 BPM',
    cps: 0.96,
    badge: 'HIGH BIAS / CrO₂',
    scaleCompatibili: ['minor', 'dorian'],
    creaPattern: (root, scaleName) => {
      const drums = creaBatteria(
        "<c1*4>",
        "<~ c2 ~ c2>",
        "<c4*8>",
        "<~ ~ c3 ~>"
      )

      const dubChord = n("<[0,3,7,10] ~ ~ ~> [~ ~ [0,3,7,10] ~]")
        .scale(`${root}3:${scaleName}`)
        .s("sawtooth")
        .decay(0.2)
        .lpf(sine.range(500, 1600).slow(12))
        .lpq(5)
        .room(0.8)
        .size(0.95)
        .gain(0.65)

      const sub = n("<0 0 5 3>*2")
        .scale(`${root}1:${scaleName}`)
        .s("triangle")
        .lpf(220)
        .gain(0.85)

      return stack(drums, dubChord, sub)
    }
  }
]

// ============================================================
// CONFIGURAZIONE TRIPARTITA LATO A
// ============================================================

const CFG = {
  fftSize: 4096,
  numBande: 300,
  freqMin: 40,
  freqMax: 15000,
  scanDur: 0.50,
  posizioni: [0.20, 0.50, 0.80],
  epsilon: 0.01,
  gamma: 0.45,

  f1: { numEv: 25, grani: 48,  amp: 0.28 },
  f2: { numEv: 35, grani: 128, amp: 0.14 },
  f3: { numEv: 55, grani: 24,  amp: 0.10 },

  compositionCps: 1.15,

  drone: {
    enabled: true,
    stretch: 32,
    gain: 0.70,
    cutoffMin: 65,
    cutoffMax: 180,
    panDepth: 0.18
  }
}

const DATASET_URL =
  'https://raw.githubusercontent.com/' +
  'tidalcycles/Dirt-Samples/main/strudel.json'

const NUM_FAMIGLIE_ATTIVE = 7

const POOL_FAMIGLIE = [
  'crow', 'birds', 'insect', 'breath', 'wind', 'fire', 'bubble',
  'lighter', 'pebbles', 'industrial', 'metal', 'can', 'glasstap', 'coins', 'print',
  'clak', 'tink', 'glitch', 'diphone', 'speechless',
  'juno', 'sitar', 'tabla', 'bottle',
  'space', 'padlong', 'seawolf', 'feelfx'
]

function estraiFamiglie(pool, quantita) {
  const mescolato = [...pool].sort(() => Math.random() - 0.5)
  return mescolato.slice(0, quantita)
}

const yieldBrowser = () =>
  new Promise(resolve => requestAnimationFrame(resolve))

const clipValue = (x, min, max) => Math.max(min, Math.min(max, x))
const rand = (min, max) => min + Math.random() * (max - min)

function gaussian(mu, sigma) {
  let u1 = 0, u2 = 0
  while (u1 === 0) u1 = Math.random()
  while (u2 === 0) u2 = Math.random()
  return mu + Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * sigma
}

// ============================================================
// DEFINIZIONE STATI TIMBRICI LATO A
// ============================================================

function definizioneStato(famiglia) {
  switch (famiglia) {
    case 'crow':       return { dur: [0.50, 0.15], rate: [1.00, 0.18], atkRatio: [0.25, 0.08], rq: [0.20, 0.40], wait: [0.45, 0.25] }
    case 'birds':      return { dur: [0.65, 0.20], rate: [1.15, 0.25], atkRatio: [0.22, 0.08], rq: [0.16, 0.35], wait: [0.40, 0.20] }
    case 'insect':     return { dur: [0.22, 0.08], rate: [1.40, 0.40], atkRatio: [0.40, 0.15], rq: [0.25, 0.60], wait: [0.16, 0.08] }
    case 'breath':     return { dur: [1.60, 0.45], rate: [0.65, 0.12], atkRatio: [0.35, 0.08], rq: [0.14, 0.30], wait: [0.85, 0.30] }
    case 'wind':       return { dur: [1.50, 0.40], rate: [0.70, 0.15], atkRatio: [0.35, 0.10], rq: [0.15, 0.35], wait: [0.80, 0.35] }
    case 'fire':       return { dur: [0.75, 0.25], rate: [0.85, 0.15], atkRatio: [0.28, 0.10], rq: [0.22, 0.40], wait: [0.45, 0.20] }
    case 'bubble':     return { dur: [0.15, 0.05], rate: [1.35, 0.30], atkRatio: [0.10, 0.04], rq: [0.28, 0.55], wait: [0.10, 0.05] }
    case 'lighter':    return { dur: [0.14, 0.04], rate: [1.10, 0.25], atkRatio: [0.08, 0.03], rq: [0.25, 0.55], wait: [0.12, 0.05] }
    case 'pebbles':    return { dur: [0.38, 0.12], rate: [1.00, 0.20], atkRatio: [0.20, 0.06], rq: [0.22, 0.45], wait: [0.25, 0.12] }
    case 'industrial': return { dur: [0.55, 0.18], rate: [0.75, 0.20], atkRatio: [0.15, 0.05], rq: [0.18, 0.40], wait: [0.35, 0.15] }
    case 'metal':      return { dur: [0.60, 0.20], rate: [1.15, 0.25], atkRatio: [0.20, 0.08], rq: [0.20, 0.45], wait: [0.35, 0.20] }
    case 'can':        return { dur: [0.32, 0.10], rate: [1.10, 0.20], atkRatio: [0.14, 0.05], rq: [0.18, 0.40], wait: [0.20, 0.10] }
    case 'glasstap':   return { dur: [0.40, 0.12], rate: [1.25, 0.22], atkRatio: [0.08, 0.03], rq: [0.08, 0.20], wait: [0.30, 0.15] }
    case 'coins':      return { dur: [0.18, 0.06], rate: [1.45, 0.35], atkRatio: [0.10, 0.04], rq: [0.12, 0.30], wait: [0.14, 0.06] }
    case 'print':      return { dur: [0.28, 0.09], rate: [0.95, 0.18], atkRatio: [0.15, 0.05], rq: [0.15, 0.35], wait: [0.20, 0.08] }
    case 'clak':       return { dur: [0.12, 0.04], rate: [1.10, 0.20], atkRatio: [0.06, 0.02], rq: [0.30, 0.65], wait: [0.10, 0.04] }
    case 'tink':       return { dur: [0.20, 0.06], rate: [1.35, 0.25], atkRatio: [0.08, 0.03], rq: [0.08, 0.22], wait: [0.18, 0.08] }
    case 'glitch':     return { dur: [0.10, 0.03], rate: [1.60, 0.45], atkRatio: [0.05, 0.02], rq: [0.05, 0.18], wait: [0.08, 0.04] }
    case 'diphone':    return { dur: [0.45, 0.14], rate: [0.90, 0.15], atkRatio: [0.25, 0.08], rq: [0.10, 0.28], wait: [0.35, 0.15] }
    case 'speechless': return { dur: [0.25, 0.08], rate: [1.05, 0.20], atkRatio: [0.12, 0.04], rq: [0.16, 0.36], wait: [0.22, 0.10] }
    case 'juno':       return { dur: [1.80, 0.45], rate: [0.75, 0.12], atkRatio: [0.28, 0.07], rq: [0.08, 0.20], wait: [0.90, 0.30] }
    case 'sitar':      return { dur: [0.70, 0.22], rate: [1.00, 0.18], atkRatio: [0.15, 0.05], rq: [0.10, 0.25], wait: [0.50, 0.20] }
    case 'tabla':      return { dur: [0.45, 0.15], rate: [0.85, 0.16], atkRatio: [0.12, 0.04], rq: [0.12, 0.30], wait: [0.30, 0.12] }
    case 'bottle':     return { dur: [0.80, 0.25], rate: [1.00, 0.12], atkRatio: [0.18, 0.06], rq: [0.06, 0.16], wait: [0.55, 0.20] }
    case 'space':      return { dur: [2.20, 0.50], rate: [0.55, 0.12], atkRatio: [0.20, 0.06], rq: [0.08, 0.22], wait: [1.20, 0.40] }
    case 'padlong':    return { dur: [2.50, 0.60], rate: [0.60, 0.10], atkRatio: [0.30, 0.08], rq: [0.06, 0.18], wait: [1.30, 0.45] }
    case 'seawolf':    return { dur: [1.20, 0.35], rate: [0.70, 0.18], atkRatio: [0.18, 0.05], rq: [0.10, 0.26], wait: [0.75, 0.25] }
    case 'feelfx':     return { dur: [0.65, 0.22], rate: [1.10, 0.30], atkRatio: [0.16, 0.05], rq: [0.14, 0.35], wait: [0.40, 0.18] }
    default:           return { dur: [1.00, 0.30], rate: [1.00, 0.20], atkRatio: [0.30, 0.10], rq: [0.20, 0.40], wait: [0.50, 0.20] }
  }
}

// ============================================================
// MATEMATICA SPETTRALE & FFT
// ============================================================

function fftReale(x) {
  const N = x.length
  const re = new Float64Array(x)
  const im = new Float64Array(N)
  let j = 0

  for (let i = 1; i < N; i++) {
    let bit = N >> 1
    while (j & bit) { j ^= bit; bit >>= 1 }
    j ^= bit
    if (i < j) {
      const tmpRe = re[i]; re[i] = re[j]; re[j] = tmpRe
      const tmpIm = im[i]; im[i] = im[j]; im[j] = tmpIm
    }
  }

  for (let len = 2; len <= N; len <<= 1) {
    const angle = -2 * Math.PI / len
    const wr0 = Math.cos(angle)
    const wi0 = Math.sin(angle)
    const half = len >> 1
    for (let i = 0; i < N; i += len) {
      let wr = 1, wi = 0
      for (let j = 0; j < half; j++) {
        const u = i + j
        const v = u + half
        const vr = re[v] * wr - im[v] * wi
        const vi = re[v] * wi + im[v] * wr
        const ur = re[u], ui = im[u]
        re[u] = ur + vr; im[u] = ui + vi
        re[v] = ur - vr; im[v] = ui - vi
        const nextWr = wr * wr0 - wi * wi0
        const nextWi = wr * wi0 + wi * wr0
        wr = nextWr; wi = nextWi
      }
    }
  }
  return { re, im }
}

function costruisciGriglia(sampleRate) {
  const freqRichieste = []
  for (let i = 0; i < CFG.numBande; i++) {
    const t = i / (CFG.numBande - 1)
    const freq = CFG.freqMin * Math.pow(CFG.freqMax / CFG.freqMin, t)
    freqRichieste.push(freq)
  }
  const setBin = new Set()
  for (const freq of freqRichieste) {
    const bin = clipValue(Math.round(freq * CFG.fftSize / sampleRate), 1, CFG.fftSize / 2)
    setBin.add(bin)
  }
  const binIndices = Array.from(setBin).sort((a, b) => a - b)
  const frequenze = binIndices.map(bin => bin * sampleRate / CFG.fftSize)
  return { binIndices, frequenze }
}

function analizzaFinestra(buffer, startSec, binIndices) {
  const sampleRate = buffer.sampleRate
  const audio = buffer.getChannelData(0)
  const frame = new Float64Array(CFG.fftSize)
  const start = Math.max(0, Math.floor(startSec * sampleRate))

  for (let i = 0; i < CFG.fftSize; i++) {
    const index = start + i
    const x = index < audio.length ? audio[index] : 0
    const hann = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (CFG.fftSize - 1))
    frame[i] = x * hann
  }
  const fft = fftReale(frame)
  return binIndices.map(bin => Math.hypot(fft.re[bin], fft.im[bin]))
}

function normalizza(array) {
  const somma = array.reduce((a, b) => a + b, 0)
  return somma > 0 ? array.map(x => x / somma) : array.map(() => 0)
}

function analizzaF0(buffer) {
  const griglia = costruisciGriglia(buffer.sampleRate)
  const profili = CFG.posizioni.map(posizione => {
    let start = posizione * buffer.duration - CFG.scanDur / 2
    start = clipValue(start, 0, Math.max(0, buffer.duration - CFG.scanDur))
    return analizzaFinestra(buffer, start, griglia.binIndices)
  })

  const media = Array(griglia.binIndices.length).fill(0)
  for (const profilo of profili) {
    for (let i = 0; i < media.length; i++) media[i] += profilo[i]
  }
  for (let i = 0; i < media.length; i++) media[i] /= profili.length

  return {
    frequenze: griglia.frequenze,
    binIndices: griglia.binIndices,
    profiliSingoli: profili,
    profilo: normalizza(media)
  }
}

function ruzicka(a, b) {
  let sommaMin = 0, sommaMax = 0
  for (let i = 0; i < a.length; i++) {
    sommaMin += Math.min(a[i], b[i])
    sommaMax += Math.max(a[i], b[i])
  }
  return sommaMax > 0 ? sommaMin / sommaMax : 0
}

function costruisciMatrice(profili) {
  const P = []
  for (let i = 0; i < profili.length; i++) {
    const pesi = []
    for (let j = 0; j < profili.length; j++) {
      const sim = ruzicka(profili[i], profili[j])
      const peso = i === j ? (sim * CFG.gamma) + CFG.epsilon : sim + CFG.epsilon
      pesi.push(peso)
    }
    const somma = pesi.reduce((a, b) => a + b, 0)
    P.push(pesi.map(peso => peso / somma))
  }
  return P
}

function scegliPesato(valori, pesi) {
  const r = Math.random()
  let accumulo = 0
  for (let i = 0; i < valori.length; i++) {
    accumulo += pesi[i]
    if (r <= accumulo) return valori[i]
  }
  return valori[valori.length - 1]
}

function scegliBanda(profilo) {
  const indici = profilo.map((_, i) => i)
  const pesi = normalizza(profilo.map(x => Math.max(0, x)))
  return scegliPesato(indici, pesi)
}

function scegliMateriale(profiloStato, materiali) {
  const indici = materiali.map((_, i) => i)
  const pesi = materiali.map(materiale =>
    ruzicka(normalizza(profiloStato), materiale.profilo) + CFG.epsilon
  )
  return scegliPesato(indici, normalizza(pesi))
}

function profiloGrano(profiloMateriale, frequenze, centro, rate, rq) {
  const risultato = new Array(profiloMateriale.length).fill(0)
  const r = Math.max(0.1, Math.abs(rate))
  const Q = clipValue(1 / Math.max(rq, 0.05), 1, 12)
  const logMin = Math.log(frequenze[0])
  const logMax = Math.log(frequenze[frequenze.length - 1])

  for (let i = 0; i < frequenze.length; i++) {
    const f = frequenze[i]
    const sorgente = f / r
    const logF = Math.log(Math.max(sorgente, frequenze[0]))
    let t = clipValue((logF - logMin) / (logMax - logMin), 0, 1)
    const indice = Math.round(t * (frequenze.length - 1))
    const energia = profiloMateriale[indice]
    const numeratore = f * f - centro * centro
    const denominatore = f * centro * Q
    const filtro = 1 / Math.sqrt(1 + Math.pow(numeratore / Math.max(denominatore, 1e-9), 2))
    risultato[i] = energia * filtro
  }
  return risultato
}

// ============================================================
// SIMULAZIONI DELLE TRE FASI EVOLUTIVE LATO A
// ============================================================

async function eseguiF1(materiali) {
  output.textContent = 'F1'
  const N = materiali.length
  const L = materiali[0].profilo.length
  const profiliF1 = Array.from({ length: N }, () => Array(L).fill(0))
  const eventi = []
  let stato = 0

  for (let iter = 0; iter < CFG.f1.numEv; iter++) {
    const definizione = definizioneStato(materiali[stato].famiglia)
    const cloud = []

    for (let g = 0; g < CFG.f1.grani; g++) {
      const indiceMateriale = Math.floor(Math.random() * N)
      const materiale = materiali[indiceMateriale]
      const indiceBanda = Math.floor(Math.random() * materiale.frequenze.length)
      const centro = materiale.frequenze[indiceBanda]

      const durata = clipValue(gaussian(definizione.dur[0], definizione.dur[1]), 0.08, 2.5)
      const rate = clipValue(gaussian(definizione.rate[0], definizione.rate[1]), 0.3, 2.2)
      const rq = rand(definizione.rq[0], definizione.rq[1])
      const pan = rand(-0.9, 0.9)
      const grano = profiloGrano(materiale.profilo, materiale.frequenze, centro, rate, rq)

      for (let k = 0; k < grano.length; k++) profiliF1[stato][k] += grano[k]
      cloud.push({ stato, materiale: indiceMateriale, banda: centro, durata, rate, rq, pan })
    }

    eventi.push({ stato, grani: cloud })
    stato = Math.floor(Math.random() * N)

    if (iter % 10 === 0) await yieldBrowser()
  }
  return { profili: profiliF1.map(normalizza), eventi }
}

async function eseguiF2(materiali, profiliF1, P1) {
  output.textContent = 'F2'
  const N = materiali.length
  const L = materiali[0].profilo.length
  const profiliF2 = Array.from({ length: N }, () => Array(L).fill(0))
  const eventi = []
  let stato = 0

  for (let iter = 0; iter < CFG.f2.numEv; iter++) {
    const profiloStato = profiliF1[stato]
    const definizione = definizioneStato(materiali[stato].famiglia)
    const indiceMateriale = scegliMateriale(profiloStato, materiali)
    const materiale = materiali[indiceMateriale]
    const cloud = []

    for (let g = 0; g < CFG.f2.grani; g++) {
      const indiceBanda = scegliBanda(profiloStato)
      const frequenza = materiali[0].frequenze[indiceBanda] * rand(0.97, 1.03)
      const durata = clipValue(gaussian(definizione.dur[0], definizione.dur[1]), 0.08, 3.0)
      const rate = clipValue(gaussian(definizione.rate[0], definizione.rate[1]), 0.2, 2.5)
      const rq = rand(definizione.rq[0], definizione.rq[1])
      const pan = rand(-0.7, 0.7)
      const grano = profiloGrano(materiale.profilo, materiale.frequenze, frequenza, rate, rq)

      for (let k = 0; k < grano.length; k++) profiliF2[stato][k] += grano[k]
      cloud.push({ stato, materiale: indiceMateriale, frequenza, durata, rate, rq, pan })
    }

    eventi.push({ stato, materiale: indiceMateriale, grani: cloud })
    stato = scegliPesato(P1[stato].map((_, i) => i), P1[stato])

    if (iter % 10 === 0) await yieldBrowser()
  }
  return { profili: profiliF2.map(normalizza), eventi }
}

async function eseguiF3(materiali, profiliF2, P2) {
  output.textContent = 'F3'
  const clouds = []
  const catena = []
  let stato = 0

  for (let iter = 0; iter < CFG.f3.numEv; iter++) {
    const profiloStato = profiliF2[stato]
    const definizione = definizioneStato(materiali[stato].famiglia)
    const indiceMateriale = scegliMateriale(profiloStato, materiali)
    const materiale = materiali[indiceMateriale]
    const grani = []

    for (let g = 0; g < CFG.f3.grani; g++) {
      const indiceBanda = scegliBanda(profiloStato)
      const frequenza = materiali[0].frequenze[indiceBanda] * rand(0.98, 1.02)
      const durata = clipValue(gaussian(definizione.dur[0], definizione.dur[1]), 0.05, 3.5)
      const rate = clipValue(gaussian(definizione.rate[0], definizione.rate[1]), 0.2, 2.5)
      const rq = rand(definizione.rq[0], definizione.rq[1])
      const pan = rand(-0.8, 0.8)
      const gain = rand(0.025, 0.075)
      const chop = Math.round(clipValue(4 / Math.max(durata, 0.05), 3, 16))
      const sliceIndex = Math.floor(Math.random() * chop)
      const onset = Math.random() * 0.70
      const attack = clipValue(rand(0.01, Math.min(0.15, durata * 0.35)), 0.005, 0.15)
      const release = clipValue(rand(0.02, Math.min(0.35, durata * 0.50)), 0.01, 0.35)
      const bpq = clipValue(1 / Math.max(rq, 0.05), 1, 12)
      const clipFactor = clipValue(durata / 1.5, 0.08, 1)

      grani.push({
        materiale: indiceMateriale,
        frequenza, durata, rate,
        pan: (pan + 1) / 2,
        gain, chop, sliceIndex,
        onset, attack, release,
        rq, bpq, clipFactor
      })
    }

    clouds.push({ stato, materiale: indiceMateriale, grani })
    catena.push({ stato, materiale: indiceMateriale })
    stato = scegliPesato(P2[stato].map((_, i) => i), P2[stato])

    if (iter % 10 === 0) await yieldBrowser()
  }
  return { clouds, catena }
}

// ============================================================
// GENERATORI AUDIO DELLE 3 FASI LATO A
// ============================================================

function costruisciPatternF1(F1) {
  const normGain = CFG.f1.amp / Math.sqrt(Math.max(1, CFG.f1.grani))
  return F1.eventi.map(ev => {
    const microGrani = ev.grani.map(g => {
      const onset = Math.random() * 0.85
      return s('m' + g.materiale)
        .speed(g.rate)
        .attack(0.02)
        .release(clipValue(g.durata * 0.5, 0.05, 0.35))
        .bpf(g.banda)
        .bpq(clipValue(1 / Math.max(g.rq, 0.05), 1, 12))
        .pan((g.pan + 1) / 2)
        .gain(normGain)
        .room(0.15)
        .late(onset)
    })
    return stack(...microGrani)
  })
}

function costruisciPatternF2(F2) {
  const normGain = CFG.f2.amp / Math.sqrt(Math.max(1, CFG.f2.grani))
  return F2.eventi.map(ev => {
    const microGrani = ev.grani.map(g => {
      const onset = Math.random() * 0.95
      return s('m' + g.materiale)
        .speed(g.rate)
        .attack(0.015)
        .release(clipValue(g.durata * 0.45, 0.05, 0.35))
        .bpf(g.frequenza)
        .bpq(clipValue(1 / Math.max(g.rq, 0.05), 1, 10))
        .pan((g.pan + 1) / 2)
        .gain(normGain)
        .room(0.35)
        .late(onset)
    })
    return stack(...microGrani)
  })
}

function costruisciPatternF3(F3) {
  return F3.clouds.map(cloud => {
    const microGrani = cloud.grani.map(g => {
      const onset = Math.random() * 0.90
      return s('m' + g.materiale)
        .slice(g.chop, String(g.sliceIndex))
        .speed(g.rate)
        .attack(g.attack)
        .release(g.release + 0.15)
        .bpf(g.frequenza)
        .bpq(g.bpq)
        .pan(g.pan)
        .gain(g.gain)
        .room(0.28)
        .late(onset)
    })
    return stack(...microGrani)
  })
}

function costruisciDrone(sistema) {
  if (!CFG.drone.enabled || sistema.materiali.length === 0) return null
  const indiceDrone = Math.floor(Math.random() * sistema.materiali.length)
  const cutoff = sine.range(CFG.drone.cutoffMin, CFG.drone.cutoffMax).slow(32)
  const pan = sine.range(-CFG.drone.panDepth, CFG.drone.panDepth).slow(40)

  return s('m' + indiceDrone)
    .stretch(CFG.drone.stretch)
    .clip(CFG.drone.stretch)
    .lpf(cutoff)
    .pan(pan)
    .gain(CFG.drone.gain)
    .room(0.40)
    .size(0.85)
    .orbit(2)
}

// ============================================================
// GESTIONE DATASET
// ============================================================

async function caricaDataset() {
  const response = await fetch(DATASET_URL)
  if (!response.ok) throw new Error(`Dataset HTTP ${response.status}`)
  return response.json()
}

function listaFile(nodo) {
  if (typeof nodo === 'string') return [nodo]
  if (Array.isArray(nodo)) return nodo.flatMap(listaFile)
  if (nodo && typeof nodo === 'object') {
    return Object.entries(nodo)
      .filter(([chiave]) => chiave !== '_base')
      .flatMap(([, valore]) => listaFile(valore))
  }
  return []
}

function scegliFile(json, base, famiglia) {
  const nodo = json[famiglia]
  if (!nodo) throw new Error(`Famiglia non presente: ${famiglia}`)
  const files = listaFile(nodo)
  if (files.length === 0) throw new Error(`Nessun file per: ${famiglia}`)
  const file = files[Math.floor(Math.random() * files.length)]
  return { famiglia, file, url: new URL(file, base).href, varianti: files.length }
}

async function analizzaMateriale(materiale) {
  const response = await fetch(materiale.url)
  if (!response.ok) throw new Error(`Download HTTP ${response.status}`)
  const bytes = await response.arrayBuffer()
  const buffer = await sysAudioContext.decodeAudioData(bytes)
  const f0 = analizzaF0(buffer)

  return {
    ...materiale,
    durata: buffer.duration,
    sampleRate: buffer.sampleRate,
    profilo: f0.profilo,
    frequenze: f0.frequenze,
    binIndices: f0.binIndices
  }
}

// ============================================================
// MONITORAGGIO TEMPI E DURATE FISSE
// ============================================================

let faseTimerInterval = null
let stopTimeoutId = null

function fermaComposizioneAutomatica() {
  hush()
  if (faseTimerInterval) clearInterval(faseTimerInterval)
  if (stopTimeoutId) clearTimeout(stopTimeoutId)
  tapeWindow?.classList.remove('is-playing')
  output.textContent = 'FINE // TOCCA RIGENERA'
}

function avviaMonitoraggioLatoA(durF1Sec, durF2Sec, durTotaleSec) {
  if (faseTimerInterval) clearInterval(faseTimerInterval)
  if (stopTimeoutId) clearTimeout(stopTimeoutId)

  const startTime = Date.now()

  faseTimerInterval = setInterval(() => {
    const elapsedSec = (Date.now() - startTime) / 1000

    if (elapsedSec < durF1Sec) {
      if (sideBadge) sideBadge.textContent = 'FASE 1'
      output.textContent = `F1(${elapsedSec.toFixed(1)}s)`
    } else if (elapsedSec < durF1Sec + durF2Sec) {
      if (sideBadge) sideBadge.textContent = 'FASE 2'
      output.textContent = `F2(${elapsedSec.toFixed(1)}s)`
    } else if (elapsedSec < durTotaleSec) {
      if (sideBadge) sideBadge.textContent = 'FASE 3'
      output.textContent = `F3(${elapsedSec.toFixed(1)}s)`
    } else {
      fermaComposizioneAutomatica()
    }
  }, 250)

  stopTimeoutId = setTimeout(() => {
    fermaComposizioneAutomatica()
  }, durTotaleSec * 1000)
}

function avviaMonitoraggioLatoB(durTotaleSec) {
  if (faseTimerInterval) clearInterval(faseTimerInterval)
  if (stopTimeoutId) clearTimeout(stopTimeoutId)

  const startTime = Date.now()

  faseTimerInterval = setInterval(() => {
    const elapsedSec = (Date.now() - startTime) / 1000

    if (elapsedSec < durTotaleSec) {
      if (sideBadge) sideBadge.textContent = 'SIDE B'
      output.textContent = `${nomeWavAttuale} (${elapsedSec.toFixed(1)}s)`
    } else {
      fermaComposizioneAutomatica()
    }
  }, 250)

  stopTimeoutId = setTimeout(() => {
    fermaComposizioneAutomatica()
  }, durTotaleSec * 1000)
}

// ============================================================
// PLAYBACK LATO A (MARKOVIANO)
// ============================================================

async function riproduciLatoA() {
  if (!globalThis.sistemaCompleto) {
    output.textContent = 'ERRORE: Genera prima la composizione.'
    return
  }

  // Risveglia il contesto audio di Strudel se sospeso
  const strudelCtx = getAudioContext()
  if (strudelCtx && strudelCtx.state === 'suspended') await strudelCtx.resume()
  if (sysAudioContext && sysAudioContext.state === 'suspended') await sysAudioContext.resume()
  if (analyserNode?.context?.state === 'suspended') await analyserNode.context.resume()

  const sistema = globalThis.sistemaCompleto

  // Registra ESCLUSIVAMENTE la mappa dei campioni del Lato A (senza sovrascrivere o 404)
  await samples(sistema.sampleMap)

  const composizione = cat(...sistema.tuttiIPattern)
  const drone = costruisciDrone(sistema)

  hush()
  await new Promise(r => setTimeout(r, 20))

  const layerComposizione = composizione
    .cps(CFG.compositionCps)
    .gain(0.72)
    .room(0.38)
    .size(0.80)
    .orbit(1)

  if (drone) {
    stack(drone, layerComposizione).play()
  } else {
    layerComposizione.play()
  }

  tapeWindow?.classList.add('is-playing')

  const durF1 = CFG.f1.numEv / CFG.compositionCps
  const durF2 = CFG.f2.numEv / CFG.compositionCps
  const durTotale = (CFG.f1.numEv + CFG.f2.numEv + CFG.f3.numEv) / CFG.compositionCps

  avviaMonitoraggioLatoA(durF1, durF2, durTotale)
}

// ============================================================
// PLAYBACK LATO B (GENERI NATIVI SENZA TONALITÀ VISIBILE)
// ============================================================

async function riproduciLatoB() {
  if (!genereBSelezionato) {
    genereBSelezionato = GENERI_LATO_B[Math.floor(Math.random() * GENERI_LATO_B.length)]
  }

  const strudelCtx = getAudioContext()
  if (strudelCtx && strudelCtx.state === 'suspended') await strudelCtx.resume()
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!sysAudioContext) sysAudioContext = new AudioContextClass()
  if (sysAudioContext.state === 'suspended') await sysAudioContext.resume()
  if (analyserNode?.context?.state === 'suspended') await analyserNode.context.resume()

  hush()
  await new Promise(r => setTimeout(r, 20))

  // Pattern musicale eseguito nella tonalità nascosta (Zero errori di scale)
  const pattern = genereBSelezionato.creaPattern(tonalitaAttuale, scalaAttuale)
    .cps(genereBSelezionato.cps)
    .gain(0.85)
    .room(0.35)
    .orbit(1)

  pattern.play()

  tapeWindow?.classList.add('is-playing')
  avviaMonitoraggioLatoB(durataLatoBSec)
}

// ============================================================
// ESECUZIONE E CALIBRAZIONE LATO A
// ============================================================

async function eseguiSistema() {
  runButton.disabled = true
  playButton.disabled = true
  output.textContent = 'CALIBRAZIONE TAPE...'

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!sysAudioContext) {
      sysAudioContext = new AudioContextClass()
    }
    if (sysAudioContext.state === 'suspended') {
      await sysAudioContext.resume()
    }
    const strudelCtx = getAudioContext()
    if (strudelCtx && strudelCtx.state === 'suspended') {
      await strudelCtx.resume()
    }
    if (analyserNode?.context?.state === 'suspended') {
      await analyserNode.context.resume()
    }

    output.textContent = 'F0: download dataset...'
    const json = await caricaDataset()
    const base = json._base || 'https://raw.githubusercontent.com/tidalcycles/Dirt-Samples/main/'

    const famiglieAttive = estraiFamiglie(POOL_FAMIGLIE, NUM_FAMIGLIE_ATTIVE)
    output.textContent = `TIMBRI: [ ${famiglieAttive.join(' · ')} ]`
    await yieldBrowser()

    const materialiScelti = famiglieAttive.map(f => scegliFile(json, base, f))

    const materiali = []
    for (const matScelto of materialiScelti) {
      output.textContent = `F0: FFT ${matScelto.famiglia}...`
      materiali.push(await analizzaMateriale(matScelto))
      await yieldBrowser()
    }

    const F1 = await eseguiF1(materiali)
    const P1 = costruisciMatrice(F1.profili)

    const F2 = await eseguiF2(materiali, F1.profili, P1)
    const P2 = costruisciMatrice(F2.profili)

    const F3 = await eseguiF3(materiali, F2.profili, P2)

    const sampleMap = {}
    for (let i = 0; i < materiali.length; i++) {
      sampleMap['m' + i] = materiali[i].url
    }

    const patternF1 = costruisciPatternF1(F1)
    const patternF2 = costruisciPatternF2(F2)
    const patternF3 = costruisciPatternF3(F3)

    const tuttiIPattern = [...patternF1, ...patternF2, ...patternF3]

    globalThis.sistemaCompleto = {
      materiali,
      profiliF0: materiali.map(m => m.profilo),
      F1, P1,
      F2, P2,
      F3,
      sampleMap,
      patternF1,
      patternF2,
      patternF3,
      tuttiIPattern
    }

    await riproduciLatoA()

    runButton.disabled = false
    playButton.disabled = false
  } catch (errore) {
    console.error(errore)
    output.textContent = `ERRORE: ${errore.message}`
    runButton.disabled = false
    playButton.disabled = true
    tapeWindow?.classList.remove('is-playing')
    if (faseTimerInterval) clearInterval(faseTimerInterval)
    if (stopTimeoutId) clearTimeout(stopTimeoutId)
  }
}

// ============================================================
// REGIA ROTAZIONE CASSETTA 3D (LATO A <-> B)
// ============================================================

function giraCassetta() {
  hush()
  tapeWindow?.classList.remove('is-playing')
  if (faseTimerInterval) clearInterval(faseTimerInterval)
  if (stopTimeoutId) clearTimeout(stopTimeoutId)

  cassetteEl?.classList.add('flipping')

  setTimeout(() => {
    if (currentSide === 'A') {
      currentSide = 'B'

      // Estrae stile, tonalità segreta e nome file .wav hacker
      genereBSelezionato = GENERI_LATO_B[Math.floor(Math.random() * GENERI_LATO_B.length)]
      tonalitaAttuale = estraiTonalita()
      scalaAttuale = genereBSelezionato.scaleCompatibili[Math.floor(Math.random() * genereBSelezionato.scaleCompatibili.length)]
      nomeWavAttuale = generaNomeWav()

      cassetteEl?.classList.add('side-b')
      if (sideBadge) sideBadge.textContent = 'SIDE B'
      if (formatBadge) formatBadge.textContent = 'HEX / 32-BIT'
      if (speedBadge) speedBadge.textContent = genereBSelezionato.tempo
      if (tapeSubtitle) tapeSubtitle.textContent = nomeWavAttuale
      if (flipButton) flipButton.innerHTML = '<span class="icon">⟲</span> GIRA CASSETTA [LATO A]'

      output.textContent = `${nomeWavAttuale} // PRONTO`
    } else {
      currentSide = 'A'

      cassetteEl?.classList.remove('side-b')
      if (sideBadge) sideBadge.textContent = 'SIDE A'
      if (formatBadge) formatBadge.textContent = 'STEREO / CrO₂'
      if (speedBadge) speedBadge.textContent = '1.10 CPS'
      if (tapeSubtitle) tapeSubtitle.textContent = 'WHAAAAAAAAAAAAAHHHHHHHHH'
      if (flipButton) flipButton.innerHTML = '<span class="icon">⟲</span> GIRA CASSETTA [LATO B]'

      output.textContent = "SYSTEM READY // TOCCA 'PLAY' PER GENERARE IL NASTRO."
    }
  }, 325)

  setTimeout(() => {
    cassetteEl?.classList.remove('flipping')
  }, 650)
}

// ============================================================
// EVENT LISTENERS DEL DECK
// ============================================================

runButton.addEventListener('click', () => {
  if (currentSide === 'A') {
    if (globalThis.sistemaCompleto) {
      riproduciLatoA()
    } else {
      eseguiSistema()
    }
  } else {
    riproduciLatoB()
  }
})

playButton.addEventListener('click', () => {
  if (currentSide === 'A') {
    eseguiSistema()
  } else {
    // Sul Lato B, 'RIGENERA' estrae un nuovo stile, una nuova tonalità e un nuovo dump alfanumerico .wav
    const altriGeneri = GENERI_LATO_B.filter(g => g.id !== genereBSelezionato?.id)
    genereBSelezionato = altriGeneri[Math.floor(Math.random() * altriGeneri.length)]
    tonalitaAttuale = estraiTonalita()
    scalaAttuale = genereBSelezionato.scaleCompatibili[Math.floor(Math.random() * genereBSelezionato.scaleCompatibili.length)]
    nomeWavAttuale = generaNomeWav()

    if (speedBadge) speedBadge.textContent = genereBSelezionato.tempo
    if (tapeSubtitle) tapeSubtitle.textContent = nomeWavAttuale

    riproduciLatoB()
  }
})

stopButton.addEventListener('click', () => {
  hush()
  tapeWindow?.classList.remove('is-playing')
  if (faseTimerInterval) clearInterval(faseTimerInterval)
  if (stopTimeoutId) clearTimeout(stopTimeoutId)

  if (currentSide === 'A') {
    if (sideBadge) sideBadge.textContent = 'SIDE A'
  } else {
    if (sideBadge) sideBadge.textContent = 'SIDE B'
  }
  output.textContent = 'STOP // NASTRO FERMATO'
})

flipButton.addEventListener('click', giraCassetta)
