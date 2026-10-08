import { initStrudel } from '@strudel/web'
import './style.css'

initStrudel()

const crowUrl =
  'https://raw.githubusercontent.com/tidalcycles/Dirt-Samples/main/crow/000_crow.wav'

const playButton =
  document.querySelector('#play')

const stopButton =
  document.querySelector('#stop')

const analyzeButton =
  document.querySelector('#analyze')

const output =
  document.querySelector('#output')

const canvas =
  document.querySelector('#spectrum')

const ctx =
  canvas.getContext('2d')


// ============================================================
// PARAMETRI F0
// ============================================================

const FFT_N = 4096

const NUM_FREQ_RICHIESTE = 300

const FREQ_MIN = 40

const FREQ_MAX = 15000

const SCAN_DUR = 0.25

const POSIZIONI = [
  0.20,
  0.50,
  0.80
]


// ============================================================
// GENERAZIONE DELLA GRIGLIA SPETTRALE
//
// Equivalente concettuale di:
//
// Array.geom(300, 40, ...)
//
// nel codice SuperCollider.
// ============================================================

function costruisciGrigliaSpettrale(sampleRate) {

  const freqRichieste = []

  for (
    let i = 0;
    i < NUM_FREQ_RICHIESTE;
    i++
  ) {

    const t =
      i /
      (NUM_FREQ_RICHIESTE - 1)

    const freq =
      FREQ_MIN *
      Math.pow(
        FREQ_MAX / FREQ_MIN,
        t
      )

    freqRichieste.push(freq)
  }


  // ----------------------------------------------------------
  // Conversione frequenza -> bin FFT
  // ----------------------------------------------------------

  const binSet = new Set()

  for (
    const freq
    of freqRichieste
  ) {

    let bin =
      Math.round(
        freq *
        FFT_N /
        sampleRate
      )

    bin =
      Math.max(
        1,
        Math.min(
          FFT_N / 2,
          bin
        )
      )

    binSet.add(bin)
  }


  const binIndices =
    Array.from(binSet)
      .sort(
        (a, b) => a - b
      )


  // ----------------------------------------------------------
  // Frequenze effettivamente rappresentate
  // ----------------------------------------------------------

  const frequenze =
    binIndices.map(
      bin =>
        bin *
        sampleRate /
        FFT_N
    )


  return {
    freqRichieste,
    binIndices,
    frequenze
  }
}


// ============================================================
// FFT RADIX-2
// ============================================================

function fftReale(x) {

  const N =
    x.length

  const re =
    new Float64Array(x)

  const im =
    new Float64Array(N)


  // ----------------------------------------------------------
  // Bit reversal
  // ----------------------------------------------------------

  let j = 0

  for (
    let i = 1;
    i < N;
    i++
  ) {

    let bit =
      N >> 1

    while (
      j & bit
    ) {

      j ^= bit
      bit >>= 1
    }

    j ^= bit


    if (i < j) {

      const tmp =
        re[i]

      re[i] =
        re[j]

      re[j] =
        tmp
    }
  }


  // ----------------------------------------------------------
  // Cooley-Tukey
  // ----------------------------------------------------------

  for (
    let len = 2;
    len <= N;
    len <<= 1
  ) {

    const angle =
      -2 *
      Math.PI /
      len

    const wr0 =
      Math.cos(angle)

    const wi0 =
      Math.sin(angle)

    const half =
      len >> 1


    for (
      let i = 0;
      i < N;
      i += len
    ) {

      let wr = 1
      let wi = 0


      for (
        let j = 0;
        j < half;
        j++
      ) {

        const u =
          i + j

        const v =
          u + half


        const vr =
          re[v] * wr -
          im[v] * wi

        const vi =
          re[v] * wi +
          im[v] * wr


        const ur =
          re[u]

        const ui =
          im[u]


        re[u] =
          ur + vr

        im[u] =
          ui + vi

        re[v] =
          ur - vr

        im[v] =
          ui - vi


        const nextWr =
          wr * wr0 -
          wi * wi0

        const nextWi =
          wr * wi0 +
          wi * wr0

        wr =
          nextWr

        wi =
          nextWi
      }
    }
  }


  return {
    re,
    im
  }
}


// ============================================================
// ANALISI DI UNA FINESTRA
// ============================================================

function analizzaFinestra(
  audioBuffer,
  startSec,
  binIndices
) {

  const sampleRate =
    audioBuffer.sampleRate

  const audio =
    audioBuffer.getChannelData(0)


  const frame =
    new Float64Array(FFT_N)


  const start =
    Math.max(
      0,
      Math.floor(
        startSec *
        sampleRate
      )
    )


  // ----------------------------------------------------------
  // Copia + finestra di Hann
  // ----------------------------------------------------------

  for (
    let i = 0;
    i < FFT_N;
    i++
  ) {

    const index =
      start + i


    const x =
      index < audio.length
        ? audio[index]
        : 0


    const hann =
      0.5 -
      0.5 *
      Math.cos(
        2 *
        Math.PI *
        i /
        (FFT_N - 1)
      )


    frame[i] =
      x * hann
  }


  // ----------------------------------------------------------
  // FFT
  // ----------------------------------------------------------

  const fft =
    fftReale(frame)


  // ----------------------------------------------------------
  // Estrazione dei bin richiesti
  // ----------------------------------------------------------

  const profilo = []


  for (
    const bin
    of binIndices
  ) {

    const re =
      fft.re[bin]

    const im =
      fft.im[bin]


    const ampiezza =
      Math.sqrt(
        re * re +
        im * im
      )


    profilo.push(
      ampiezza
    )
  }


  return profilo
}


// ============================================================
// F0 COMPLETA
//
// 0.20 / 0.50 / 0.80
//       ↓
// FFT per ciascuna scansione
//       ↓
// media
//       ↓
// normalizzazione L1
// ============================================================

function analizzaF0(
  audioBuffer
) {

  const sampleRate =
    audioBuffer.sampleRate


  const griglia =
    costruisciGrigliaSpettrale(
      sampleRate
    )


  const profili = []


  for (
    const posizione
    of POSIZIONI
  ) {

    const centro =
      posizione *
      audioBuffer.duration


    let start =
      centro -
      SCAN_DUR / 2


    // equivalente concettuale
    // alla protezione dei bordi
    start =
      Math.max(
        0,
        Math.min(
          start,
          Math.max(
            0,
            audioBuffer.duration -
            SCAN_DUR
          )
        )
      )


    const profilo =
      analizzaFinestra(
        audioBuffer,
        start,
        griglia.binIndices
      )


    profili.push(
      profilo
    )
  }


  // ----------------------------------------------------------
  // Media dei tre profili
  // ----------------------------------------------------------

  const profiloMedio =
    Array(
      griglia.binIndices.length
    ).fill(0)


  for (
    const profilo
    of profili
  ) {

    for (
      let i = 0;
      i < profiloMedio.length;
      i++
    ) {

      profiloMedio[i] +=
        profilo[i]
    }
  }


  for (
    let i = 0;
    i < profiloMedio.length;
    i++
  ) {

    profiloMedio[i] /=
      profili.length
  }


  // ----------------------------------------------------------
  // Normalizzazione L1
  // ----------------------------------------------------------

  let somma =
    profiloMedio.reduce(
      (a, b) => a + b,
      0
    )


  const profiloNormalizzato =
    somma > 0
      ? profiloMedio.map(
          x => x / somma
        )
      : profiloMedio.map(
          () => 0
        )


  return {
    frequenze:
      griglia.frequenze,

    binIndices:
      griglia.binIndices,

    profiliSingoli:
      profili,

    profiloMedio:
      profiloMedio,

    profilo:
      profiloNormalizzato
  }
}


// ============================================================
// GRAFICO
// ============================================================

function disegnaProfilo(
  frequenze,
  profilo
) {

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  )


  if (
    profilo.length === 0
  ) {
    return
  }


  // ----------------------------------------------------------
  // Margini
  // ----------------------------------------------------------

  const left = 60
  const right = 20
  const top = 20
  const bottom = 40


  const width =
    canvas.width -
    left -
    right

  const height =
    canvas.height -
    top -
    bottom


  // ----------------------------------------------------------
  // Assi
  // ----------------------------------------------------------

  ctx.beginPath()

  ctx.moveTo(
    left,
    top
  )

  ctx.lineTo(
    left,
    top + height
  )

  ctx.lineTo(
    left + width,
    top + height
  )

  ctx.stroke()


  // ----------------------------------------------------------
  // Scala logaritmica sulle frequenze
  // ----------------------------------------------------------

  const logMin =
    Math.log10(
      frequenze[0]
    )

  const logMax =
    Math.log10(
      frequenze[
        frequenze.length - 1
      ]
    )


  const maxAmp =
    Math.max(
      ...profilo
    )


  // ----------------------------------------------------------
  // Profilo
  // ----------------------------------------------------------

  ctx.beginPath()


  for (
    let i = 0;
    i < profilo.length;
    i++
  ) {

    const x =
      left +
      (
        (
          Math.log10(
            frequenze[i]
          ) -
          logMin
        ) /
        (
          logMax -
          logMin
        )
      ) *
      width


    const y =
      top +
      height -
      (
        profilo[i] /
        maxAmp
      ) *
      height


    if (i === 0) {

      ctx.moveTo(
        x,
        y
      )

    } else {

      ctx.lineTo(
        x,
        y
      )
    }
  }


  ctx.stroke()


  // ----------------------------------------------------------
  // Etichette
  // ----------------------------------------------------------

  ctx.fillText(
    '40 Hz',
    left,
    canvas.height - 10
  )

  ctx.fillText(
    '15 kHz',
    canvas.width - 60,
    canvas.height - 10
  )

  ctx.fillText(
    'Profilo spettrale Φ',
    10,
    15
  )
}


// ============================================================
// PLAY
// ============================================================

playButton.addEventListener(
  'click',
  () => {

    samples({
      test: crowUrl
    })


    s('test')
      .gain(0.7)
      .room(0.5)
      .play()
  }
)


// ============================================================
// STOP
// ============================================================

stopButton.addEventListener(
  'click',
  () => {

    hush()
  }
)


// ============================================================
// ANALIZZA
// ============================================================

analyzeButton.addEventListener(
  'click',
  async () => {

    output.textContent =
      'Scaricamento del materiale...\n'


    try {

      const response =
        await fetch(
          crowUrl
        )


      if (!response.ok) {

        throw new Error(
          'HTTP ' +
          response.status
        )
      }


      const bytes =
        await response.arrayBuffer()


      output.textContent =
        'Decodifica audio...\n'


      const AudioContextClass =
        window.AudioContext ||
        window.webkitAudioContext


      const context =
        new AudioContextClass()


      const audioBuffer =
        await context.decodeAudioData(
          bytes
        )


      output.textContent =
        'Calcolo F0...\n'


      const risultato =
        analizzaF0(
          audioBuffer
        )


      // ============================================================
// ANALISI REALE DI 5 MATERIALI
//
// dataset
//    ↓
// scelta casuale di 5 materiali
//    ↓
// F0 reale
//    ↓
// Φ0 ... Φ4
//    ↓
// RŮŽIČKA
//    ↓
// P1
//    ↓
// MARKOV
// ============================================================


const analyzeSystemButton =
  document.querySelector('#analyzeSystem')


const datasetUrl =
  'https://raw.githubusercontent.com/tidalcycles/Dirt-Samples/master/strudel.json'


// ------------------------------------------------------------
// Famiglie che vogliamo privilegiare.
// Sono volutamente materiali non prettamente musicali.
// ------------------------------------------------------------

const famiglie =
  [
    'crow',
    'wind',
    'metal',
    'insect',
    'space'
  ]


// ------------------------------------------------------------
// Utility: trasforma il contenuto di una voce del JSON
// in una lista di file.
// ------------------------------------------------------------

function estraiFile(
  nodo
) {

  if (
    typeof nodo === 'string'
  ) {

    return [nodo]
  }


  if (
    Array.isArray(nodo)
  ) {

    const risultato = []

    for (
      const elemento
      of nodo
    ) {

      risultato.push(
        ...estraiFile(
          elemento
        )
      )
    }

    return risultato
  }


  if (
    nodo !== null &&
    typeof nodo === 'object'
  ) {

    const risultato = []

    for (
      const valore
      of Object.values(nodo)
    ) {

      risultato.push(
        ...estraiFile(
          valore
        )
      )
    }

    return risultato
  }


  return []
}


// ------------------------------------------------------------
// Carica il manifest Strudel
// ------------------------------------------------------------

async function caricaDataset() {

  const response =
    await fetch(
      datasetUrl
    )


  if (
    !response.ok
  ) {

    throw new Error(
      'Impossibile scaricare strudel.json: HTTP ' +
      response.status
    )
  }


  const json =
    await response.json()


  const base =
    json._base ||
    'https://raw.githubusercontent.com/tidalcycles/Dirt-Samples/master/'


  return {
    json,
    base
  }
}


// ------------------------------------------------------------
// Sceglie un file casuale appartenente a una famiglia
// ------------------------------------------------------------

function scegliFileFamiglia(
  json,
  base,
  famiglia
) {

  const nodo =
    json[famiglia]


  if (
    nodo === undefined
  ) {

    throw new Error(
      'Famiglia non trovata nel dataset: ' +
      famiglia
    )
  }


  const file =
    estraiFile(
      nodo
    )


  if (
    file.length === 0
  ) {

    throw new Error(
      'Nessun file nella famiglia: ' +
      famiglia
    )
  }


  const indice =
    Math.floor(
      Math.random() *
      file.length
    )


  const relativo =
    file[indice]


  const url =
    new URL(
      relativo,
      base
    ).href


  return {
    famiglia,
    relativo,
    url,
    numeroVarianti:
      file.length
  }
}


// ------------------------------------------------------------
// Analizza un materiale
// ------------------------------------------------------------
//
// RIUTILIZZIAMO la funzione analizzaF0()
// che abbiamo appena verificato sul corvo.
// ------------------------------------------------------------

async function analizzaMaterialeReale(
  materiale
) {

  const response =
    await fetch(
      materiale.url
    )


  if (
    !response.ok
  ) {

    throw new Error(
      'HTTP ' +
      response.status +
      ' durante il download di ' +
      materiale.url
    )
  }


  const bytes =
    await response.arrayBuffer()


  const AudioContextClass =
    window.AudioContext ||
    window.webkitAudioContext


  const context =
    new AudioContextClass()


  const audioBuffer =
    await context.decodeAudioData(
      bytes
    )


  const risultato =
    analizzaF0(
      audioBuffer
    )


  return {
    famiglia:
      materiale.famiglia,

    relativo:
      materiale.relativo,

    url:
      materiale.url,

    durata:
      audioBuffer.duration,

    sampleRate:
      audioBuffer.sampleRate,

    profilo:
      risultato.profilo,

    frequenze:
      risultato.frequenze
  }
}


// ------------------------------------------------------------
// RŮŽIČKA
// ------------------------------------------------------------

function ruzickaSistema(
  a,
  b
) {

  let sommaMin = 0
  let sommaMax = 0


  for (
    let i = 0;
    i < a.length;
    i++
  ) {

    sommaMin +=
      Math.min(
        a[i],
        b[i]
      )

    sommaMax +=
      Math.max(
        a[i],
        b[i]
      )
  }


  if (
    sommaMax > 0
  ) {

    return (
      sommaMin /
      sommaMax
    )
  }


  return 0
}


// ------------------------------------------------------------
// MATRICE P1
// ------------------------------------------------------------

function costruisciP1(
  profili
) {

  const N =
    profili.length

  const epsilon =
    0.01

  const gamma =
    0.45

  const P = []


  for (
    let i = 0;
    i < N;
    i++
  ) {

    const pesi = []


    for (
      let j = 0;
      j < N;
      j++
    ) {

      const similarita =
        ruzickaSistema(
          profili[i],
          profili[j]
        )


      let peso


      if (
        i === j
      ) {

        peso =
          similarita *
          gamma +
          epsilon

      } else {

        peso =
          similarita +
          epsilon
      }


      pesi.push(
        peso
      )
    }


    const somma =
      pesi.reduce(
        (
          a,
          b
        ) => a + b,
        0
      )


    P.push(
      pesi.map(
        x =>
          x / somma
      )
    )
  }


  return P
}


// ------------------------------------------------------------
// Estrazione pesata
// ------------------------------------------------------------

function scegliPesatoSistema(
  valori,
  pesi
) {

  const r =
    Math.random()

  let cumulativa =
    0


  for (
    let i = 0;
    i < valori.length;
    i++
  ) {

    cumulativa +=
      pesi[i]


    if (
      r <= cumulativa
    ) {

      return valori[i]
    }
  }


  return valori[
    valori.length - 1
  ]
}


// ------------------------------------------------------------
// CATENA DI MARKOV
// ------------------------------------------------------------

function generaMarkovSistema(
  P,
  lunghezza
) {

  const risultato = []

  let stato = 0


  for (
    let i = 0;
    i < lunghezza;
    i++
  ) {

    risultato.push(
      stato
    )


    const possibili =
      P[stato].map(
        (
          _,
          indice
        ) => indice
      )


    stato =
      scegliPesatoSistema(
        possibili,
        P[stato]
      )
  }


  return risultato
}


// ------------------------------------------------------------
// Listener principale
// ------------------------------------------------------------

analyzeSystemButton.addEventListener(
  'click',
  async () => {

    output.textContent =
      'Caricamento dataset...\n'


    try {

      // ======================================================
      // 1. DATASET
      // ======================================================

      const dataset =
        await caricaDataset()


      const json =
        dataset.json

      const base =
        dataset.base


      output.textContent =
        'Dataset caricato.\n\n'


      // ======================================================
      // 2. SCELTA DEI CINQUE MATERIALI
      // ======================================================

      const materialiScelti = []


      for (
        const famiglia
        of famiglie
      ) {

        const materiale =
          scegliFileFamiglia(
            json,
            base,
            famiglia
          )


        materialiScelti.push(
          materiale
        )
      }


      console.log(
        '=============================='
      )

      console.log(
        'MATERIALI SCELTI'
      )


      console.table(
        materialiScelti
      )


      output.textContent +=
        'MATERIALI SCELTI\n\n'


      for (
        const materiale
        of materialiScelti
      ) {

        output.textContent +=
          materiale.famiglia +
          '\n' +
          '  file: ' +
          materiale.relativo +
          '\n' +
          '  varianti disponibili: ' +
          materiale.numeroVarianti +
          '\n\n'
      }


      // ======================================================
      // 3. F0 REALE
      // ======================================================

      const materialiAnalizzati = []


      output.textContent +=
        'ANALISI F0\n\n'


      for (
        let i = 0;
        i < materialiScelti.length;
        i++
      ) {

        const materiale =
          materialiScelti[i]


        output.textContent +=
          'Analizzo ' +
          materiale.famiglia +
          '...\n'


        console.log(
          'Analisi F0:',
          materiale.url
        )


        const analizzato =
          await analizzaMaterialeReale(
            materiale
          )


        materialiAnalizzati.push(
          analizzato
        )
      }


      // ======================================================
      // 4. PROFILI
      // ======================================================

      console.log(
        '=============================='
      )

      console.log(
        'PROFILI F0 REALI'
      )


      console.table(
        materialiAnalizzati.map(
          materiale => ({

            famiglia:
              materiale.famiglia,

            file:
              materiale.relativo,

            durata:
              materiale.durata,

            sampleRate:
              materiale.sampleRate,

            bande:
              materiale.profilo.length
          })
        )
      )


      output.textContent +=
        '\nF0 COMPLETATA\n'


      for (
        const materiale
        of materialiAnalizzati
      ) {

        output.textContent +=
          materiale.famiglia +
          ' — ' +
          materiale.profilo.length +
          ' bande\n'
      }


      // ======================================================
      // 5. PROFILI COME MATRICE
      // ======================================================

      const profili =
        materialiAnalizzati.map(
          materiale =>
            materiale.profilo
        )


      // ======================================================
      // 6. MATRICE RŮŽIČKA
      // ======================================================

      const R = []


      for (
        let i = 0;
        i < profili.length;
        i++
      ) {

        const riga = []


        for (
          let j = 0;
          j < profili.length;
          j++
        ) {

          riga.push(
            ruzickaSistema(
              profili[i],
              profili[j]
            )
          )
        }


        R.push(
          riga
        )
      }


      console.log(
        '=============================='
      )

      console.log(
        'MATRICE DI RŮŽIČKA'
      )

      console.table(
        R
      )


      output.textContent +=
        '\nMATRICE DI RŮŽIČKA\n\n'


      for (
        const riga
        of R
      ) {

        output.textContent +=
          riga
            .map(
              x =>
                x.toFixed(4)
            )
            .join(
              '    '
            ) +
          '\n'
      }


      // ======================================================
      // 7. MATRICE P1
      // ======================================================

      const P1 =
        costruisciP1(
          profili
        )


      console.log(
        '=============================='
      )

      console.log(
        'MATRICE P1'
      )

      console.table(
        P1
      )


      output.textContent +=
        '\nMATRICE P1\n\n'


      for (
        const riga
        of P1
      ) {

        output.textContent +=
          riga
            .map(
              x =>
                x.toFixed(4)
            )
            .join(
              '    '
            ) +
          '\n'
      }


      // ======================================================
      // 8. CATENA DI MARKOV
      // ======================================================

      const catena =
        generaMarkovSistema(
          P1,
          40
        )


      console.log(
        '=============================='
      )

      console.log(
        'CATENA MARKOV'
      )

      console.log(
        catena
      )


      output.textContent +=
        '\nCATENA MARKOV\n\n'


      output.textContent +=
        catena.join(
          ' → '
        )


      // ======================================================
      // 9. SALVIAMO TUTTO
      // ======================================================

      globalThis.sistemaReale = {

        materiali:
          materialiAnalizzati,

        profili:
          profili,

        R:
          R,

        P1:
          P1,

        catena:
          catena
      }


      output.textContent +=
        '\n\n\nRisultati disponibili in:\n' +
        'globalThis.sistemaReale'


    } catch (
      errore
    ) {

      console.error(
        errore
      )


      output.textContent =
        'ERRORE:\n\n' +
        errore.message
    }
  }
)

      // ------------------------------------------------------
      // Salviamo il risultato globalmente
      // ------------------------------------------------------

      globalThis.profiloCrow =
        risultato


      // ------------------------------------------------------
      // Statistiche
      // ------------------------------------------------------

      const somma =
        risultato.profilo.reduce(
          (a, b) => a + b,
          0
        )


      const max =
        Math.max(
          ...risultato.profilo
        )


      const indiceMax =
        risultato.profilo.indexOf(
          max
        )


      const frequenzaMax =
        risultato.frequenze[
          indiceMax
        ]


      // ------------------------------------------------------
      // OUTPUT
      // ------------------------------------------------------

      let testo = ''

      testo +=
        'F0 — ANALISI REALE\n'

      testo +=
        '========================\n\n'

      testo +=
        'File: crow/000_crow.wav\n'

      testo +=
        'Durata: ' +
        audioBuffer.duration.toFixed(3) +
        ' s\n'

      testo +=
        'Sample rate: ' +
        audioBuffer.sampleRate +
        ' Hz\n'

      testo +=
        'FFT: ' +
        FFT_N +
        '\n'

      testo +=
        'Scansioni: ' +
        POSIZIONI.join(
          ' / '
        ) +
        '\n'

      testo +=
        'Frequenze richieste: ' +
        NUM_FREQ_RICHIESTE +
        '\n'

      testo +=
        'Bin FFT distinti: ' +
        risultato.binIndices.length +
        '\n\n'


      testo +=
        'Somma profilo normalizzato: ' +
        somma.toFixed(9) +
        '\n'

      testo +=
        'Picco del profilo: ' +
        max.toFixed(6) +
        '\n'

      testo +=
        'Frequenza del picco: ' +
        frequenzaMax.toFixed(1) +
        ' Hz\n\n'


      testo +=
        'PRIMI 20 ELEMENTI DI Φ:\n\n'


      for (
        let i = 0;
        i < Math.min(
          20,
          risultato.profilo.length
        );
        i++
      ) {

        testo +=
          String(i + 1).padStart(
            3,
            ' '
          ) +
          '  ' +
          risultato.frequenze[i]
            .toFixed(1)
            .padStart(8, ' ') +
          ' Hz   ' +
          risultato.profilo[i]
            .toFixed(8) +
          '\n'
      }


      output.textContent =
        testo


      // ------------------------------------------------------
      // Disegno
      // ------------------------------------------------------

      disegnaProfilo(
        risultato.frequenze,
        risultato.profilo
      )


    } catch (error) {

      console.error(
        error
      )


      output.textContent =
        'ERRORE:\n' +
        error.message
    }
  }
)

// ============================================================
// RIPRODUZIONE DELLA CATENA MARKOV REALE
// ============================================================

const playSystemButton =
  document.querySelector('#playSystem')


playSystemButton.addEventListener(
  'click',
  async () => {

    // Verifica che l'analisi sia già stata eseguita.

    if (
      !globalThis.sistemaReale
    ) {

      output.textContent =
        'Prima premi "ANALIZZA 5 MATERIALI".'

      return
    }


    const sistema =
      globalThis.sistemaReale


    const materiali =
      sistema.materiali

    const catena =
      sistema.catena


    // --------------------------------------------------------
    // Creiamo un alias per ciascun materiale.
    //
    // tesi0 = primo WAV analizzato
    // tesi1 = secondo WAV
    // ...
    // --------------------------------------------------------

    const sampleMap = {}

    for (
      let i = 0;
      i < materiali.length;
      i++
    ) {

      sampleMap[
        'tesi' + i
      ] =
        materiali[i].url
    }


    // --------------------------------------------------------
    // Trasformiamo:
    //
    // 0 1 1 4 0 2 ...
    //
    // in:
    //
    // tesi0 tesi1 tesi1 tesi4 ...
    // --------------------------------------------------------

    const nomi =
      catena.map(
        indice =>
          'tesi' + indice
      )


    console.log(
      'SAMPLE MAP'
    )

    console.log(
      sampleMap
    )


    console.log(
      'CATENA SONORA'
    )

    console.log(
      nomi
    )


    output.textContent =
      'COMPOSIZIONE GENERATA\n\n' +
      nomi.join(
        ' → '
      )


    // --------------------------------------------------------
    // Carichiamo ESATTAMENTE i file già analizzati.
    // --------------------------------------------------------

    samples(
      sampleMap
    )


    // --------------------------------------------------------
    // Riproduzione.
    // Per ora niente granulazione:
    // vogliamo verificare soltanto la causalità
    //
    // analisi -> Markov -> materiale
    // --------------------------------------------------------

    s(
      seq(
        ...nomi
      )
    )
      .slow(3)
      .gain(0.5)
      .room(0.45)
      .size(0.8)
      .play()
  }
)
