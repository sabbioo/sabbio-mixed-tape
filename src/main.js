import { initStrudel } from '@strudel/web'
import './style.css'
import { initLiquidBackground } from './liquid.js'


initLiquidBackground('liquid-canvas') // <-- AGGIUNGI QUESTA

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
const output = document.querySelector('#output')
const canvas = document.querySelector('#spectrum')
const tapeWindow = document.querySelector('.tape-window')
const ctx = canvas.getContext('2d')

if (playButton) playButton.textContent = 'RIGENERA'

let sysAudioContext

// ============================================================
// OSCILLOSCOPIO CRT IN TEMPO REALE
// ============================================================

function drawOscilloscope() {
  requestAnimationFrame(drawOscilloscope)

  const width = canvas.width
  const height = canvas.height

  ctx.fillStyle = '#030a08'
  ctx.fillRect(0, 0, width, height)

  // Griglia centrale verde attenuata
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
      const amplified = deviation * 3.5 // Guadagno visivo per i micro-grani
      const y = height / 2 + amplified * (height / 2)

      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
      x += sliceWidth
    }
  } else {
    // Fruscio analogico a nastro fermo
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
// CONFIGURAZIONE
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

  f1: { numEv: 100, grani: 1, amp: 0.25 },
  f2: { numEv: 100, grani: 48, amp: 0.15 },
  f3: { numEv: 100, grani: 24, amp: 0.10 },

  compositionCps: 1.10,

  drone: {
    enabled: true,
    stretch: 32,
    gain: 0.60,
    cutoffMin: 65,
    cutoffMax: 180,
    panDepth: 0.18
  }
}

const DATASET_URL =
  'https://raw.githubusercontent.com/' +
  'tidalcycles/Dirt-Samples/main/strudel.json'

const FAMIGLIE = [
  'crow',
  'wind',
  'metal',
  'insect',
  'birds',
  'fire',
  'breath'
]

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
// FFT
// ============================================================

function fftReale(x) {
  const N = x.length
  const re = new Float64Array(x)
  const im = new Float64Array(N)
  let j = 0

  for (let i = 1; i < N; i++) {
    let bit = N >> 1
    while (j & bit) {
      j ^= bit
      bit >>= 1
    }
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

        re[u] = ur + vr
        im[u] = ui + vi
        re[v] = ur - vr
        im[v] = ui - vi

        const nextWr = wr * wr0 - wi * wi0
        const nextWi = wr * wi0 + wi * wr0
        wr = nextWr
        wi = nextWi
      }
    }
  }

  return { re, im }
}

// ============================================================
// GRIGLIA SPETTRALE
// ============================================================

function costruisciGriglia(sampleRate) {
  const freqRichieste = []
  for (let i = 0; i < CFG.numBande; i++) {
    const t = i / (CFG.numBande - 1)
    const freq = CFG.freqMin * Math.pow(CFG.freqMax / CFG.freqMin, t)
    freqRichieste.push(freq)
  }

  const setBin = new Set()
  for (const freq of freqRichieste) {
    const bin = clipValue(
      Math.round(freq * CFG.fftSize / sampleRate),
      1,
      CFG.fftSize / 2
    )
    setBin.add(bin)
  }

  const binIndices = Array.from(setBin).sort((a, b) => a - b)
  const frequenze = binIndices.map(bin => bin * sampleRate / CFG.fftSize)
  return { binIndices, frequenze }
}

// ============================================================
// ANALISI DI UNA FINESTRA
// ============================================================

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

// ============================================================
// NORMALIZZAZIONE L1
// ============================================================

function normalizza(array) {
  const somma = array.reduce((a, b) => a + b, 0)
  return somma > 0 ? array.map(x => x / somma) : array.map(() => 0)
}

// ============================================================
// F0
// ============================================================

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

// ============================================================
// RŮŽIČKA
// ============================================================

function ruzicka(a, b) {
  let sommaMin = 0, sommaMax = 0
  for (let i = 0; i < a.length; i++) {
    sommaMin += Math.min(a[i], b[i])
    sommaMax += Math.max(a[i], b[i])
  }
  return sommaMax > 0 ? sommaMin / sommaMax : 0
}

// ============================================================
// MATRICE DI TRANSIZIONE
// ============================================================

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

// ============================================================
// PARAMETRI DEGLI STATI
// ============================================================

function definizioneStato(famiglia) {
  switch (famiglia) {
    case 'crow': return { dur: [0.50, 0.15], rate: [1.00, 0.18], atkRatio: [0.25, 0.08], rq: [0.20, 0.40], wait: [0.45, 0.25] }
    case 'wind': return { dur: [1.50, 0.40], rate: [0.70, 0.15], atkRatio: [0.35, 0.10], rq: [0.15, 0.35], wait: [0.80, 0.35] }
    case 'metal': return { dur: [0.60, 0.20], rate: [1.15, 0.25], atkRatio: [0.20, 0.08], rq: [0.20, 0.45], wait: [0.35, 0.20] }
    case 'insect': return { dur: [0.25, 0.10], rate: [1.40, 0.40], atkRatio: [0.40, 0.15], rq: [0.25, 0.60], wait: [0.18, 0.10] }
    case 'space': return { dur: [2.00, 0.50], rate: [0.60, 0.15], atkRatio: [0.20, 0.08], rq: [0.12, 0.30], wait: [1.00, 0.40] }
    default: return { dur: [1.00, 0.30], rate: [1.00, 0.20], atkRatio: [0.30, 0.10], rq: [0.20, 0.40], wait: [0.50, 0.20] }
  }
}

// ============================================================
// MODELLO SPETTRALE DEL GRANO
// ============================================================

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
// F1
// ============================================================

async function eseguiF1(materiali) {
  output.textContent = 'F1: esplorazione spazio...'
  const N = materiali.length
  const L = materiali[0].profilo.length
  const profiliF1 = Array.from({ length: N }, () => Array(L).fill(0))
  const eventi = []
  let stato = 0

  for (let iter = 0; iter < CFG.f1.numEv; iter++) {
    const definizione = definizioneStato(materiali[stato].famiglia)
    const indiceMateriale = Math.floor(Math.random() * N)
    const materiale = materiali[indiceMateriale]
    const indiceBanda = Math.floor(Math.random() * materiale.frequenze.length)
    const centro = materiale.frequenze[indiceBanda]

    const durata = clipValue(gaussian(definizione.dur[0], definizione.dur[1]), 0.08, 3.5)
    const rate = clipValue(gaussian(definizione.rate[0], definizione.rate[1]), 0.2, 2.5)
    const rq = rand(definizione.rq[0], definizione.rq[1])
    const grano = profiloGrano(materiale.profilo, materiale.frequenze, centro, rate, rq)

    for (let k = 0; k < grano.length; k++) profiliF1[stato][k] += grano[k]
    eventi.push({ stato, materiale: indiceMateriale, banda: centro, durata, rate, rq })
    stato = Math.floor(Math.random() * N)

    if (iter % 15 === 0) {
      output.textContent = `F1: computazione ${iter + 1}/${CFG.f1.numEv}`
      await yieldBrowser()
    }
  }

  return { profili: profiliF1.map(normalizza), eventi }
}

// ============================================================
// F2
// ============================================================

async function eseguiF2(materiali, profiliF1, P1) {
  output.textContent = 'F2: transizioni P1...'
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
      const frequenza = materiali[0].frequenze[indiceBanda] * rand(0.98, 1.02)
      const durata = clipValue(gaussian(definizione.dur[0], definizione.dur[1]), 0.08, 3.5)
      const rate = clipValue(gaussian(definizione.rate[0], definizione.rate[1]), 0.2, 2.5)
      const rq = rand(definizione.rq[0], definizione.rq[1])
      const grano = profiloGrano(materiale.profilo, materiale.frequenze, frequenza, rate, rq)

      for (let k = 0; k < grano.length; k++) profiliF2[stato][k] += grano[k]
      cloud.push({ stato, materiale: indiceMateriale, frequenza, durata, rate, rq })
    }

    eventi.push({ stato, materiale: indiceMateriale, grani: cloud })
    stato = scegliPesato(P1[stato].map((_, i) => i), P1[stato])

    if (iter % 15 === 0) {
      output.textContent = `F2: clustering ${iter + 1}/${CFG.f2.numEv}`
      await yieldBrowser()
    }
  }

  return { profili: profiliF2.map(normalizza), eventi }
}

// ============================================================
// F3
// ============================================================

async function eseguiF3(materiali, profiliF2, P2) {
  output.textContent = 'F3: traiettoria finale P2...'
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

    if (iter % 15 === 0) {
      output.textContent = `F3: nuvole ${iter + 1}/${CFG.f3.numEv}`
      await yieldBrowser()
    }
  }

  return { clouds, catena }
}

// ============================================================
// DATASET
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
// PATTERN COMPOSITIVI
// ============================================================

function costruisciPatternF3(F3) {
  return F3.clouds.map(cloud => {
    const grainPatterns = cloud.grani.map(grain => {
      return s('m' + grain.materiale)
        .slice(grain.chop, String(grain.sliceIndex))
        .speed(grain.rate)
        .clip(grain.clipFactor)
        .attack(grain.attack)
        .release(grain.release)
        .bpf(grain.frequenza)
        .bpq(grain.bpq)
        .pan(grain.pan)
        .gain(grain.gain)
        .room(0.25)
        .late(grain.onset)
    })
    return stack(...grainPatterns)
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
// PLAYBACK
// ============================================================

function riproduciComposizione() {
  if (!globalThis.sistemaCompleto) {
    output.textContent = 'ERRORE: Genera prima la composizione.'
    return
  }

  const sistema = globalThis.sistemaCompleto
  samples(sistema.sampleMap)

  const composizione = cat(...sistema.patterns)
  const drone = costruisciDrone(sistema)

  hush()

  const layerComposizione = composizione
    .cps(CFG.compositionCps)
    .gain(0.70)
    .room(0.42)
    .size(0.82)
    .orbit(1)

  if (drone) {
    stack(drone, layerComposizione).play()
  } else {
    layerComposizione.play()
  }

  // Bobine in movimento
  tapeWindow?.classList.add('is-playing')
  output.textContent = `NOW PLAYING // (${CFG.compositionCps} CPS)`
}

// ============================================================
// ESECUZIONE SISTEMA
// ============================================================

async function eseguiSistema() {
  runButton.disabled = true
  playButton.disabled = true
  output.textContent = 'CALIBRAZIONE NASTRO...'

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!sysAudioContext) {
      sysAudioContext = new AudioContextClass()
    }
    if (sysAudioContext.state === 'suspended') {
      await sysAudioContext.resume()
    }
    if (analyserNode?.context?.state === 'suspended') {
      await analyserNode.context.resume()
    }

    output.textContent = 'F0: download dataset...'
    const json = await caricaDataset()
    const base = json._base || 'https://raw.githubusercontent.com/tidalcycles/Dirt-Samples/main/'
    const materialiScelti = FAMIGLIE.map(f => scegliFile(json, base, f))

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

    const patterns = costruisciPatternF3(F3)

    globalThis.sistemaCompleto = {
      materiali,
      profiliF0: materiali.map(m => m.profilo),
      profiliF1: F1.profili,
      P1,
      profiliF2: F2.profili,
      P2,
      F3,
      sampleMap,
      patterns
    }

    riproduciComposizione()

    runButton.disabled = false
    playButton.disabled = false
  } catch (errore) {
    console.error(errore)
    output.textContent = `ERRORE: ${errore.message}`
    runButton.disabled = false
    playButton.disabled = true
    tapeWindow?.classList.remove('is-playing')
  }
}

// ============================================================
// EVENT LISTENERS
// ============================================================

playButton.addEventListener('click', riproduciComposizione)

stopButton.addEventListener('click', () => {
  hush()
  tapeWindow?.classList.remove('is-playing')
  output.textContent = 'STOP // NASTRO FERMATO'
})

runButton.addEventListener('click', eseguiSistema)
