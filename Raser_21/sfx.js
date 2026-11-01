// --- Sound: effects and music, by game phase ---
//   Start screen   theme on loop, no radio events · honk per car · radio call when both are found
//   Ready          theme fades · ignition · radio chatter · typewriter + bell
//   Countdown      no music · engine idling · bass hit per number
//   LOS!           race track (alternates per match) · launch roar
//   Race           chase siren by distance · crash · cone · ticks in the last 10 s
//                  · radio drops out, voices cut in, news & talk, station switches
//   Point screen   music ducked · siren + thud or explosion · engine roar on resume
//   Final screen   race track stops · buzzer · winner's sound · record jingle · theme

// Effects. File sounds come from raser-sfx/: offset / duration (s) trim a file,
// sounds with a duration fade out at the end, rate changes speed and pitch,
// loop repeats the file. Synth sounds are generated below and need no file.
const sfxDefinitions = {
  // Start screen
  honkBulle: { file: "dragon-studio-car-honk-386166.mp3", volume: 0.45 },
  // Same honk pitched up, so the two cars sound different
  honkRaser: { file: "dragon-studio-car-honk-386166.mp3", volume: 0.45, rate: 1.25 },
  // The transmission starts 1.2 s into the file
  radioCall: { file: "u_19fxxx30l0-radio-trasmittente-della-polizia-324010.mp3", volume: 0.4, offset: 1.15, duration: 2.5 },

  // Ready screen
  // Crank, then the engine catches ~1.1 s in and runs
  ignition: { file: "mixkit-car-ignition-1535.wav", volume: 0.6, duration: 4.5 },
  radioChatter: { file: "freesound_community-police-radio-chatter-30048.mp3", volume: 0.22, offset: 0.2, duration: 5.5 },
  type: { file: "mixkit-typewriter-hit-1362.wav", volume: 0.35 },
  bell: { synth: synthBell, volume: 0.25 },

  // Countdown
  idle: { file: "u_z6v4xovwrs-hot-rod-idle-573183.mp3", volume: 0.45, loop: true },
  count: { file: "mixkit-short-bass-hit-2299.wav", volume: 0.8 },
  // The pass is loud from ~0.5 s
  launch: { file: "astonmartinvantagev12-chevrolet-corvette-c6-sound-effect-360531.mp3", volume: 0.75, offset: 0.4, duration: 3.5 },

  // Race
  // Loops while the Bulle is close to the Raser, louder the closer it gets
  chase: { file: "freesound_community-police-siren-one-loop-loop-able-104019.mp3", volume: 0.5, loop: true },
  crash: { file: "dragon-studio-car-crash-sound-effect-376874.mp3", volume: 0.8, duration: 1.4 },
  // The rattle only starts 0.4 s into the file
  cone: { file: "mixkit-thin-metal-card-deck-shuffle-3175.wav", volume: 0.7, offset: 0.35, duration: 0.6 },
  tick: { synth: synthTick, volume: 0.6 },
  tickFinal: { synth: synthBeep, volume: 0.3 },

  // Point screens
  siren: { file: "rahmad_irwansyah-indonesian-police-sirens-155884.mp3", volume: 0.7, duration: 2.6 },
  busted: { file: "mixkit-short-bass-hit-2299.wav", volume: 1 },
  // Cut to the length of the point screen
  explosion: { file: "mixkit-car-explosion-debris-1562.wav", volume: 0.8, duration: 3 },
  rev: { file: "dragon-studio-car-engine-roaring-376881.mp3", volume: 0.6, duration: 2.5 },

  // Final screen
  buzzer: { synth: synthBuzzer, volume: 0.22 },
  // The loudest wail of the long siren
  sirenWin: { file: "11325622-police-siren-sound-effect-240674.mp3", volume: 0.7, offset: 9, duration: 3.5 },
  // The Raser gets away: the end of the pass, fading into the distance
  getaway: { file: "astonmartinvantagev12-chevrolet-corvette-c6-sound-effect-360531.mp3", volume: 0.75, offset: 5, duration: 3.5 },
  record: { synth: synthRecord, volume: 0.28 },
};

// Music streams from the file (no full decode, songs are minutes long).
// start (s) is where 60 s of the song stay at full energy, skipping intros
// and breaks. The volumes even out how loud the songs were mastered
// (measured over those 60 s), so every race sounds equally loud.
// title (artist – song) is shown in the race sidebar while the track plays
const musicTracks = {
  theme: { file: "Ambitione Vomene Sportwage-Fahrer.mp3", title: "Cinnay, DJ STR – Ambitione vomene Sportwage-Fahrer", volume: 0.35, loop: true },
  boom: { file: "Tito El Bambino - Siente El Boom ft. Randy [Official Audio].mp3", title: "Tito El Bambino – Siente El Boom", volume: 0.3, start: 8 },
  zivi: { file: "Jordan Parat - Stich en Zivi!.mp3", title: "Jordan Parat – Stich en Zivi!", volume: 0.52, start: 34 },
  bikini: { file: "Ikkimel - BIKINI GRELL (prod. by Robbensohn Offizielles Musikvideo).mp3", title: "Ikkimel – Bikini Grell", volume: 0.6, start: 10 },
  rose: { file: "Lo & Leduc - Rosé und Benzin (prod. by Jugglerz).mp3", title: "Lo & Leduc – Rosé und Benzin", volume: 0.29, start: 34 },
  logic: { file: "Logic.mp3", title: "Euology – Logic", volume: 0.6, start: 80 },
  chischte: { file: "Gölä & Trauffer - E Chischte Bier, e Grill u es Füür (Official Video).mp3", title: "Gölä & Trauffer – E Chischte Bier, e Grill u es Füür", volume: 0.38, start: 72 },
  metavers: { file: "Métavers.mp3", title: "Nathalie Froehlich – Métavers", volume: 0.34, start: 80 },
  virus: { file: "Luuk am Virus Bounce Cypher 2017 #Cypher17 SRF Virus.mp3", title: "Luuk – Virus Bounce Cypher 2017", volume: 1.65, start: 75 },
};
// The race tracks take turns, in an order shuffled once per page load
const raceMusic = ["boom", "zivi", "bikini", "rose", "logic", "chischte", "metavers", "virus"];
for (let i = raceMusic.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [raceMusic[i], raceMusic[j]] = [raceMusic[j], raceMusic[i]];
}

const audioContext = new AudioContext();
const sfxBuffers = new Map();
const activeSfx = new Set();
const sfxLoops = new Map();
let sfxEnabled = true;
let musicEnabled = true;

// Effects go through one compressor, so overlapping sounds don't clip.
// Music has its own path, so loud effects don't pump the music
const sfxOutput = audioContext.createDynamicsCompressor();
sfxOutput.threshold.value = -14;
sfxOutput.knee.value = 10;
sfxOutput.ratio.value = 4;
sfxOutput.attack.value = 0.003;
sfxOutput.release.value = 0.25;
sfxOutput.connect(audioContext.destination);

const sfxFiles = new Set(Object.values(sfxDefinitions).map(({ file }) => file).filter(Boolean));
for (const file of sfxFiles) {
  fetch(`raser-sfx/${encodeURIComponent(file)}`)
    .then((response) => response.arrayBuffer())
    .then((data) => audioContext.decodeAudioData(data))
    .then((buffer) => sfxBuffers.set(file, buffer))
    .catch((error) => console.warn("Sound konnte nicht geladen werden:", file, error));
}

// Browsers only allow audio after the first click or key press on the page;
// music that was asked for before that starts then
function unlockAudio(){
  if (audioContext.state === "running") return;
  audioContext.resume().then(() => {
    if (music.current) music.current.element.play().catch(() => {});
  });
}
window.addEventListener("pointerdown", unlockAudio);
window.addEventListener("keydown", unlockAudio);

// delay (s) schedules the sound inside Web Audio, so stopAllSfx also cancels it
function playSfx(name, delay = 0){
  const definition = sfxDefinitions[name];
  if (!sfxEnabled || audioContext.state !== "running") return;

  const time = audioContext.currentTime + delay;
  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(definition.volume, time);
  gain.connect(sfxOutput);

  let sources;
  if (definition.synth) {
    sources = definition.synth(gain, time);
  } else {
    const buffer = sfxBuffers.get(definition.file);
    if (!buffer) return;
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = definition.rate ?? 1;
    source.loop = definition.loop ?? false;
    source.connect(gain);

    const offset = definition.offset ?? 0;
    if (definition.duration) {
      const fade = Math.min(0.8, definition.duration / 3);
      gain.gain.setValueAtTime(definition.volume, time + definition.duration - fade);
      gain.gain.linearRampToValueAtTime(0, time + definition.duration);
      source.start(time, offset, definition.duration);
    } else {
      source.start(time, offset);
    }
    sources = [source];
  }

  const sound = { gain, sources };
  activeSfx.add(sound);
  let playing = sources.length;
  for (const source of sources) {
    source.addEventListener("ended", () => {
      playing -= 1;
      if (playing === 0) activeSfx.delete(sound);
    });
  }
}

// Endless loop whose level (0–1, times the sound's volume) can change every
// frame; it fades smoothly to each new level and keeps running at 0
function setSfxLoop(name, level){
  if (!sfxEnabled || audioContext.state !== "running") return;

  let loop = sfxLoops.get(name);
  if (!loop) {
    if (level <= 0) return;
    const buffer = sfxBuffers.get(sfxDefinitions[name].file);
    if (!buffer) return;
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = audioContext.createGain();
    gain.gain.value = 0;
    source.connect(gain).connect(sfxOutput);
    source.start();
    loop = { gain, sources: [source], level: 0 };
    sfxLoops.set(name, loop);
  }

  if (Math.abs(level - loop.level) < 0.01) return;
  loop.level = level;
  loop.gain.gain.setTargetAtTime(level * sfxDefinitions[name].volume, audioContext.currentTime, 0.15);
}

// Short fade instead of a hard cut, e.g. when the game is reset mid-countdown
function stopAllSfx(){
  const now = audioContext.currentTime;
  for (const loop of sfxLoops.values()) activeSfx.add(loop);
  sfxLoops.clear();
  for (const { gain, sources } of activeSfx) {
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.1);
    for (const source of sources) {
      try { source.stop(now + 0.1); } catch {}
    }
  }
  activeSfx.clear();
}

// --- Music ---
const music = {
  output: audioContext.createGain(), // music on/off
  duck: audioContext.createGain(),   // lowered under point screens
  signal: audioContext.createGain(), // drops out during radio breaks
  tracks: new Map(),
  current: null,
  pendingTimer: null,
  raceIndex: 0,
  startedAt: 0,
  raceStartedAt: 0,
};
music.signal.connect(music.duck);
connectCarRadio(music.duck, music.output);
music.output.connect(audioContext.destination);

// Makes the music sound like it plays from the car's speakers: mono, no deep
// bass or bright highs, a boxy door-panel boom, a pushed midrange, a little
// distortion and squashed dynamics
function connectCarRadio(input, output){
  const mono = audioContext.createGain();
  mono.channelCount = 1;
  mono.channelCountMode = "explicit";
  mono.channelInterpretation = "speakers";

  const filter = (type, frequency, Q = 0.7, gain = 0) => {
    const node = audioContext.createBiquadFilter();
    node.type = type;
    node.frequency.value = frequency;
    node.Q.value = Q;
    node.gain.value = gain;
    return node;
  };
  const lowCut = filter("highpass", 110, 0.9);
  const boom = filter("peaking", 160, 1.2, 5);
  const mud = filter("peaking", 450, 1, -3);
  const presence = filter("peaking", 1800, 0.8, 5);
  const highCut = filter("lowpass", 5000, 0.9);

  // Soft clipping, like a small amp turned up
  const drive = audioContext.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 1.8) / Math.tanh(1.8);
  }
  drive.curve = curve;
  drive.oversample = "2x";

  const squash = audioContext.createDynamicsCompressor();
  squash.threshold.value = -22;
  squash.knee.value = 6;
  squash.ratio.value = 5;
  squash.attack.value = 0.005;
  squash.release.value = 0.2;

  // Makes up for the level the filters and compressor take away
  const makeup = audioContext.createGain();
  makeup.gain.value = 1.6;

  input.connect(mono).connect(lowCut).connect(boom).connect(mud).connect(presence)
    .connect(highCut).connect(drive).connect(squash).connect(makeup).connect(output);
}

for (const [name, track] of Object.entries(musicTracks)) {
  // No file yet: a song only connects when it is needed (connectMusic) and lets
  // go when it stops. Browsers allow ~6 connections per server, and buffering
  // songs would otherwise block the sound effects and fonts
  const element = new Audio();
  element.preload = "auto";
  element.loop = track.loop ?? false;
  const gain = audioContext.createGain();
  gain.gain.value = 0;
  audioContext.createMediaElementSource(element).connect(gain).connect(music.signal);
  music.tracks.set(name, { ...track, name, element, gain });
}

// Fades the current track out and the new one in. delay (s) waits first,
// e.g. until the final screen's sounds are over; any later music call cancels it.
// from (s) starts the song there instead of at its start point
function playMusic(name, { fade = 1, delay = 0, from } = {}){
  clearTimeout(music.pendingTimer);
  music.pendingTimer = null;
  if (delay > 0) {
    music.pendingTimer = setTimeout(() => playMusic(name, { fade }), delay * 1000);
    return;
  }

  const track = music.tracks.get(name);
  if (music.current === track && !track.element.paused) return;
  fadeOutMusic(fade);

  const now = audioContext.currentTime;
  if (connectMusic(track) || track.element.paused) track.element.currentTime = from ?? track.start ?? 0;
  track.gain.gain.cancelScheduledValues(now);
  track.gain.gain.setValueAtTime(0, now);
  track.gain.gain.linearRampToValueAtTime(track.volume, now + fade);
  track.element.play().catch(() => {}); // starts on the first click if audio is still locked
  music.current = track;
  music.startedAt = now;
  announceRadio(track.title);
}

function stopMusic(fade = 1){
  clearTimeout(music.pendingTimer);
  music.pendingTimer = null;
  fadeOutMusic(fade);
  stopTalk(fade);
  music.current = null;
  announceRadio(null);
}

// What the car radio plays right now: the song, or the voice or talk cutting
// in over it (null: off). main.js shows it in the race sidebar
function announceRadio(title){
  document.dispatchEvent(new CustomEvent("radiochange", { detail: { title } }));
}

// Back to the song once a voice or talk is over
function announceSong(){
  announceRadio(music.current?.title ?? null);
}

function fadeOutMusic(fade){
  const track = music.current;
  if (!track) return;
  const now = audioContext.currentTime;
  track.gain.gain.cancelScheduledValues(now);
  track.gain.gain.setValueAtTime(track.gain.gain.value, now);
  track.gain.gain.linearRampToValueAtTime(0, now + fade);
  setTimeout(() => {
    if (music.current !== track) disconnectMusic(track);
  }, fade * 1000 + 50);
}

// Gives the track its file; returns whether it was newly connected
function connectMusic(track){
  if (track.element.getAttribute("src")) return false;
  track.element.src = `raser-sfx/${encodeURIComponent(track.file)}`;
  return true;
}

function disconnectMusic(track){
  track.element.pause();
  track.element.removeAttribute("src");
  track.element.load(); // drops the buffered data and the connection
}

// Starts buffering the next race track at its start point, a few seconds
// before it is needed (called on the ready screen)
function prepareRaceMusic(){
  const track = music.tracks.get(raceMusic[music.raceIndex % raceMusic.length]);
  connectMusic(track);
  track.element.currentTime = track.start ?? 0;
}

// The next race track in turn
function playRaceMusic(){
  const name = raceMusic[music.raceIndex % raceMusic.length];
  music.raceIndex += 1;
  playMusic(name, { fade: 0.3 });
  music.raceStartedAt = audioContext.currentTime;
  prepareRaceMusic(); // ready for a station switch
}

// 1 = full, lower values keep the music under a point screen
function duckMusic(level){
  const now = audioContext.currentTime;
  music.duck.gain.cancelScheduledValues(now);
  music.duck.gain.setValueAtTime(music.duck.gain.value, now);
  music.duck.gain.linearRampToValueAtTime(level, now + 0.3);
}

// --- Radio: the reception drops out, voices cut in, news & talk, the station switches ---
// While music plays, one of these happens every few seconds. Radio sounds go
// into the music path, so they are ducked, switched off and filtered like it
const radioEventEvery = [12, 22]; // seconds between events, min and max
const radioBreakLength = [0.5, 1.8];
const radioSounds = {
  tuning: { file: "freesound_community-tuning-radio-7150.mp3", volume: 3 },
  // parts: the separate lines in the file (start, end in s)
  lines: {
    file: "freesound_community-generic-radio-lines-31698.mp3", title: "Polizeifunk", volume: 0.9,
    parts: [[0.3, 2.64], [2.9, 4.76], [5.06, 6.64], [6.9, 8.82], [9.34, 10.9], [11.4, 12.74],
      [13.24, 15.04], [15.42, 17.2], [17.52, 19.28], [19.7, 21.58], [21.96, 23.64]],
  },
  taxi: { file: "freesound_community-taxi-radio-103044.mp3", title: "Taxifunk", volume: 0.9 },
};
// Talk on other stations streams like the songs (the news is minutes long).
// starts: where sentences begin (s). title: the station, shown while it plays
const radioTalk = [
  {
    file: "SRF 3 – Nachrichten vom 01.11.2013.mp3", title: "SRF 3", volume: 0.5,
    starts: [0.28, 36.38, 44.48, 45.96, 79.36, 94.36, 96.16, 102.04, 112.54, 121.7, 129.56, 134.26,
      137.84, 139.06, 207, 215.26, 220.14, 222.72, 230.32, 237.74, 252.88, 257.28, 263.1, 268.12,
      272.52, 278.56, 290.62, 292.52, 299.76],
  },
  {
    file: "Rapper EAZ an junge Rap-Artists «Macht euren Sh t, aber einfach ohne uns!» 💀 Bounce SRF #shorts.mp3",
    title: "SRF Virus",
    volume: 0.8,
    starts: [0.26, 11.96, 15.66, 18.92, 23.76, 26.3],
  },
  {
    file: "Trinkt Jule X wirklich so viel Bounce SRF #shorts.mp3", title: "SRF Virus", volume: 1.25,
    starts: [0.18, 5.46, 11.14, 13.1, 18.66, 22.34],
  },
  {
    file: "Dr Trueberbueb Jule X bringt den wildesten Geheimtipp in unsere Reaction Show! 👀 Bounce SRF.mp3",
    title: "SRF Virus",
    volume: 0.53,
    starts: [0.06, 5.28, 7.44, 13.68, 23.12, 24.76, 31.68, 34.98, 40.2, 48.18],
  },
].map((talk) => {
  const element = new Audio();
  element.preload = "none";
  element.src = `raser-sfx/${encodeURIComponent(talk.file)}`;
  const gain = audioContext.createGain();
  gain.gain.value = 0;
  audioContext.createMediaElementSource(element).connect(gain).connect(music.duck);
  return { ...talk, element, gain, timer: null };
});

const radioBuffers = new Map();
for (const { file } of Object.values(radioSounds)) {
  fetch(`raser-sfx/${encodeURIComponent(file)}`)
    .then((response) => response.arrayBuffer())
    .then((data) => audioContext.decodeAudioData(data))
    .then((buffer) => radioBuffers.set(file, buffer))
    .catch((error) => console.warn("Sound konnte nicht geladen werden:", file, error));
}

let staticBuffer = null;
// Static from a random spot of the tuning recording (noise until it has
// loaded); returns its volume, silent at `time`, for the caller to shape
function playStatic(time, length){
  const tuning = radioBuffers.get(radioSounds.tuning.file);
  const source = audioContext.createBufferSource();
  const level = audioContext.createGain();
  let offset;
  if (tuning) {
    source.buffer = tuning;
    offset = randomBetween(0, tuning.duration - length - 2);
    level.gain.value = radioSounds.tuning.volume;
    source.connect(level);
  } else {
    if (!staticBuffer) {
      staticBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 2, audioContext.sampleRate);
      const data = staticBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    source.buffer = staticBuffer;
    source.loop = true;
    offset = Math.random();
    const filter = audioContext.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 2200;
    filter.Q.value = 0.6;
    source.connect(filter).connect(level);
  }
  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0, time);
  level.connect(gain).connect(music.duck);
  source.start(time, offset);
  source.stop(time + length + 0.1);
  return gain.gain;
}

// Plays `length` s of a radio recording from `offset`, with short fades
function playRadioSound(name, time, offset, length){
  const { file, volume } = radioSounds[name];
  const source = audioContext.createBufferSource();
  source.buffer = radioBuffers.get(file);
  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(volume, time + 0.03);
  gain.gain.setValueAtTime(volume, time + length - 0.05);
  gain.gain.linearRampToValueAtTime(0, time + length);
  source.connect(gain).connect(music.duck);
  source.start(time, offset);
  source.stop(time + length);
}

// The signal flickers in and out, the static fills the gaps
function radioBreak(){
  const now = audioContext.currentTime;
  const length = randomBetween(...radioBreakLength);
  const noise = playStatic(now, length);
  const signal = music.signal.gain;
  signal.cancelScheduledValues(now);
  signal.setValueAtTime(signal.value, now);
  for (let time = now; time < now + length; time += randomBetween(0.04, 0.12)) {
    const level = [0, 0.05, 0.2, 0.5][Math.floor(Math.random() * 4)];
    signal.linearRampToValueAtTime(level, time + 0.02);
    noise.linearRampToValueAtTime((1 - level) * randomBetween(0.15, 0.35), time + 0.02);
  }
  signal.linearRampToValueAtTime(1, now + length + 0.1);
  noise.linearRampToValueAtTime(0, now + length + 0.1);
}

// A dispatcher or a taxi radio cuts in over the song, then the song returns
function radioVoice(){
  const name = Math.random() < 0.6 ? "lines" : "taxi";
  const buffer = radioBuffers.get(radioSounds[name].file);
  if (!buffer) return radioBreak();
  let offset, length;
  if (name === "lines") {
    const [start, end] = radioSounds.lines.parts[Math.floor(Math.random() * radioSounds.lines.parts.length)];
    offset = start;
    length = end - start;
  } else {
    length = randomBetween(2.5, 4.5);
    offset = randomBetween(0, buffer.duration - length);
  }

  const now = audioContext.currentTime;
  const end = now + 0.3 + length;
  playRadioSound(name, now + 0.3, offset, length);
  announceRadio(radioSounds[name].title);
  setTimeout(announceSong, (end - now + 0.6) * 1000);
  const noise = playStatic(now, length + 0.8);
  noise.linearRampToValueAtTime(0.35, now + 0.15);
  noise.linearRampToValueAtTime(0.08, now + 0.3);
  noise.setValueAtTime(0.08, end);
  noise.linearRampToValueAtTime(0.3, end + 0.15);
  noise.linearRampToValueAtTime(0, end + 0.6);

  const signal = music.signal.gain;
  signal.cancelScheduledValues(now);
  signal.setValueAtTime(signal.value, now);
  signal.linearRampToValueAtTime(0.12, now + 0.2);
  signal.setValueAtTime(0.12, end + 0.15);
  signal.linearRampToValueAtTime(1, end + 0.6);
}

// The radio is turned over to the news or an interview for a few seconds,
// then back to the song
function talkBreak(){
  const now = audioContext.currentTime;
  const length = randomBetween(4, 7);
  const end = now + 0.5 + length;
  const talk = radioTalk[Math.floor(Math.random() * radioTalk.length)];
  const { element, starts, volume } = talk;
  element.currentTime = starts[Math.floor(Math.random() * starts.length)];
  element.play().catch(() => {});

  const voice = talk.gain.gain;
  voice.cancelScheduledValues(now);
  voice.setValueAtTime(0, now + 0.3);
  voice.linearRampToValueAtTime(volume, now + 0.5);
  voice.setValueAtTime(volume, end);
  voice.linearRampToValueAtTime(0, end + 0.15);
  clearTimeout(talk.timer);
  announceRadio(talk.title);
  talk.timer = setTimeout(() => {
    element.pause();
    announceSong();
  }, (end - now + 0.3) * 1000);

  const noise = playStatic(now, end - now + 0.6);
  noise.linearRampToValueAtTime(0.45, now + 0.25);
  noise.linearRampToValueAtTime(0.05, now + 0.6);
  noise.setValueAtTime(0.05, end - 0.1);
  noise.linearRampToValueAtTime(0.45, end + 0.15);
  noise.linearRampToValueAtTime(0, end + 0.6);

  const signal = music.signal.gain;
  signal.cancelScheduledValues(now);
  signal.setValueAtTime(signal.value, now);
  signal.linearRampToValueAtTime(0, now + 0.4);
  signal.setValueAtTime(0, end);
  signal.linearRampToValueAtTime(1, end + 0.6);
}

function stopTalk(fade){
  const now = audioContext.currentTime;
  for (const talk of radioTalk) {
    const voice = talk.gain.gain;
    voice.cancelScheduledValues(now);
    voice.setValueAtTime(voice.value, now);
    voice.linearRampToValueAtTime(0, now + fade);
    clearTimeout(talk.timer);
    talk.timer = setTimeout(() => talk.element.pause(), fade * 1000);
  }
}

// The radio jumps to another station: the next race song, from somewhere in
// its 60 s at full energy
function switchStation(){
  const name = raceMusic[music.raceIndex % raceMusic.length];
  music.raceIndex += 1;
  const track = music.tracks.get(name);
  playMusic(name, { fade: 1.2, from: (track.start ?? 0) + randomBetween(0, 20) });
  tuneRadio(1.2);
  prepareRaceMusic();
}

// Changing songs sounds like turning the dial: the music sinks into static
// and the new song comes up out of it
function tuneRadio(fade){
  if (audioContext.state !== "running") return;
  const now = audioContext.currentTime;
  const length = Math.max(fade, 0.5);
  const noise = playStatic(now, length);
  noise.linearRampToValueAtTime(0.45, now + length * 0.4);
  noise.linearRampToValueAtTime(0, now + length);

  const signal = music.signal.gain;
  signal.cancelScheduledValues(now);
  signal.setValueAtTime(signal.value, now);
  signal.linearRampToValueAtTime(0.1, now + length * 0.4);
  signal.linearRampToValueAtTime(1, now + length);
}

function randomBetween(min, max){
  return min + Math.random() * (max - min);
}

// The radio reacts to the race: chance of a station switch, or else of a
// reception break, per game event
const radioReactions = {
  crash: { switch: 0.35, break: 0.45 },   // the radio gets knocked
  cone: { switch: 0.25, break: 0.2 },
  resume: { switch: 0.7, break: 0 },      // after a point screen
  finalSeconds: { switch: 0.5, break: 0 }, // last 10 s of the match
};
// A song that ran this long without a switch changes anyway on the next timer event
const radioSwitchAfter = 30;
// The start of a race stays clean: no timer events for this long
const radioCalmStart = 15;

// Whether a race song has been playing for a few seconds, so events don't
// pile up. The start screen's theme plays without radio events
function radioSettled(){
  const track = music.current;
  return track && raceMusic.includes(track.name) && !track.element.paused
    && musicEnabled && audioContext.state === "running"
    && audioContext.currentTime - music.startedAt > 6;
}

function radioReact(event){
  if (!radioSettled()) return;
  const chance = radioReactions[event];
  const roll = Math.random();
  if (roll < chance.switch) switchStation();
  else if (roll < chance.switch + chance.break) radioBreak();
}

// Between game events: breaks, voices and talk, or a station switch when
// the song has run long enough
(function scheduleRadioEvent(){
  setTimeout(() => {
    const calm = audioContext.currentTime - music.raceStartedAt < radioCalmStart;
    if (radioSettled() && !calm) {
      const longRunning = audioContext.currentTime - music.startedAt > radioSwitchAfter;
      const events = [radioBreak, radioVoice, talkBreak];
      if (longRunning) switchStation();
      else events[Math.floor(Math.random() * events.length)]();
    }
    scheduleRadioEvent();
  }, randomBetween(...radioEventEvery) * 1000);
})();

document.getElementById("sfx-enabled").addEventListener("change", (event) => {
  sfxEnabled = event.target.checked;
  if (!sfxEnabled) stopAllSfx();
});

document.getElementById("music-enabled").addEventListener("change", (event) => {
  musicEnabled = event.target.checked;
  music.output.gain.setTargetAtTime(musicEnabled ? 1 : 0, audioContext.currentTime, 0.1);
});

// --- Synth sounds: each connects to `output`, starts at `time` and returns its sources ---

// Gain into `output` that rises in `attack` and decays to silence at `length`
function envelope(output, time, attack, length, peak = 1){
  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.linearRampToValueAtTime(peak, time + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + length);
  gain.connect(output);
  return gain;
}

function oscillator(type, frequency, output, time, length){
  const osc = audioContext.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, time);
  osc.connect(output);
  osc.start(time);
  osc.stop(time + length);
  return osc;
}

// Clock tick: a very short burst of noise through a band
let noiseBuffer = null;
function synthTick(output, time){
  if (!noiseBuffer) {
    noiseBuffer = audioContext.createBuffer(1, Math.round(audioContext.sampleRate * 0.05), audioContext.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const source = audioContext.createBufferSource();
  source.buffer = noiseBuffer;
  const filter = audioContext.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 3200;
  filter.Q.value = 2;
  // The band filter removes most of the noise, so the envelope makes up for it
  source.connect(filter).connect(envelope(output, time, 0.002, 0.04, 4));
  source.start(time);
  return [source];
}

// Last three seconds: a clear beep instead of a tick
function synthBeep(output, time){
  return [oscillator("sine", 1760, envelope(output, time, 0.005, 0.18), time, 0.2)];
}

// Final buzzer: two low square waves a fifth apart
function synthBuzzer(output, time){
  const filter = audioContext.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1200;
  const env = audioContext.createGain();
  env.gain.setValueAtTime(0.0001, time);
  env.gain.linearRampToValueAtTime(1, time + 0.02);
  env.gain.setValueAtTime(1, time + 0.75);
  env.gain.exponentialRampToValueAtTime(0.0001, time + 0.95);
  filter.connect(env).connect(output);
  return [98, 147].map((frequency) => oscillator("square", frequency, filter, time, 0.95));
}

// Typewriter bell: a bright tone with inharmonic partials, ringing out
function synthBell(output, time){
  const partials = [[1, 1], [2.76, 0.4], [5.4, 0.2]];
  return partials.map(([ratio, level]) =>
    oscillator("sine", 2100 * ratio, envelope(output, time, 0.002, 1.2, level), time, 1.2));
}

// New record: a quick rising major arpeggio
function synthRecord(output, time){
  const notes = [523.25, 659.25, 783.99, 1046.5];
  return notes.map((frequency, i) => {
    const start = time + i * 0.11;
    const length = i === notes.length - 1 ? 0.7 : 0.25;
    return oscillator("triangle", frequency, envelope(output, start, 0.01, length), start, length);
  });
}
