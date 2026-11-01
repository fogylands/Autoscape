// --- DOM elements ---
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");
const colorSlotsEl = document.getElementById("color-slots");
const distanceResultsEl = document.getElementById("distance-results");
const playAreaStatusEl = document.getElementById("play-area-status");
const lightStatusEl = document.getElementById("light-status");
let displaySpeedRaser;
let positionRaser;
let displaySpeedBulle;
let positionBulle;
let distanceRaserBulle;
let lastDistanceDisplayAt = null;
let smoothedDistance = null;
const poster = document.querySelector(".poster")

const previousMeasurements = new Map();

let currentPoster = "start";
let countdownStarted = false;
let countdownTimer = null;
let readyTimer = null;
let endingTimer = null;
let hitMessageTimer = null;
let raceTimerInterval = null;
let endingInterval = null;
let startScreenShownAt = null;
let bothRacersDetectedAt = null;
let raceStartedAt = null;
// When the current chase started: the match start, or the end of the last point screen
let chaseStartedAt = null;
const raceTimerElement = poster.querySelector(".race-timer");
const raceScoreElement = poster.querySelector(".race-score");
const raceEventLogElement = poster.querySelector(".race-event-log");
const endingScreen = poster.querySelector(".ending-screen");
const endingEyebrow = poster.querySelector(".ending-eyebrow");
const endingTitle = poster.querySelector(".ending-title");
const endingDetail = poster.querySelector(".ending-detail");
const endingTime = poster.querySelector(".ending-time");
const endingRestart = poster.querySelector(".ending-restart");
const endingRacers = {
  bulle: poster.querySelector('.ending-racer[data-racer="bulle"]'),
  raser: poster.querySelector('.ending-racer[data-racer="raser"]'),
};
const raceMapElement = poster.querySelector(".race-map");
const raceRadioTitle = poster.querySelector(".race-radio__title");
const raceRadioTrack = raceRadioTitle.querySelector(".race-radio__track");
const raceRadioText = raceRadioTitle.querySelector(".race-radio__text");
const raceRadioCopy = raceRadioTitle.querySelector(".race-radio__copy");
// px per second, like the scrolling display of a car radio
const radioScrollSpeed = 40;

// The song or talk on the car radio, announced by sfx.js
document.addEventListener("radiochange", (event) => {
  raceRadioText.textContent = event.detail.title ?? "—";
  raceRadioCopy.textContent = raceRadioText.textContent;
  updateRadioScroll();
});

// A title wider than the section scrolls in an endless loop; one that fits stands still
function updateRadioScroll(){
  raceRadioTitle.classList.remove("is-scrolling");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion || raceRadioText.offsetWidth <= raceRadioTitle.clientWidth) return;

  // One loop moves by the text plus the gap to its copy
  const distance = raceRadioText.offsetWidth + parseFloat(getComputedStyle(raceRadioTrack).columnGap);
  raceRadioTitle.style.setProperty("--radio-scroll-distance", `${distance}px`);
  raceRadioTitle.style.setProperty("--radio-scroll-duration", `${distance / radioScrollSpeed}s`);
  raceRadioTitle.classList.add("is-scrolling");
}

// Also when the race screen appears: the section has no width while hidden
new ResizeObserver(updateRadioScroll).observe(raceRadioTitle);

const maxLives = 10;
// One match runs for this long; only BUSTED and destroyed cars score win points within it
const raceTimeLimitSeconds = 60;
const pointScreenSeconds = 3;
const score = { bulle: 0, raser: 0 };

// Highscore points: a second count per racer next to the win points.
// Win points (`score`) only decide the match; highscore points also reward
// cone hits and cost lives lost, and the best of them per role is the record
const highscorePointValues = { win: 100, cone: 20, lifeLost: -10 };
const conePoints = { bulle: 0, raser: 0 };
const livesLost = { bulle: 0, raser: 0 };

function highscorePoints(id){
  return Math.max(0,
    score[id] * highscorePointValues.win
    + conePoints[id] * highscorePointValues.cone
    + livesLost[id] * highscorePointValues.lifeLost
  );
}

// Record: the most highscore points each role has reached in one match.
// Kept in this browser so it survives a reload
const highscoreStorageKey = "raser-highscore-points";
const highscore = loadHighscore();

function loadHighscore(){
  try {
    const saved = JSON.parse(localStorage.getItem(highscoreStorageKey));
    if (Number.isFinite(saved?.bulle) && Number.isFinite(saved?.raser)) return saved;
  } catch {}
  return { bulle: 0, raser: 0 };
}

function saveHighscore(){
  try {
    localStorage.setItem(highscoreStorageKey, JSON.stringify(highscore));
  } catch {}
}
const playAreaWidthCm = 75;
const playAreaHeightCm = 75;
const lives = { bulle: maxLives, raser: maxLives };
const obstacleContacts = {
  bulle: { startedAt: null, hitRegistered: false },
  raser: { startedAt: null, hitRegistered: false },
};
const coneTouches = { bulle: false, raser: false };
// One cone hit per racer per cooldown, detection flickers on a cone
const coneCooldownMs = 2000;
const lastConePointAt = { bulle: null, raser: null };
const highscorePointsElements = {
  bulle: poster.querySelector('.racer-points[data-racer="bulle"]'),
  raser: poster.querySelector('.racer-points[data-racer="raser"]'),
};

function renderHighscorePoints(){
  for (const id of Object.keys(highscorePointsElements)) {
    highscorePointsElements[id].textContent = `${highscorePoints(id)} PKT`;
  }
}
const detectionStatusElements = {
  bulle: document.getElementById("bulle-detection"),
  raser: document.getElementById("raser-detection"),
};

function setPosterState(state){
  poster.className = `poster ${state}`
  if (state === "start") startScreenShownAt = performance.now();
  console.log("Poster state:", state);
console.log("Poster dimensions:", poster.clientWidth, poster.clientHeight);
}

function startRaceTimer(){
  raceStartedAt = performance.now();
  chaseStartedAt = raceStartedAt;
  addRaceEvent(raceLogLine("start"));
  raceTimerElement.textContent = `${raceTimeLimitSeconds}s`;
  clearInterval(raceTimerInterval);
  // Keeps running through point screens, so the whole match lasts the time limit
  raceTimerInterval = setInterval(() => {
    const remaining = remainingRaceSeconds();
    raceTimerElement.textContent = `${remaining}s`;
    // Ticks for the last ten seconds, beeps for the last three
    if (remaining > 0 && remaining <= 10 && currentPoster === "race") {
      playSfx(remaining <= 3 ? "tickFinal" : "tick");
    }
    if (remaining === 10 && currentPoster === "race") radioReact("finalSeconds");
    if (remaining === 0) showMatchEnd();
  }, 1000);
}

function elapsedRaceSeconds(){
  return raceStartedAt === null
    ? 0
    : Math.floor((performance.now() - raceStartedAt) / 1000);
}

function remainingRaceSeconds(){
  return Math.max(0, raceTimeLimitSeconds - elapsedRaceSeconds());
}

// A few short lines per event, one picked at random each time. No names:
// the line takes the color of the car it is about (addRaceEvent)
const raceLogLines = {
  start: ["START"],
  obstacle: [
    "IN WAND GEFAHREN",
    "FRONTALSCHADEN",
    "BLECHSCHADEN",
    "STOSSSTANGE AB",
    "SPIEGEL ABGEFAHREN",
    "SCHEINWERFER KAPUTT",
    "KOTFLÜGEL VERBEULT",
    "DELLE IN DER TÜR",
  ],
  obstacleLastLife: [
    "MOTOR RAUCHT",
    "NUR NOCH SCHROTT",
    "LETZTE SCHRAUBE HÄLT",
  ],
  cone: [
    "BLUMENBETT ZERSTÖRT",
    "E-TROTTINETT ÜBERFAHREN",
    "BRIEFKASTEN UMGEFAHREN",
    "GARTENZWERG ERWISCHT",
    "MÜLLTONNE UMGEKIPPT",
    "VELO GESTREIFT",
    "BAUSTELLE DURCHQUERT",
  ],
  busted: ["ERWISCHT", "FESTGENOMMEN", "HANDSCHELLEN KLICKEN"],
  destroyed: ["TOTALSCHADEN"],
  bothDestroyed: ["DOPPELTER TOTALSCHADEN"],
};

// The last line picked per event, so the same one never shows twice in a row
const lastRaceLogLine = {};

function raceLogLine(event){
  const lines = raceLogLines[event].filter((line) => line !== lastRaceLogLine[event]);
  const line = lines.length > 0
    ? lines[Math.floor(Math.random() * lines.length)]
    : raceLogLines[event][0];
  lastRaceLogLine[event] = line;
  return line;
}

// actor: "bulle", "raser" or omitted for neutral race events
function addRaceEvent(message, actor = null){
  const entry = document.createElement("div");
  entry.className = "race-event";
  if (actor) entry.dataset.actor = actor;
  const elapsedSeconds = elapsedRaceSeconds();
  const timestamp =`${String(Math.floor(elapsedSeconds / 60)).padStart(2, "0")}:${String(elapsedSeconds % 60).padStart(2, "0")}`;

  const time = document.createElement("span");
  time.className = "race-event__time";
  time.textContent = timestamp;

  const text = document.createElement("span");
  text.className = "race-event__text";
  text.textContent = message;

  entry.append(time, text);
  raceEventLogElement.append(entry);

  while (raceEventLogElement.children.length > 5) {
    raceEventLogElement.firstElementChild.remove();
  }
}

function resetRaceEventLog(){
  raceEventLogElement.replaceChildren();
}

// The closer the Bulle gets, the bolder the distance: thinnest (50) from this
// distance on or with no reading, boldest (140) when the cars touch
const distanceWeightRangeCm = 75;

function updateDistanceWeight(distance){
  const closeness = distance === null ? 0 : 1 - Math.min(1, distance / distanceWeightRangeCm);
  // Steps of 5, so the readout is only refitted when the weight visibly changes
  const weight = String(50 + Math.round(closeness * 90 / 5) * 5);
  if (distanceRaserBulle.style.fontWeight === weight) return;
  distanceRaserBulle.style.fontWeight = weight;
  distanceRaserBulle.dispatchEvent(new Event("distanceweightchange"));
}

function updatePosterElementReference(){
  displaySpeedRaser = document.querySelector(".speedRaser");
  displaySpeedBulle = document.querySelector(".speedBulle");
  distanceRaserBulle = document.querySelector(".distance");

  positionBulle = document.querySelector(".positionBulle");
  positionRaser = document.querySelector(".positionRaser");
}

// Lives in the racer info: one X per life, lost lives stay as dimmed X
// so the row keeps its length
const livesElements = {
  bulle: poster.querySelector('.racer-lives[data-racer="bulle"]'),
  raser: poster.querySelector('.racer-lives[data-racer="raser"]'),
};

function renderLives(){
  for (const id of Object.keys(lives)) {
    const element = livesElements[id];
    element.querySelector(".racer-lives__left").textContent = "X".repeat(lives[id]);
    element.querySelector(".racer-lives__lost").textContent = "X".repeat(maxLives - lives[id]);
    element.setAttribute("aria-label", `${lives[id]} von ${maxLives} Leben`);
  }
}

function resetGame(){
  stopAllSfx();
  duckMusic(1);
  playMusic("theme");
  clearTimeout(endingTimer);
  endingTimer = null;
  clearInterval(raceTimerInterval);
  raceTimerInterval = null;
  clearInterval(endingInterval);
  endingInterval = null;
  clearTimeout(readyTimer);
  readyTimer = null;
  clearTimeout(countdownTimer);
  countdownTimer = null;
  countdownStarted = false;
  raceStartedAt = null;
  chaseStartedAt = null;
  score.bulle = 0;
  score.raser = 0;
  renderScore();
  raceTimerElement.textContent = `${raceTimeLimitSeconds}s`;
  resetRaceEventLog();
  clearTimeout(hitMessageTimer);
  hitMessageTimer = null;
  poster.querySelector(".hit").classList.remove("is-visible");
  raceMapElement.classList.remove("is-hit");
  poster.querySelectorAll(".ready-message span").forEach((line) => {
    line.classList.remove("is-visible", "is-typing");
  });
  refillLives();
  for (const id of Object.keys(coneTouches)) {
    coneTouches[id] = false;
    lastConePointAt[id] = null;
    conePoints[id] = 0;
    livesLost[id] = 0;
  }
  renderHighscorePoints();
  updateDistanceWeight(null);
  endingTitle.textContent = "";
  endingEyebrow.textContent = "";
  endingDetail.textContent = "";
  endingTime.textContent = "";
  endingRestart.textContent = "";
  endingScreen.dataset.outcome = "";
  renderLives();
  setPosterState("start");
  currentPoster = "start";
  updatePosterElementReference();
}

function refillLives(){
  for (const id of Object.keys(lives)) {
    lives[id] = maxLives;
    obstacleContacts[id].startedAt = null;
    obstacleContacts[id].hitRegistered = false;
  }
  renderLives();
}

// "<label> 3", "<label> 2", … on the ending screen, then onDone
function countDownEnding(label, seconds, onDone){
  clearInterval(endingInterval);
  clearTimeout(endingTimer);
  let secondsRemaining = seconds;
  endingRestart.textContent = `${label} ${secondsRemaining}`;
  endingInterval = setInterval(() => {
    secondsRemaining -= 1;
    if (secondsRemaining > 0) {
      endingRestart.textContent = `${label} ${secondsRemaining}`;
      return;
    }
    clearInterval(endingInterval);
    endingInterval = null;
  }, 1000);
  endingTimer = setTimeout(onDone, seconds * 1000);
}

// Score on the race screen, Bulle first like on the ending screen
function renderScore(){
  raceScoreElement.querySelector('[data-racer="bulle"]').textContent = String(score.bulle);
  raceScoreElement.querySelector('[data-racer="raser"]').textContent = String(score.raser);
}

function fillEndingScreen(state, outcome, title, detail, time){
  endingScreen.dataset.outcome = outcome;
  endingEyebrow.textContent = `${score.bulle}:${score.raser}`;
  endingTitle.textContent = title;
  endingDetail.textContent = detail;
  endingTime.textContent = time;
  setPosterState(state);
}

// Poster state → who scores the point and what the point screen says
const pointEndings = {
  "busted": { scorer: "bulle", title: "BUSTED", detail: "PUNKT FÜR BULLE" },
  "raser-destroyed": { scorer: "bulle", title: "RASER ZERSTÖRT", detail: "PUNKT FÜR BULLE" },
  "bulle-destroyed": { scorer: "raser", title: "BULLE ZERSTÖRT", detail: "PUNKT FÜR RASER" },
  "both-destroyed": { scorer: null, title: "BEIDE ZERSTÖRT", detail: "KEIN PUNKT" },
};

// A point within the match: show it briefly, then the chase goes on
function showPoint(state){
  const { scorer, title, detail } = pointEndings[state];
  if (scorer) score[scorer] += 1;
  renderScore();
  renderHighscorePoints();

  duckMusic(0.25);
  if (state === "busted") {
    playSfx("siren");
    playSfx("busted");
  } else {
    playSfx("explosion");
  }

  fillEndingScreen(state, scorer ?? "draw", title, detail, `NOCH ${remainingRaceSeconds()}s`);
  currentPoster = "point";
  countDownEnding("WEITER IN", pointScreenSeconds, resumeRace);
}

function resumeRace(){
  clearInterval(endingInterval);
  endingInterval = null;
  endingTimer = null;
  refillLives();
  chaseStartedAt = performance.now();
  playSfx("rev");
  duckMusic(1);
  radioReact("resume");
  setPosterState("race");
  currentPoster = "race";
  updatePosterElementReference();
}

// Time is up: the score decides. The result stays until "Nochmal spielen"
function showMatchEnd(){
  if (currentPoster !== "race" && currentPoster !== "point") return;

  clearInterval(raceTimerInterval);
  raceTimerInterval = null;
  // Time can run out during a point screen; don't resume the race after it
  clearInterval(endingInterval);
  endingInterval = null;
  clearTimeout(endingTimer);
  endingTimer = null;
  endingRestart.textContent = "";

  const points = { bulle: highscorePoints("bulle"), raser: highscorePoints("raser") };
  const newRecords = ["bulle", "raser"].filter((id) => points[id] > highscore[id]);
  for (const id of newRecords) highscore[id] = points[id];
  if (newRecords.length > 0) saveHighscore();
  // One cell per racer, like the two columns on the start screen
  for (const id of ["bulle", "raser"]) {
    const cell = (className, text) => {
      const span = document.createElement("span");
      span.className = className;
      span.textContent = text;
      return span;
    };
    endingRacers[id].replaceChildren(
      cell("ending-racer__name", id.toUpperCase()),
      cell("ending-racer__points", `${points[id]} PKT`),
      cell("ending-racer__record", newRecords.includes(id) ? "NEUER REKORD!" : `REKORD ${highscore[id]} PKT`)
    );
  }

  const outcome = score.bulle > score.raser
    ? "bulle"
    : score.raser > score.bulle ? "raser" : "draw";
  const title = { bulle: "BULLE GEWINNT", raser: "RASER GEWINNT", draw: "UNENTSCHIEDEN" }[outcome];

  stopMusic(0.4);
  duckMusic(1);
  playSfx("buzzer");
  // The winner's sound after the buzzer: siren for the Bulle, getaway for the Raser
  if (outcome === "bulle") playSfx("sirenWin", 0.6);
  if (outcome === "raser") playSfx("getaway", 0.6);
  if (newRecords.length > 0) playSfx("record", 1.2);
  // The theme comes back once those are over
  playMusic("theme", { fade: 2, delay: 3.5 });
  fillEndingScreen("match-over", outcome, title, "ZEIT ABGELAUFEN", "");
  renderFinalScore();
  currentPoster = "game-over";
}

// Final score: the more points, the bolder the number, from the thinnest
// weight at 0 to the boldest from finalScoreBoldAt points on
const finalScoreBoldAt = 3;

function renderFinalScore(){
  const number = (points) => {
    const span = document.createElement("span");
    span.textContent = String(points);
    span.style.fontWeight = String(50 + 90 * Math.min(1, points / finalScoreBoldAt));
    return span;
  };
  // One wrapper, so the grid cell centers the score as a single line
  const line = document.createElement("span");
  line.append(number(score.bulle), ":", number(score.raser));
  endingEyebrow.replaceChildren(line);
}

// Straight into the countdown: the cars are already on the track
function startNewMatch(){
  resetGame();
  currentPoster = "ready";
  startCountdown();
}

poster.querySelector(".ending-again").addEventListener("click", startNewMatch);

function finishGame(){
  if (currentPoster !== "race") return;

  const bulleDestroyed = lives.bulle === 0;
  const raserDestroyed = lives.raser === 0;

  if (!bulleDestroyed && !raserDestroyed) return;

  if (bulleDestroyed && raserDestroyed) {
    addRaceEvent(raceLogLine("bothDestroyed"));
    showPoint("both-destroyed");
  } else if (bulleDestroyed) {
    addRaceEvent(raceLogLine("destroyed"), "bulle");
    showPoint("bulle-destroyed");
  } else {
    addRaceEvent(raceLogLine("destroyed"), "raser");
    showPoint("raser-destroyed");
  }
}

// --- Screen switcher (calibration panel): jump straight to any poster state ---
function showRace(){
  resetGame();
  setPosterState("race");
  currentPoster = "race";
  playRaceMusic();
  startRaceTimer();
  updatePosterElementReference();
}

// Points and the final result add to the running match;
// only start a new one when no match is running
function ensureMatchRunning(){
  if (currentPoster !== "race" && currentPoster !== "point") showRace();
}

const screenButtons = [
  { label: "Start", show: resetGame },
  { label: "Ready", show: () => { resetGame(); showReadyScreen(); } },
  { label: "Countdown", show: startNewMatch },
  { label: "Rennen", show: showRace },
  ...Object.keys(pointEndings).map((state) => ({
    label: pointEndings[state].title,
    show: () => { ensureMatchRunning(); showPoint(state); },
  })),
  { label: "Endstand", show: () => { ensureMatchRunning(); showMatchEnd(); } },
];

function buildScreenButtons(){
  const container = document.getElementById("screen-buttons");
  for (const { label, show } of screenButtons) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", show);
    container.append(button);
  }
}

buildScreenButtons();

// --- Collapsible aside panels: remember which ones are open between reloads ---
function rememberPanelState(){
  for (const panel of document.querySelectorAll("#color-tool .panel")) {
    const key = `panel-open:${panel.querySelector(".panel__title").textContent}`;
    try {
      const saved = localStorage.getItem(key);
      if (saved !== null) panel.open = saved === "1";
    } catch {}
    panel.addEventListener("toggle", () => {
      try { localStorage.setItem(key, panel.open ? "1" : "0"); } catch {}
    });
  }
}

rememberPanelState();

// --- Settings overlay: button or H shows and hides it, remembered between reloads ---
const overlayEl = document.getElementById("color-tool");
const overlayToggleEl = document.getElementById("overlay-toggle");

function setOverlayVisible(visible){
  overlayEl.classList.toggle("is-hidden", !visible);
  overlayToggleEl.setAttribute("aria-expanded", String(visible));
  try { localStorage.setItem("overlay-visible", visible ? "1" : "0"); } catch {}
}

// While corners are clicked, overlay and button both get out of the way
// of the camera image; the remembered visibility stays untouched
function setOverlaySuppressed(suppressed){
  overlayEl.classList.toggle("is-suppressed", suppressed);
  overlayToggleEl.classList.toggle("is-suppressed", suppressed);
}

function setupOverlayToggle(){
  try {
    if (localStorage.getItem("overlay-visible") === "0") setOverlayVisible(false);
  } catch {}

  overlayToggleEl.addEventListener("click", () => {
    setOverlayVisible(overlayEl.classList.contains("is-hidden"));
  });
  window.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target.closest("input, textarea, select")) return;
    // Escape cancels clicking the Spielfeld corners
    if (event.key === "Escape" && pickingPlayArea) {
      cancelPlayAreaPicking();
      return;
    }
    if (event.key !== "h" && event.key !== "H") return;
    setOverlayVisible(overlayEl.classList.contains("is-hidden"));
  });
}

setupOverlayToggle();


setPosterState("start");
updatePosterElementReference();
renderLives();
// Starts with the first click on the page if the browser still blocks audio
playMusic("theme");


// --- Calibration defaults (HSV, OpenCV scale: H 0–180, S/V 0–255) ---
const calibration = {
  hueTol: 10, // ± hue window around sampled or picked color
  satMin: 80, // ignore weak / gray pixels
  valMin: 80, // ignore very dark pixels
};

// --- Color detectors (mutable: UI updates stroke, text, and ranges) ---
// Ranges may contain two pairs when a hue wraps at 0/180.
const colorDetectors = [
  {
    // Blue police car: body measured at H 107–112, S 133–255, V 69–115.
    // The blue is dark, so it gets its own lower brightness limit
    id: "bulle",
    name: "Bulle",
    stroke: "#2f7bff",
    text:  "#2f7bff",
    enabled: true,
    hueTolerance: 8,
    satMin: 100,
    valMin: 45,
    // The black windows split the blue into hood, roof and rear
    // (gaps ~70 % of the hood's size); see closeGapsRelativeTo
    closeGapsRatio: 0.7,
    ranges: [[[101, 100, 45], [117, 255, 255]]],
  },
  {
    id: "raser",
    name: "Raser",
    stroke: "#a8c936",
    text: "#a8c936",
    enabled: true,
    closeGapsRatio: 0.7,
    ranges: [[[40, 50, 50], [80, 255, 255]]],
  },
  {
    id: "obstacles",
    name: "Hindernisse",
    stroke: "#ffdc00",
    text: "#ffdc00",
    enabled: true,
    hueTolerance: 6,
    ranges: [
      [[20, 100, 100], [32, 255, 255]],
    ],
  },
  {
    id: "cones",
    name: "Kegel",
    stroke: "#ff8000",
    text: "#ff8000",
    enabled: true,
    hueTolerance: 4,
    ranges: [
      [[11, 100, 100], [19, 255, 255]],
    ],
  },
];

// Index of the color slot being calibrated via canvas click, or null
let pickTargetIndex = null;

// --- OpenCV.js bootstrap (called from index.html script onload) ---
window.onOpenCvReady = async function () {
  // The script is loaded before its WebAssembly part is ready to use
  if (!cv.Mat) {
    setCameraStatus("OpenCV wird gestartet …");
    await new Promise((resolve) => { cv.onRuntimeInitialized = resolve; });
  }

  statusEl.textContent = "OpenCV geladen";
  setCameraStatus("Kamera wird gestartet …");
  // A broken saved setup must not keep the camera from starting
  try {
    initColorTool();
  } catch (error) {
    console.error("Setup konnte nicht geladen werden", error);
    renderColorSlots();
  }
  startCamera();
};

// --- Webcam ---
const cameraStatusEl = document.getElementById("camera-status");

function setCameraStatus(text, isError = false){
  cameraStatusEl.textContent = text;
  cameraStatusEl.classList.toggle("is-error", isError);
}

// Why the browser refused the camera, in words the person at the table can act on
const cameraErrorTexts = {
  NotAllowedError: "Zugriff verweigert – Kamera in den Browser-Einstellungen erlauben",
  NotFoundError: "Keine Kamera gefunden – angeschlossen?",
  NotReadableError: "Kamera wird von einem anderen Programm oder Tab benutzt",
  SecurityError: "Kamera nur über http://localhost oder https erlaubt",
};

const cameraSelectEl = document.getElementById("camera-select");
let detectionLoopRunning = false;

// The chosen camera is remembered; without one the browser picks its default,
// which on a Mac can be a virtual camera (OBS, iPhone) that only sends black
async function startCamera(deviceId = savedSetup.cameraId) {
  try {
    const previous = video.srcObject;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: deviceId ? { deviceId: { exact: deviceId } } : true,
    }).catch((error) => {
      // A remembered camera that is unplugged now: fall back to the default
      if (deviceId && error.name === "OverconstrainedError") {
        return navigator.mediaDevices.getUserMedia({ video: true });
      }
      throw error;
    });
    previous?.getTracks().forEach((track) => track.stop());
    video.srcObject = stream;
    video.onloadedmetadata = () => {
      video.play();
      setCameraStatus(`Läuft – ${stream.getVideoTracks()[0]?.label || "Kamera"}`);
      // start the detection loop once frames are available, only once
      if (!detectionLoopRunning) {
        detectionLoopRunning = true;
        processFrame();
      }
    };
    await listCameras(stream.getVideoTracks()[0]?.getSettings().deviceId);
  } catch (error) {
    console.error("Kamera konnte nicht gestartet werden", error);
    setCameraStatus(cameraErrorTexts[error.name] ?? `Fehler: ${error.name || error}`, true);
    // Make sure the reason is seen even if the settings were hidden
    setOverlaySuppressed(false);
    setOverlayVisible(true);
  }
}

// Camera names are only readable once access was granted, so this runs after
async function listCameras(activeId) {
  const cameras = (await navigator.mediaDevices.enumerateDevices())
    .filter((device) => device.kind === "videoinput");
  cameraSelectEl.replaceChildren(...cameras.map((camera, i) => {
    const option = document.createElement("option");
    option.value = camera.deviceId;
    option.textContent = camera.label || `Kamera ${i + 1}`;
    option.selected = camera.deviceId === activeId;
    return option;
  }));
  cameraSelectEl.disabled = cameras.length < 2;
}

cameraSelectEl.addEventListener("change", () => {
  savedSetup.cameraId = cameraSelectEl.value;
  saveSetup();
  setCameraStatus("Kamera wird gewechselt …");
  startCamera(cameraSelectEl.value);
});

// --- Color conversion helpers ---

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Uses OpenCV so HSV matches cv.inRange (same as video pipeline)
function rgbToOpenCvHsv(r, g, b) {
  let src = cv.matFromArray(1, 1, cv.CV_8UC3, [r, g, b]);
  let hsv = new cv.Mat();
  cv.cvtColor(src, hsv, cv.COLOR_RGB2HSV);
  const h = hsv.data[0];
  const s = hsv.data[1];
  const v = hsv.data[2];
  src.delete();
  hsv.delete();
  return { h, s, v };
}

// Build inRange bounds from a center hue; split into two bands when hue wraps.
function hsvRangesFromHue(h, satMin, valMin, hueTol) {
  const sm = satMin;
  const vm = valMin;

  // Hue near 0°: combine [0 …] and [… 180].
  if (h <= hueTol) {
    return [
      [[0, sm, vm], [h + hueTol, 255, 255]],
      [[180 - (hueTol - h), sm, vm], [180, 255, 255]],
    ];
  }
  // Hue near 180°: apply the same wrap handling.
  if (h >= 180 - hueTol) {
    return [
      [[h - hueTol, sm, vm], [180, 255, 255]],
      [[0, sm, vm], [hueTol - (180 - h), 255, 255]],
    ];
  }
  // Normal case: single contiguous hue interval
  return [[[h - hueTol, sm, vm], [h + hueTol, 255, 255]]];
}

// Sync one detector’s display colors and HSV ranges from a hex swatch
function applyColorToDetector(index, hex) {
  const detector = colorDetectors[index];
  const [r, g, b] = hexToRgb(hex);
  const { h } = rgbToOpenCvHsv(r, g, b);

  detector.stroke = hex;
  detector.text = hex;
  detector.ranges = hsvRangesFromHue(
    h,
    detector.satMin ?? calibration.satMin,
    detector.valMin ?? calibration.valMin,
    detector.hueTolerance ?? calibration.hueTol
  );
}

// Recompute all ranges after global calibration slider changes
function refreshAllDetectorRanges() {
  colorDetectors.forEach((detector, i) => {
    applyColorToDetector(i, detector.stroke);
  });
  renderColorSlots();
}

// --- Saved setup: corners, colors, sliders and switches survive a reload ---
// Only what was changed is stored, so untouched cars keep their measured ranges
const setupStorageKey = "raser-setup";
const savedSetup = { colors: {}, enabled: {} };

function saveSetup() {
  try { localStorage.setItem(setupStorageKey, JSON.stringify(savedSetup)); } catch {}
}

function restoreSetup() {
  try {
    Object.assign(savedSetup, JSON.parse(localStorage.getItem(setupStorageKey)) ?? {});
  } catch {}

  if (savedSetup.calibration) {
    // Moving a slider had recomputed every color, so do the same here
    Object.assign(calibration, savedSetup.calibration);
    for (const [inputId, key] of [["hue-tol", "hueTol"], ["sat-min", "satMin"], ["val-min", "valMin"]]) {
      document.getElementById(inputId).value = calibration[key];
      document.getElementById(`${inputId}-val`).textContent = calibration[key];
    }
    colorDetectors.forEach((detector, i) => {
      applyColorToDetector(i, savedSetup.colors[detector.id] ?? detector.stroke);
    });
  } else {
    colorDetectors.forEach((detector, i) => {
      if (savedSetup.colors[detector.id]) applyColorToDetector(i, savedSetup.colors[detector.id]);
    });
  }

  for (const detector of colorDetectors) {
    if (detector.id in savedSetup.enabled) detector.enabled = savedSetup.enabled[detector.id];
  }

  if (typeof savedSetup.lightCorrection === "boolean") {
    lightCorrection.enabled = savedSetup.lightCorrection;
    document.getElementById("light-correction").checked = savedSetup.lightCorrection;
  }

  // Saves from the old four-corner Spielfeld don't fit and are left out
  if (savedSetup.corners?.length === playAreaPointCount) setPlayAreaCorners(savedSetup.corners);
}

// A color set by hand (swatch or eyedropper) is remembered
function setDetectorColor(index, hex) {
  applyColorToDetector(index, hex);
  savedSetup.colors[colorDetectors[index].id] = hex;
  saveSetup();
}

// Back to the colors and sliders from the code; the corners stay
function resetColorSetup() {
  savedSetup.colors = {};
  savedSetup.enabled = {};
  delete savedSetup.calibration;
  saveSetup();
  location.reload();
}

// --- Color calibration UI ---

function initColorTool() {
  bindCalibrationSlider("hue-tol", "hueTol", refreshAllDetectorRanges);
  bindCalibrationSlider("sat-min", "satMin", refreshAllDetectorRanges);
  bindCalibrationSlider("val-min", "valMin", refreshAllDetectorRanges);

  restoreSetup();
  renderColorSlots();

  document.getElementById("play-area-calibrate").addEventListener("click", startPlayAreaPicking);
  document.getElementById("play-area-reset").addEventListener("click", resetPlayArea);
  document.getElementById("color-reset").addEventListener("click", resetColorSetup);
  document.getElementById("light-correction").addEventListener("change", (event) => {
    lightCorrection.enabled = event.target.checked;
    lightCorrection.gains = [1, 1, 1];
    lightStatusEl.textContent = lightCorrection.enabled ? "Wird gemessen …" : "Aus – Rohbild der Kamera";
    savedSetup.lightCorrection = lightCorrection.enabled;
    saveSetup();
  });

  canvas.addEventListener("click", (e) => {
    const point = canvasPointFromEvent(e);

    if (pickingPlayArea) {
      addPlayAreaCorner(point);
      return;
    }
    if (pickTargetIndex === null) return;

    // Eyedropper: sample RGB from the current canvas frame (video + overlays)
    const pixel = ctx.getImageData(point.x, point.y, 1, 1).data;
    const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);

    setDetectorColor(pickTargetIndex, hex);
    setPickMode(null);
  });
}

// Map click position from CSS size to canvas pixel coordinates
// (canvas uses object-fit: cover, so account for the cropped edges)
function canvasPointFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.max(rect.width / canvas.width, rect.height / canvas.height);
  const offsetX = (rect.width - canvas.width * scale) / 2;
  const offsetY = (rect.height - canvas.height * scale) / 2;
  return {
    x: Math.floor((e.clientX - rect.left - offsetX) / scale),
    y: Math.floor((e.clientY - rect.top - offsetY) / scale),
  };
}

function updatePickCursor() {
  canvas.classList.toggle("is-picking", pickTargetIndex !== null || pickingPlayArea);
}

// --- Play area: maps camera pixels onto the real track in cm ---
// Without calibration the whole camera frame counts as the play area.
// The Spielfeld is an outline of 8 points, clicked in order around its edge.
// Only what lies inside counts; for cm, the box around the outline is the
// 75 × 75 cm square (the camera looks straight down, its image square to the field)
const playAreaPointCount = 8;
let playAreaCorners = [];
let pickingPlayArea = false;
let playAreaTransform = null; // 3×3 homography, row-major
// Corners in use before picking started, brought back if picking is cancelled
let cornersBeforePicking = [];

function startPlayAreaPicking() {
  setPickMode(null);
  cornersBeforePicking = playAreaTransform ? playAreaCorners : [];
  playAreaCorners = [];
  playAreaTransform = null;
  pickingPlayArea = true;
  setOverlaySuppressed(true);
  updatePickCursor();
  updatePlayAreaStatus();
}

function cancelPlayAreaPicking() {
  setPlayAreaCorners(cornersBeforePicking);
}

function resetPlayArea() {
  setPlayAreaCorners([]);
  delete savedSetup.corners;
  saveSetup();
}

function addPlayAreaCorner(point) {
  playAreaCorners.push(point);
  if (playAreaCorners.length === playAreaPointCount) {
    setPlayAreaCorners(playAreaCorners);
    savedSetup.corners = playAreaCorners;
    saveSetup();
    return;
  }
  updatePlayAreaStatus();
}

// Use the outline as the play area, or none for the whole frame, and stop picking
function setPlayAreaCorners(corners) {
  playAreaCorners = corners;
  playAreaTransform = corners.length === playAreaPointCount ? computePlayAreaTransform(corners) : null;
  pickingPlayArea = false;
  setOverlaySuppressed(false);
  updatePickCursor();
  updatePlayAreaStatus();
}

function updatePlayAreaStatus() {
  if (pickingPlayArea) {
    const next = playAreaCorners.length;
    playAreaStatusEl.textContent = `Punkt ${next + 1}/${playAreaPointCount} anklicken, der Reihe nach entlang dem Rand – Esc bricht ab`;
  } else if (playAreaTransform) {
    playAreaStatusEl.textContent = `Kalibriert – ${playAreaWidthCm} × ${playAreaHeightCm} cm`;
  } else {
    playAreaStatusEl.textContent = "Nicht kalibriert – ganzes Bild";
  }
}

// The box around the outline, as top left, top right, bottom right, bottom left.
// Not the smallest rotated box: for an octagon a 45° one is just as small
function playAreaBox(points) {
  const xs = points.map(({ x }) => x);
  const ys = points.map(({ y }) => y);
  const [left, right, top, bottom] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
}

// The box around the outline becomes the 75 × 75 cm square
function computePlayAreaTransform(points) {
  const corners = playAreaBox(points);
  const src = cv.matFromArray(4, 1, cv.CV_32FC2, corners.flatMap(({ x, y }) => [x, y]));
  const dst = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0, 0,
    playAreaWidthCm, 0,
    playAreaWidthCm, playAreaHeightCm,
    0, playAreaHeightCm,
  ]);
  const matrix = cv.getPerspectiveTransform(src, dst);
  const transform = Array.from(matrix.data64F);
  src.delete();
  dst.delete();
  matrix.delete();
  return transform;
}

// Canvas pixel position → position on the track in cm
function toPlayArea(point) {
  if (!playAreaTransform) {
    return {
      x: point.x * (playAreaWidthCm / canvas.width),
      y: point.y * (playAreaHeightCm / canvas.height),
    };
  }

  const m = playAreaTransform;
  const w = m[6] * point.x + m[7] * point.y + m[8];
  return {
    x: (m[0] * point.x + m[1] * point.y + m[2]) / w,
    y: (m[3] * point.x + m[4] * point.y + m[5]) / w,
  };
}

// Outline of the calibrated (or partly clicked) play area on the camera image
function drawPlayArea() {
  if (playAreaCorners.length === 0) return;

  // Gray hairline like the screens, so it can't be mistaken for the green Raser box
  ctx.strokeStyle = "#7a7a7a";
  ctx.fillStyle = "#7a7a7a";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(playAreaCorners[0].x, playAreaCorners[0].y);
  for (const corner of playAreaCorners.slice(1)) {
    ctx.lineTo(corner.x, corner.y);
  }
  if (playAreaCorners.length === playAreaPointCount) ctx.closePath();
  ctx.stroke();

  for (const corner of playAreaCorners) {
    ctx.beginPath();
    ctx.arc(corner.x, corner.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function bindCalibrationSlider(inputId, key, onChange) {
  const input = document.getElementById(inputId);
  const output = document.getElementById(`${inputId}-val`);
  input.addEventListener("input", () => {
    calibration[key] = Number(input.value);
    output.textContent = input.value;
    onChange();
    savedSetup.calibration = { ...calibration };
    saveSetup();
  });
}

function rgbToHex(r, g, b) {
  return (
    "#" +
    [r, g, b]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
  );
}

function setPickMode(index) {
  pickTargetIndex = index;
  if (index !== null && pickingPlayArea) cancelPlayAreaPicking();
  updatePickCursor();
  renderColorSlots();
}

function renderColorSlots() {
  colorSlotsEl.innerHTML = "";

  colorDetectors.forEach((detector, index) => {
    const slot = document.createElement("div");
    slot.className = "color-slot";
    if (pickTargetIndex === index) slot.classList.add("is-active");

    const picker = document.createElement("input");
    picker.type = "color";
    picker.value = detector.stroke;
    picker.title = `Farbe für ${detector.name}`;
    picker.addEventListener("input", () => {
      setDetectorColor(index, picker.value);
    });

    const name = document.createElement("span");
    name.className = "color-slot__name";
    name.textContent = detector.name;

    const position = document.createElement("div");
    position.className = "color-slot__position";
    position.textContent = "Nicht erkannt";
    detector.positionEl = position;



    const enableLabel = document.createElement("label");
    enableLabel.className = "toggle color-slot__enable";
    const enableCheck = document.createElement("input");
    enableCheck.type = "checkbox";
    enableCheck.checked = detector.enabled;
    enableCheck.addEventListener("change", () => {
      detector.enabled = enableCheck.checked;
      savedSetup.enabled[detector.id] = detector.enabled;
      saveSetup();
    });
    enableLabel.append(enableCheck, document.createTextNode(" An"));

    // Eyedropper: next click on the camera image sets this slot's color
    const pick = document.createElement("button");
    pick.type = "button";
    pick.className = "color-slot__pick";
    pick.textContent = pickTargetIndex === index ? "Ins Bild klicken" : "Pipette";
    pick.addEventListener("click", () => {
      setPickMode(pickTargetIndex === index ? null : index);
    });

    slot.append(picker, name, position, pick, enableLabel);
    colorSlotsEl.append(slot);
  });
}

// --- OpenCV mask & drawing ---

// Merge one or more HSV inRange results.
function buildMask(hsv, rangePairs) {
  let mask = null;

  for (const [lowArr, highArr] of rangePairs) {
    let low = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [...lowArr, 0]);
    let high = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [...highArr, 255]);
    let part = new cv.Mat();
    cv.inRange(hsv, low, high, part);
    low.delete();
    high.delete();

    if (!mask) {
      mask = part;
    } else {
      let merged = new cv.Mat();
      cv.bitwise_or(mask, part, merged);
      mask.delete();
      part.delete();
      mask = merged;
    }
  }

  return mask;
}

// --- Keeping one car's details from being detected as something else ---
// The cars are detected in order Bulle, Raser, obstacles, cones. The Bulle
// can only use where the Raser was in the previous frame.
const previousCarOutlines = { bulle: null, raser: null };

function outlinesOfOtherCars(detectorId, detections) {
  const current = (id) => detections.get(id)?.vertices ?? null;
  const outlines = {
    bulle: [previousCarOutlines.raser],
    raser: [current("bulle")],
  }[detectorId] ?? [current("bulle"), current("raser")];
  return outlines.filter(Boolean);
}

// Erases every blob whose center lies inside one of the polygons. Only the
// blob's own pixels go, so an object touching a car keeps its full outline
// (cone hits, obstacle contact and BUSTED still work). Returns whether any went
function eraseBlobsInside(mask, contours, polygons) {
  if (polygons.length === 0) return false;

  let erased = false;
  for (let i = 0; i < contours.size(); i++) {
    const contour = contours.get(i);
    const { center } = cv.minAreaRect(contour);
    contour.delete();
    if (polygons.some((polygon) => pointIsInsidePolygon(center, polygon))) {
      cv.drawContours(mask, contours, i, new cv.Scalar(0), -1);
      erased = true;
    }
  }
  return erased;
}

function findOuterContours(mask) {
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
  return { contours, hierarchy };
}

// Morphological close with a square kernel of ratio × the largest piece's
// longer side. Returns false when there is nothing to close
function closeGapsRelativeTo(mask, contours, ratio) {
  let largestSide = 0;
  let largestArea = 0;
  for (let i = 0; i < contours.size(); i++) {
    const contour = contours.get(i);
    const area = cv.contourArea(contour);
    if (area > largestArea) {
      largestArea = area;
      const { size } = cv.minAreaRect(contour);
      largestSide = Math.max(size.width, size.height);
    }
    contour.delete();
  }
  if (largestSide < 4) return false;

  // Square kernels are separable, so this stays fast at camera frame rate
  const kernelSize = Math.min(45, Math.max(5, Math.round(largestSide * ratio)));
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(kernelSize, kernelSize));
  cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, kernel);
  kernel.delete();
  return true;
}

// Draw and return the largest contour's center and rectangle vertices
function drawDetections(contours, stroke) {
  let largestIndex = -1;
  let largestArea = 0;

  for (let i = 0; i < contours.size(); i++) {
    let cnt = contours.get(i);
    const area = cv.contourArea(cnt);
    cnt.delete();

    if (area > largestArea) {
      largestArea = area;
      largestIndex = i;
    }
  }

  if (largestIndex === -1) return null;

  const cnt = contours.get(largestIndex);
  const rotatedRect = cv.minAreaRect(cnt);
  const vertices = cv.RotatedRect.points(rotatedRect).map(({ x, y }) => ({ x, y }));

  ctx.beginPath();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.moveTo(vertices[0].x, vertices[0].y);
  for (let j = 1; j < 4; j++) {
    ctx.lineTo(vertices[j].x, vertices[j].y);
  }
  ctx.closePath();
  ctx.stroke();

  cnt.delete();

  return {
    center: {
      x: Math.round(rotatedRect.center.x),
      y: Math.round(rotatedRect.center.y),
    },
    vertices,
  };
}

function pointToSegmentDistance(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const projection = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared)
  );
  return Math.hypot(
    point.x - (start.x + projection * dx),
    point.y - (start.y + projection * dy)
  );
}

function pointIsInsidePolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const crossesRay =
      (a.y > point.y) !== (b.y > point.y) &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (crossesRay) inside = !inside;
  }
  return inside;
}

function segmentsIntersect(a1, a2, b1, b2) {
  const orientation = (a, b, c) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const onSegment = (a, b, point) =>
    point.x >= Math.min(a.x, b.x) &&
    point.x <= Math.max(a.x, b.x) &&
    point.y >= Math.min(a.y, b.y) &&
    point.y <= Math.max(a.y, b.y);

  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);

  return (
    (o1 * o2 < 0 && o3 * o4 < 0) ||
    (o1 === 0 && onSegment(a1, a2, b1)) ||
    (o2 === 0 && onSegment(a1, a2, b2)) ||
    (o3 === 0 && onSegment(b1, b2, a1)) ||
    (o4 === 0 && onSegment(b1, b2, a2))
  );
}

function getRectDistance(rectBulle, rectRaser) {
  if (
    rectBulle.vertices.some((point) => pointIsInsidePolygon(point, rectRaser.vertices)) ||
    rectRaser.vertices.some((point) => pointIsInsidePolygon(point, rectBulle.vertices))
  ) {
    return 0;
  }

  let minDistance = Infinity;
  for (let i = 0; i < rectBulle.vertices.length; i++) {
    const a1 = rectBulle.vertices[i];
    const a2 = rectBulle.vertices[(i + 1) % rectBulle.vertices.length];
    for (let j = 0; j < rectRaser.vertices.length; j++) {
      const b1 = rectRaser.vertices[j];
      const b2 = rectRaser.vertices[(j + 1) % rectRaser.vertices.length];
      if (segmentsIntersect(a1, a2, b1, b2)) return 0;
      minDistance = Math.min(
        minDistance,
        pointToSegmentDistance(a1, b1, b2),
        pointToSegmentDistance(a2, b1, b2),
        pointToSegmentDistance(b1, a1, a2),
        pointToSegmentDistance(b2, a1, a2)
      );
    }
  }
  return minDistance;
}

function getRectDistanceInCm(rectA, rectB){
  const toCentimeters = (rect) => ({
    vertices: rect.vertices.map(toPlayArea),
  });

  return getRectDistance(toCentimeters(rectA), toCentimeters(rectB));
}

function formatDegreesMinutesSeconds(value){
  const totalSeconds = Math.round(value * 3600);
  const degrees = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${degrees}° ${String(minutes).padStart(2, "0")}′ ${String(seconds).padStart(2, "0")}″`;
}

function formatFrameCoordinates(position){
  if (!position) return "--° --′ --″ N\n--° --′ --″ O";

  // Clamp so a car just outside the calibrated area doesn't show negative degrees
  const { x, y } = toPlayArea(position);
  const latitude = Math.min(1, Math.max(0, y / playAreaHeightCm)) * 90;
  const longitude = Math.min(1, Math.max(0, x / playAreaWidthCm)) * 180;
  return `${formatDegreesMinutesSeconds(latitude)} N\n${formatDegreesMinutesSeconds(longitude)} O`;
}

function updateDistanceResults(detections) {
  updateStartDetection(detections);
  updateCountdownReadiness(detections, performance.now());

  const pairs = [];

  const rectBulle = detections.get("bulle");
  const rectRaser = detections.get("raser");

  const distance =
    rectBulle && rectRaser
      ? getRectDistanceInCm(rectBulle, rectRaser)
      : null;
  pairs.push(`BULLE–RASER: ${distance === null ? "NICHT ERFASST" : `${Math.round(distance)} CM`}`);
  updateChaseSiren(distance);

  // Smooth the distance so detection noise doesn't make the big number flicker
  smoothedDistance = distance === null
    ? null
    : smoothedDistance === null
      ? distance
      : smoothedDistance + (distance - smoothedDistance) * 0.15;

  const now = performance.now();
  if (lastDistanceDisplayAt === null || now - lastDistanceDisplayAt >= 250) {
    distanceResultsEl.textContent = pairs.join(" · ");

    const distanceText = smoothedDistance === null ? "--" : String(Math.round(smoothedDistance));
    if (distanceRaserBulle.textContent !== distanceText) {
      distanceRaserBulle.textContent = distanceText;
    }
    updateDistanceWeight(smoothedDistance);

    positionBulle.textContent = formatFrameCoordinates(rectBulle?.center);
    positionRaser.textContent = formatFrameCoordinates(rectRaser?.center);

    lastDistanceDisplayAt = now;
  }


    const lostLives = updateObstacleLives(detections, now);
    if (lostLives.length > 0) {
      showHitMessage();
      playSfx("crash");
      radioReact("crash");
      for (const id of lostLives) {
        addRaceEvent(raceLogLine(lives[id] === 1 ? "obstacleLastLife" : "obstacle"), id);
      }
    }
    updateConeTouches(detections);
    if (currentPoster === "race") finishGame();
    checkBusted(distance);
}

// The siren swells as the Bulle closes in: silent from this distance, full at contact
const chaseSirenRangeCm = 25;

function updateChaseSiren(distance){
  const level = currentPoster === "race" && distance !== null
    ? Math.max(0, 1 - distance / chaseSirenRangeCm)
    : 0;
  setSfxLoop("chase", level);
}

function updateStartDetection(detections){
  if (currentPoster !== "start") return;

  for (const id of ["bulle", "raser"]) {
    const detected = detections.has(id);
    const element = detectionStatusElements[id];
    const stateElement = element.querySelector(".start-detection__state");
    const statusText = detected ? "ERKANNT" : "SUCHE";
    if (stateElement.textContent !== statusText) {
      stateElement.textContent = statusText;
      element.classList.toggle("is-detected", detected);
      honkWhenDetected(id, detected);
    }
  }
}

// Each car honks when the camera finds it; the cooldown stops a flickering
// detection from honking over and over
const honkCooldownMs = 10000;
const lastHonkAt = { bulle: null, raser: null };

function honkWhenDetected(id, detected){
  if (!detected) return;
  const now = performance.now();
  if (lastHonkAt[id] !== null && now - lastHonkAt[id] < honkCooldownMs) return;
  lastHonkAt[id] = now;
  playSfx(id === "bulle" ? "honkBulle" : "honkRaser");
}

// Dispatch calls in when both cars are on the track; not again on every flicker
const radioCallCooldownMs = 20000;
let lastRadioCallAt = null;

function radioCallWhenBothDetected(now){
  if (lastRadioCallAt !== null && now - lastRadioCallAt < radioCallCooldownMs) return;
  lastRadioCallAt = now;
  playSfx("radioCall");
}

function updateCountdownReadiness(detections, now){
  if (currentPoster !== "start") {
    bothRacersDetectedAt = null;
    return;
  }

  if (!detections.has("bulle") || !detections.has("raser")) {
    bothRacersDetectedAt = null;
    return;
  }

  if (bothRacersDetectedAt === null) {
    bothRacersDetectedAt = now;
    radioCallWhenBothDetected(now);
    return;
  }

  if (now - bothRacersDetectedAt >= 3000) {
    startReadyScreen();
  }
}

function startReadyScreen(){
  if (currentPoster !== "start" || bothRacersDetectedAt === null) return;
  if (performance.now() - bothRacersDetectedAt < 3000) return;
  if (
    startScreenShownAt === null ||
    performance.now() - startScreenShownAt < 5000
  ) return;

  showReadyScreen();
}

// Typed out on the ready screen before the countdown
const readyChecks = [
  "Blaulicht poliert",
  "Sirene gestimmt",
  "Donuts für die Streife gesichert",
  "Fluchtwagen vollgetankt",
  "Nummernschild abgeschraubt",
  "Kegel gezählt – alle noch da",
  "Funk auf Kanal 110",
  "Bremsen? Überbewertet",
  "Rückspiegel eingeklappt",
  "Fahndungsfoto gedruckt",
  "Spoiler festgeklebt",
  "Strafzettelblock nachgefüllt",
  "Turbo angeschlossen",
  "Reifen vorgeglüht",
  "Kaffee für die Wache gekocht",
  "Tempolimit gelöscht",
  "Blitzer scharf geschaltet",
  "Straßensperre aufgebaut",
  "Hupe kalibriert",
  "Fluchtroute auf Serviette skizziert",
  "Sonnenbrille aufgesetzt",
  "Streifenwagen gewaschen",
  "Handbremse gelockert",
  "Auspuff getunt",
  "Navi auf „Abkürzung“ gestellt",
  "Dienstmarke poliert",
  "Rennstreifen frisch lackiert",
  "Versicherung? Abgelaufen",
  "Warnweste vergessen",
  "Kassettenrekorder aufgedreht",
  "Kurven entschärft",
  "Fahrschule abgebrochen",
  "Ölstand: ausreichend gefährlich",
  "Funkspruch abgefangen",
];

const readyLineCount = 6;

const readyFinales = [
  "Zündschlüssel wird gedreht...",
  "Motoren heulen auf...",
  "Ampel springt gleich auf Grün...",
  "Verfolgung wird freigegeben...",
  "Fluchtroute wird berechnet...",
  "Handschellen werden geölt...",
];

// count different entries from the list, in random order
function pickRandom(list, count){
  const pool = [...list];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

function showReadyScreen(){
  currentPoster = "ready";
  setPosterState("ready");
  stopMusic(2);
  prepareRaceMusic();
  playSfx("ignition");
  playSfx("radioChatter");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let nextLine = 0;

  // Different lines every match: checks first, the suspense line last
  const texts = [...pickRandom(readyChecks, readyLineCount), ...pickRandom(readyFinales, 1)];
  const lines = texts.map((text) => {
    const line = document.createElement("span");
    line.dataset.text = text;
    return line;
  });
  poster.querySelector(".ready-message").replaceChildren(...lines);

  // Typewriter: one character at a time, cursor sits on the line being typed
  const typeLine = (line, charIndex) => {
    const text = line.dataset.text;

    if (reduceMotion || charIndex >= text.length) {
      line.textContent = text;
      line.classList.remove("is-typing");
      playSfx("bell");
      nextLine += 1;
      readyTimer = setTimeout(revealNextLine, 180);
      return;
    }

    line.textContent = text.slice(0, charIndex + 1);
    // Every other key, so the faster typing doesn't turn into a buzz
    if (text[charIndex] !== " " && charIndex % 2 === 0) playSfx("type");
    readyTimer = setTimeout(() => typeLine(line, charIndex + 1), 24);
  };

  const revealNextLine = () => {
    if (nextLine < lines.length) {
      const line = lines[nextLine];
      line.classList.add("is-visible", "is-typing");
      typeLine(line, 0);
      return;
    }

    readyTimer = setTimeout(startCountdown, 900);
  };

  revealNextLine();
}

function updateObstacleLives(detections, now){
  if (currentPoster !== "race") return [];

  const obstacleRects = detections.get("obstacles") || [];
  const racers = {
    bulle: detections.get("bulle"),
    raser: detections.get("raser"),
  };
  const lostLives = [];

  for (const [id, racer] of Object.entries(racers)) {
    const contact = obstacleContacts[id];
    if (!racer) {
      contact.startedAt = null;
      continue;
    }

    const nearestObstacleDistance = obstacleRects.length
      ? Math.min(...obstacleRects.map((obstacle) => getRectDistance(racer, obstacle)))
      : Infinity;

    if (nearestObstacleDistance > 1) {
      contact.startedAt = null;
      contact.hitRegistered = false;
      continue;
    }

    if (contact.hitRegistered) continue;
    if (contact.startedAt === null) {
      contact.startedAt = now;
      continue;
    }

    if (now - contact.startedAt >= 500) {
      lives[id] = Math.max(0, lives[id] - 1);
      livesLost[id] += 1;
      renderHighscorePoints();
      contact.hitRegistered = true;
      lostLives.push(id);
      renderLives();
    }
  }

  return lostLives;
}

function updateConeTouches(detections){
  if (currentPoster !== "race") return;

  const coneRects = detections.get("cones") || [];
  const racers = {
    bulle: detections.get("bulle"),
    raser: detections.get("raser"),
  };

  for (const [id, racer] of Object.entries(racers)) {
    const touchingCone = Boolean(
      racer && coneRects.some((cone) => getRectDistance(racer, cone) === 0)
    );

    if (touchingCone && !coneTouches[id]) {
      // Detection flickers while a car sits on a cone; one hit per cooldown
      const now = performance.now();
      if (lastConePointAt[id] === null || now - lastConePointAt[id] >= coneCooldownMs) {
        lastConePointAt[id] = now;
        playSfx("cone");
        radioReact("cone");
        conePoints[id] += 1;
        renderHighscorePoints();
        addRaceEvent(raceLogLine("cone"), id);
      }
    }

    coneTouches[id] = touchingCone;
  }
}

// --- Race map: the play area drawn with font characters ---
// The play area is square, so the canvas maps onto a square character grid.
// One symbol per detected object; empty track stays blank
const mapSize = 8;
const mapGlyphs = { empty: "", obstacle: "Ø", cone: "^", bulle: "B", raser: "R" };
const mapCells = [];

function buildRaceMap(){
  const grid = raceMapElement.querySelector(".race-map__grid");
  grid.style.setProperty("--map-size", mapSize);
  for (let i = 0; i < mapSize * mapSize; i++) {
    const cell = document.createElement("span");
    cell.dataset.kind = "empty";
    grid.append(cell);
    mapCells.push(cell);
  }
}

// The map only changes when something really moved, so it doesn't flicker
// with detection noise:
// - a car keeps its cell until it is clearly inside the next one, and stays
//   on the map for a moment when its detection drops out
// - obstacles and cones only appear once seen for a while, and stay through
//   short gaps (e.g. while a car drives past and covers them)
// - the cells are redrawn a few times a second, not every frame
const mapCarStickiness = 0.25; // part of a cell a car has to move past the border
const mapCarHoldMs = 600;      // how long a lost car stays on the map
const mapShowAfterMs = 400;    // an obstacle or cone has to be seen this long to appear
const mapHideAfterMs = 1500;   // and missing this long to disappear
const mapRedrawMs = 120;

const mapCars = {
  bulle: { cell: null, lastSeenAt: 0 },
  raser: { cell: null, lastSeenAt: 0 },
};
const mapObjects = {
  obstacle: { presence: new Array(mapSize * mapSize).fill(0), shown: new Array(mapSize * mapSize).fill(false) },
  cone: { presence: new Array(mapSize * mapSize).fill(0), shown: new Array(mapSize * mapSize).fill(false) },
};
let lastMapUpdateAt = null;
let lastMapRedrawAt = 0;

// Position on the map grid in cells (0 … mapSize), not rounded
function mapGridPosition(point){
  const { x, y } = toPlayArea(point);
  const clamp = (value) => Math.min(mapSize - 0.001, Math.max(0, value));
  return {
    column: clamp(x / playAreaWidthCm * mapSize),
    row: clamp(y / playAreaHeightCm * mapSize),
  };
}

function mapCellIndex(point){
  const { column, row } = mapGridPosition(point);
  return Math.floor(row) * mapSize + Math.floor(column);
}

// The car's cell, kept while it is still within the stickiness margin around it
function stickyMapCell(currentCell, point){
  const { column, row } = mapGridPosition(point);
  if (currentCell !== null) {
    const currentColumn = currentCell % mapSize;
    const currentRow = Math.floor(currentCell / mapSize);
    const inside = (value, start) =>
      value >= start - mapCarStickiness && value < start + 1 + mapCarStickiness;
    if (inside(column, currentColumn) && inside(row, currentRow)) return currentCell;
  }
  return Math.floor(row) * mapSize + Math.floor(column);
}

function updateRaceMap(detections){
  const now = performance.now();
  const elapsedMs = lastMapUpdateAt === null ? 0 : Math.min(200, now - lastMapUpdateAt);
  lastMapUpdateAt = now;

  // Obstacles and cones: presence rises while seen and falls while missing
  for (const [kind, detectorId] of [["obstacle", "obstacles"], ["cone", "cones"]]) {
    const { presence, shown } = mapObjects[kind];
    const seen = new Set((detections.get(detectorId) || []).map(({ center }) => mapCellIndex(center)));
    for (let i = 0; i < presence.length; i++) {
      presence[i] = seen.has(i)
        ? Math.min(1, presence[i] + elapsedMs / mapShowAfterMs)
        : Math.max(0, presence[i] - elapsedMs / mapHideAfterMs);
      if (presence[i] >= 1) shown[i] = true;
      if (presence[i] <= 0) shown[i] = false;
    }
  }

  for (const id of ["bulle", "raser"]) {
    const racer = detections.get(id);
    const car = mapCars[id];
    if (racer) {
      car.cell = stickyMapCell(car.cell, racer.center);
      car.lastSeenAt = now;
    } else if (now - car.lastSeenAt > mapCarHoldMs) {
      car.cell = null;
    }
  }

  if (now - lastMapRedrawAt < mapRedrawMs) return;
  lastMapRedrawAt = now;

  const kinds = new Array(mapSize * mapSize).fill("empty");
  for (const kind of ["obstacle", "cone"]) {
    mapObjects[kind].shown.forEach((isShown, i) => {
      if (isShown) kinds[i] = kind;
    });
  }
  // Racers are drawn last so they always stay visible
  for (const id of ["bulle", "raser"]) {
    if (mapCars[id].cell !== null) kinds[mapCars[id].cell] = id;
  }

  // Only touch cells that changed
  kinds.forEach((kind, i) => {
    const cell = mapCells[i];
    if (cell.dataset.kind === kind) return;
    cell.dataset.kind = kind;
    cell.textContent = mapGlyphs[kind];
  });
}

buildRaceMap();

function showHitMessage(){
  const hitElement = poster.querySelector(".hit");
  hitElement.classList.add("is-visible");
  raceMapElement.classList.add("is-hit");
  clearTimeout(hitMessageTimer);
  hitMessageTimer = setTimeout(() => {
    hitElement.classList.remove("is-visible");
    raceMapElement.classList.remove("is-hit");
    hitMessageTimer = null;
  }, 1000);
}




// --- Light correction ---
// The white table fills most of the frame, so its average color should be a
// neutral gray ("gray world"). Each frame the red, green and blue channels are
// scaled toward that, which cancels dimmer light and warm or cool lamps, so
// the HSV ranges measured once keep working. The gains change slowly, so a
// car driving through the frame doesn't make the image pump.
const lightCorrection = {
  enabled: false,
  targetGray: 200,
  smoothing: 0.05,
  minGain: 0.5,
  maxGain: 3,
  gains: [1, 1, 1],
};
let lastLightStatusAt = 0;

function correctLighting(src) {
  // Only the play area counts once its corners are set; the floor around it doesn't
  const region = playAreaTransform ? playAreaBounds() : null;
  const sample = region ? src.roi(region) : src;
  const mean = cv.mean(sample);
  if (region) sample.delete();

  for (let c = 0; c < 3; c++) {
    const wanted = Math.min(lightCorrection.maxGain, Math.max(
      lightCorrection.minGain,
      lightCorrection.targetGray / Math.max(1, mean[c])
    ));
    lightCorrection.gains[c] += (wanted - lightCorrection.gains[c]) * lightCorrection.smoothing;
  }

  const channels = new cv.MatVector();
  cv.split(src, channels);
  for (let c = 0; c < 3; c++) {
    const channel = channels.get(c);
    channel.convertTo(channel, -1, lightCorrection.gains[c], 0);
    channels.set(c, channel);
    channel.delete();
  }
  cv.merge(channels, src);
  channels.delete();

  // At the maximum gain the light is too dim to fully make up for
  const now = performance.now();
  if (now - lastLightStatusAt >= 500) {
    lastLightStatusAt = now;
    const [r, g, b] = lightCorrection.gains.map((gain) => gain.toFixed(2));
    const atLimit = lightCorrection.gains.some((gain) => gain >= lightCorrection.maxGain - 0.05);
    lightStatusEl.textContent = `R ×${r} · G ×${g} · B ×${b}${atLimit ? " – zu dunkel!" : ""}`;
  }
}

// Axis-aligned box around the clicked play area corners, inside the frame
function playAreaBounds() {
  const xs = playAreaCorners.map(({ x }) => x);
  const ys = playAreaCorners.map(({ y }) => y);
  const x = Math.max(0, Math.floor(Math.min(...xs)));
  const y = Math.max(0, Math.floor(Math.min(...ys)));
  const width = Math.min(canvas.width, Math.ceil(Math.max(...xs))) - x;
  const height = Math.min(canvas.height, Math.ceil(Math.max(...ys))) - y;
  return width > 0 && height > 0 ? new cv.Rect(x, y, width, height) : null;
}

// White inside the clicked play area outline, black outside. Built once per
// calibration and reused every frame; null while the whole frame counts
let playAreaMask = null;
let playAreaMaskTransform = null;

function getPlayAreaMask(rows, cols) {
  if (!playAreaTransform) return null;
  if (playAreaMask && playAreaMaskTransform === playAreaTransform
      && playAreaMask.rows === rows && playAreaMask.cols === cols) {
    return playAreaMask;
  }

  if (playAreaMask) playAreaMask.delete();
  playAreaMask = cv.Mat.zeros(rows, cols, cv.CV_8UC1);
  const corners = cv.matFromArray(playAreaCorners.length, 1, cv.CV_32SC2,
    playAreaCorners.flatMap(({ x, y }) => [Math.round(x), Math.round(y)]));
  const polygons = new cv.MatVector();
  polygons.push_back(corners);
  cv.fillPoly(playAreaMask, polygons, new cv.Scalar(255));
  corners.delete();
  polygons.delete();
  playAreaMaskTransform = playAreaTransform;
  return playAreaMask;
}

// --- Main loop ---
function processFrame() {
  // Mirror webcam to canvas (also used as source for cv.imread)
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  let src = cv.imread(canvas);
  if (lightCorrection.enabled) {
    correctLighting(src);
    // Show the corrected frame, so the eyedropper samples what the detector sees
    cv.imshow(canvas, src);
  }
  let hsv = new cv.Mat();
  cv.cvtColor(src, hsv, cv.COLOR_RGBA2RGB);
  cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV);

  // Once the corners are set, anything outside the play area is ignored
  const areaMask = getPlayAreaMask(hsv.rows, hsv.cols);

  // Run detection per color so stroke/text stay matched to each hue
  const detections = new Map();
  for (const detector of colorDetectors) {
    if (!detector.enabled) {
      detector.positionEl.textContent = "Erkennung aus";
      continue;
    }

    let mask = buildMask(hsv, detector.ranges);
    if (areaMask) cv.bitwise_and(mask, areaMask, mask);
    let { contours, hierarchy } = findOuterContours(mask);
    // Details on a car (stickers, chevrons, lights) are not other objects:
    // erase blobs that sit on another car before anything else uses the mask
    if (eraseBlobsInside(mask, contours, outlinesOfOtherCars(detector.id, detections))) {
      contours.delete();
      hierarchy.delete();
      ({ contours, hierarchy } = findOuterContours(mask));
    }
    if (detector.closeGapsRatio) {
      // Join pieces of one car split by windows; the gaps scale with the car,
      // so the kernel is sized from the largest piece, then contours are found again
      if (closeGapsRelativeTo(mask, contours, detector.closeGapsRatio)) {
        contours.delete();
        hierarchy.delete();
        ({ contours, hierarchy } = findOuterContours(mask));
      }
    }

    if (detector.id === "obstacles" || detector.id === "cones") {
      // Obstacles and cones: every large enough blob
      const rects = drawTrackedRects(contours, detector.stroke, 100);
      detections.set(detector.id, rects);
      detector.positionEl.textContent = `${rects.length} ${detector.name} erkannt`;
    } else {
      // Bulle and Raser: only the largest blob
      const detection = drawDetections(contours, detector.stroke);
      if (detection) {
        detections.set(detector.id, detection);
        updateSpeedDisplay(detector.id, getSpeed(detector.id, detection.center));
      }
      detector.positionEl.textContent = detection
        ? `x: ${detection.center.x}, y: ${detection.center.y}`
        : "Nicht erkannt";
    }

    // Free OpenCV mats allocated this frame
    mask.delete();
    contours.delete();
    hierarchy.delete();
  }

  previousCarOutlines.bulle = detections.get("bulle")?.vertices ?? null;
  previousCarOutlines.raser = detections.get("raser")?.vertices ?? null;

  updateDistanceResults(detections);
  updateRaceMap(detections);
  drawPlayArea();
  src.delete();
  hsv.delete();

  requestAnimationFrame(processFrame);

}


// Smooth the per-frame speed and refresh the readout only twice a second,
// so the number stays readable instead of flickering every frame
const speedSmoothing = 0.1;
const speedDisplayIntervalMs = 500;
const smoothedSpeeds = { bulle: null, raser: null };
const lastSpeedDisplayAt = { bulle: 0, raser: 0 };

function updateSpeedDisplay(id, speed){
  if (speed !== undefined && Number.isFinite(speed)) {
    smoothedSpeeds[id] = smoothedSpeeds[id] === null
      ? speed
      : smoothedSpeeds[id] + (speed - smoothedSpeeds[id]) * speedSmoothing;
  }

  const now = performance.now();
  if (now - lastSpeedDisplayAt[id] < speedDisplayIntervalMs) return;
  lastSpeedDisplayAt[id] = now;

  const element = id === "raser" ? displaySpeedRaser : displaySpeedBulle;
  element.textContent = smoothedSpeeds[id] === null
    ? "-- KM/H"
    : `${Math.round(smoothedSpeeds[id])} KM/H`;
}

function getSpeed(id,currentPosition){
  const previous = previousMeasurements.get(id);
  const currentTime = performance.now();

  if(previous==null){
    previousMeasurements.set(id,{
      position: currentPosition,
      time: performance.now()
    });
    return;

  }else{
    const current = toPlayArea(currentPosition);
    const before = toPlayArea(previous.position);
    const movementCm = Math.hypot(current.x - before.x, current.y - before.y);
    let elapsedTime= (currentTime - previous.time)/1000;
    let speed = (movementCm / elapsedTime) * 0.036;

    previousMeasurements.set(id,{
      position: currentPosition,
      time: currentTime
    });
    return speed;
  }
}

// Cars touching = BUSTED. Each chase gets a few seconds of grace first,
// so the cars can separate after the start or the last point screen
function checkBusted(distance){
  if (currentPoster !== "race" || distance !== 0) return;
  if (chaseStartedAt === null || performance.now() - chaseStartedAt < 5000) return;

  addRaceEvent(raceLogLine("busted"), "bulle");
  showPoint("busted");
}



function startCountdown() {
  if (countdownStarted || currentPoster !== "ready") return;

  clearTimeout(readyTimer);
  readyTimer = null;
  countdownStarted = true;
  // The game is starting: settings out of the way (H brings them back)
  setOverlayVisible(false);
  setPosterState("countdown");
  currentPoster = "countdown";
  stopMusic(0.5);
  setSfxLoop("idle", 1);

  // The number animates inside its cell, so the cell border never scales
  const countdownElement = poster.querySelector(".countdownNumber");
  const countdownValue = countdownElement.querySelector(".countdownNumber__value");
  const countdownSteps = ["3", "2", "1", "LOS!"];
  // Each step grows; LOS! fills the whole area at the animation's peak weight
  const countdownScales = [0.3, 0.5, 0.72, 1];
  const fullSize = fitCountdownSize(countdownElement, countdownValue, "LOS!");
  let step = 0;

  const showNextStep = () => {
    if (step === countdownSteps.length) {
      setPosterState("race");
      currentPoster = "race";
      startRaceTimer();
      updatePosterElementReference();
      countdownStarted = false;
      countdownTimer = null;
      return;
    }

    countdownValue.textContent = countdownSteps[step];
    playSfx("count");
    if (countdownSteps[step] === "LOS!") {
      setSfxLoop("idle", 0);
      playSfx("launch");
      playRaceMusic();
    }
    if (fullSize !== null) {
      countdownElement.style.fontSize = `${fullSize * countdownScales[step]}px`;
    }
    // Reading layout between remove and add restarts the animation for every step;
    // without it the browser keeps the finished (transparent) last frame
    countdownValue.classList.remove("is-counting");
    void countdownValue.offsetWidth;
    countdownValue.classList.add("is-counting");
    step += 1;
    countdownTimer = setTimeout(showNextStep, 1000);
  };

  showNextStep();
}



// Largest font size at which the text stays inside the element at weight 140.
// The canvas estimate is checked against the real rendered box, with a small margin
function fitCountdownSize(element, valueElement, text){
  const canvasSize = fillFontSize(element, text, 140);
  if (canvasSize === null) return null;

  // The running animation would override the measuring weight
  valueElement.classList.remove("is-counting");
  valueElement.textContent = text;
  valueElement.style.fontWeight = "140";
  element.style.fontSize = `${canvasSize}px`;
  const box = valueElement.getBoundingClientRect();
  valueElement.style.fontWeight = "";

  const ratio = Math.min(
    1,
    element.clientWidth / box.width,
    element.clientHeight / box.height
  );
  return canvasSize * ratio * 0.94;
}




// Draw detected obstacle and cone contours.

function drawTrackedRects(contours, stroke, minArea){
  const rectangles = [];

  for (let i=0; i <contours.size(); i++){
    const contour = contours.get(i);
    const area = cv.contourArea(contour);

    if( area > minArea){
      const rotatedRect = cv.minAreaRect(contour);
      const vertices = cv.RotatedRect.points(rotatedRect)
      .map(({x,y}) =>({x,y}));
    
  
      const rectangle = {
        center: {
          x: rotatedRect.center.x,
          y: rotatedRect.center.y
        },
        vertices: vertices
      };
    

      rectangles.push(rectangle);

      ctx.beginPath();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.moveTo(vertices[0].x, vertices[0].y);

      for (let j = 1; j <vertices.length; j++){
        ctx.lineTo(vertices[j].x, vertices[j].y);
      }

      ctx.closePath();
      ctx.stroke();
      };

    contour.delete();
  };

  return rectangles;

}