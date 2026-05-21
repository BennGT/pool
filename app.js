"use strict";

const poolDefaults = {
  chiller: {
    name: "Chiller",
    volume: 7500,
    sanitizer: "chlorine",
    allowCya: true,
    note: "Stabiliser can be used if this pool is operated outdoors."
  },
  "indoor-plunge": {
    name: "Indoor Plunge",
    volume: 4500,
    sanitizer: "chlorine",
    allowCya: false,
    note: "Indoor pool: cyanuric acid is hidden."
  },
  "indoor-swimming": {
    name: "Indoor Swimming Pool",
    volume: 150000,
    sanitizer: "chlorine",
    allowCya: false,
    note: "Indoor pool: cyanuric acid is hidden."
  }
};

const sanitizerLabels = {
  chlorine: "Victorian chlorine profile",
  salt: "Victorian salt profile",
  bromine: "Victorian bromine profile"
};

const storageKey = "pool-dose-calculator-v3";

const valueIds = [
  "poolVolume",
  "volumeUnit",
  "freeChlorine",
  "totalChlorine",
  "combinedChlorine",
  "bromine",
  "ph",
  "alkalinity",
  "calcium",
  "cya",
  "salt",
  "targetChlorine",
  "targetCombined",
  "targetBromine",
  "targetPh",
  "targetAlkalinity",
  "targetCalcium",
  "targetCya",
  "targetSalt",
  "liquidChlorineStrength",
  "granularChlorineStrength",
  "muriaticStrength",
  "bromineStrength",
  "calciumPurity",
  "stabilizerPurity"
];

const readingIds = [
  "freeChlorine",
  "totalChlorine",
  "combinedChlorine",
  "bromine",
  "ph",
  "alkalinity",
  "calcium",
  "cya",
  "salt"
];

let profileSettings = makeDefaultProfileSettings();
let lastPoolKey = "chiller";
let drawerTouchStartX = null;

const $ = (id) => document.getElementById(id);
const all = (selector) => Array.from(document.querySelectorAll(selector));

function makeDefaultProfileSettings() {
  return Object.fromEntries(
    Object.entries(poolDefaults).map(([key, profile]) => [
      key,
      { sanitizer: profile.sanitizer }
    ])
  );
}

function selected(name) {
  return document.querySelector(`input[name="${name}"]:checked`).value;
}

function setRadio(name, value) {
  const input = document.querySelector(`input[name="${name}"][value="${value}"]`);
  if (input) input.checked = true;
}

function numberValue(id) {
  const value = parseFloat($(id).value);
  return Number.isFinite(value) ? value : null;
}

function positiveNumber(id, fallback) {
  const value = numberValue(id);
  return value !== null && value > 0 ? value : fallback;
}

function setValue(id, value) {
  $(id).value = value === null || value === undefined ? "" : String(value);
}

function currentPoolKey() {
  return $("poolProfile").value;
}

function currentPool() {
  return poolDefaults[currentPoolKey()];
}

function activePoolAllowsCya() {
  return Boolean(currentPool().allowCya && selected("sanitizer") !== "bromine");
}

function isSaltPool() {
  return selected("sanitizer") === "salt";
}

function syncCombinedChlorine() {
  if (selected("sanitizer") === "bromine") return null;

  const free = numberValue("freeChlorine");
  const total = numberValue("totalChlorine");

  if (free !== null && total !== null) {
    const combined = Math.max(total - free, 0);
    setValue("combinedChlorine", combined.toFixed(1));
    return combined;
  }

  if (free !== null || total !== null) {
    setValue("combinedChlorine", "");
  }

  return null;
}

function poolVolumeLitres() {
  const volume = positiveNumber("poolVolume", 0);
  return $("volumeUnit").value === "gallons" ? volume * 3.785411784 : volume;
}

function formatNumber(value, maxDigits = 1) {
  return new Intl.NumberFormat("en-AU", {
    maximumFractionDigits: maxDigits,
    minimumFractionDigits: 0
  }).format(value);
}

function niceDose(value) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value < 10) return Math.round(value * 10) / 10;
  if (value < 100) return Math.round(value);
  if (value < 1000) return Math.round(value / 5) * 5;
  if (value < 10000) return Math.round(value / 50) * 50;
  return Math.round(value / 100) * 100;
}

function formatMass(grams) {
  const rounded = niceDose(grams);
  if (rounded >= 1000) return `${formatNumber(rounded / 1000, 2)} kg`;
  return `${formatNumber(rounded, 1)} g`;
}

function formatVolume(ml) {
  const rounded = niceDose(ml);
  if (rounded >= 1000) return `${formatNumber(rounded / 1000, 2)} L`;
  return `${formatNumber(rounded, 1)} mL`;
}

function formatLitres(litres) {
  if (litres >= 1000) return `${formatNumber(niceDose(litres), 0)} L`;
  return `${formatNumber(litres, 1)} L`;
}

function ppmDose(volumeLitres, ppmDelta, productPercent) {
  if (ppmDelta <= 0 || productPercent <= 0) return 0;
  return (ppmDelta * volumeLitres) / (10 * productPercent);
}

function dryAcidForPh(volumeLitres, phDrop, alkalinity) {
  const alkFactor = clamp((alkalinity || 90) / 90, 0.75, 1.6);
  return 30 * (volumeLitres / 10000) * (phDrop / 0.1) * alkFactor;
}

function hydrochloricForPh(volumeLitres, phDrop, alkalinity, strength) {
  const alkFactor = clamp((alkalinity || 90) / 90, 0.75, 1.6);
  const standardStrength = 31.45;
  return 473 * (volumeLitres / 37854) * (phDrop / 0.2) * alkFactor * (standardStrength / strength);
}

function sodiumBicarbForPh(volumeLitres, phRise) {
  return 45 * (volumeLitres / 10000) * (phRise / 0.1);
}

function bicarbForAlkalinity(volumeLitres, ppmDelta) {
  return ppmDelta * volumeLitres * 0.00168;
}

function acidForAlkalinity(volumeLitres, ppmDelta, strength) {
  const standardStrength = 31.45;
  return 946 * (volumeLitres / 37854) * (ppmDelta / 10) * (standardStrength / strength);
}

function dryAcidForAlkalinity(volumeLitres, ppmDelta) {
  return 1134 * (volumeLitres / 37854) * (ppmDelta / 10);
}

function calciumChlorideForHardness(volumeLitres, ppmDelta, purity) {
  return (ppmDelta * volumeLitres * 0.001108) / (purity / 100);
}

function stabilizerDose(volumeLitres, ppmDelta, purity) {
  return (ppmDelta * volumeLitres * 0.001) / (purity / 100);
}

function saltDose(volumeLitres, ppmDelta) {
  return ppmDelta * volumeLitres * 0.001;
}

function replacementFraction(current, target) {
  if (!current || current <= target) return 0;
  return clamp(1 - target / current, 0, 0.95);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function currentDefaultTargets() {
  const sanitizer = selected("sanitizer");
  const cyaAllowed = activePoolAllowsCya();

  if (sanitizer === "bromine") {
    return {
      chlorine: 1.5,
      combined: 1,
      bromine: 4,
      ph: 7.6,
      alkalinity: 100,
      calcium: 250,
      cya: 0,
      salt: 0
    };
  }

  return {
    chlorine: sanitizer === "salt" || cyaAllowed ? 2 : 1.5,
    combined: 1,
    bromine: 4,
    ph: 7.5,
    alkalinity: 100,
    calcium: 250,
    cya: cyaAllowed ? 30 : 0,
    salt: sanitizer === "salt" ? 4000 : 0
  };
}

function setTargetsFromProfile() {
  const targets = currentDefaultTargets();
  setValue("targetChlorine", targets.chlorine);
  setValue("targetCombined", targets.combined);
  setValue("targetBromine", targets.bromine);
  setValue("targetPh", targets.ph);
  setValue("targetAlkalinity", targets.alkalinity);
  setValue("targetCalcium", targets.calcium);
  setValue("targetCya", targets.cya);
  setValue("targetSalt", targets.salt);
  updateVisibility();
  saveState();
  calculate();
}

function savePoolSettings(key = currentPoolKey()) {
  if (!poolDefaults[key]) return;
  profileSettings[key] = {
    sanitizer: selected("sanitizer")
  };
}

function applyPoolProfile(key = currentPoolKey()) {
  const settings = profileSettings[key] || {
    sanitizer: poolDefaults[key].sanitizer
  };
  setValue("poolVolume", poolDefaults[key].volume);
  setValue("volumeUnit", "litres");
  setRadio("sanitizer", settings.sanitizer);
  lastPoolKey = key;
  updateVisibility();
  setTargetsFromProfile();
}

function updateVisibility() {
  const sanitizer = selected("sanitizer");
  const testSet = selected("testSet");
  const isBromine = sanitizer === "bromine";
  const isFull = testSet === "full";
  const isSalt = isSaltPool();
  const cyaAllowed = activePoolAllowsCya();
  const pool = currentPool();
  const targetSummary = isBromine
    ? `${pool.name}: bromine ${formatNumber(positiveNumber("targetBromine", 4), 1)} ppm, pH ${formatNumber(positiveNumber("targetPh", 7.6), 1)}`
    : `${pool.name}: free chlorine ${formatNumber(positiveNumber("targetChlorine", 1.5), 1)} ppm, pH ${formatNumber(positiveNumber("targetPh", 7.5), 1)}`;

  all(".chlorine-field").forEach((node) => node.classList.toggle("is-hidden", isBromine));
  all(".bromine-field").forEach((node) => node.classList.toggle("is-hidden", !isBromine));
  all(".target-chlorine").forEach((node) => node.classList.toggle("is-hidden", isBromine));
  all(".target-combined").forEach((node) => node.classList.toggle("is-hidden", isBromine));
  all(".target-bromine").forEach((node) => node.classList.toggle("is-hidden", !isBromine));
  all(".full-test").forEach((node) => node.classList.toggle("is-hidden", !isFull));
  all(".cya-field").forEach((node) => node.classList.toggle("is-hidden", !isFull || !cyaAllowed));
  all(".target-cya").forEach((node) => node.classList.toggle("is-hidden", !cyaAllowed));
  all(".salt-field").forEach((node) => node.classList.toggle("is-hidden", !isFull || !isSalt));
  all(".target-salt").forEach((node) => node.classList.toggle("is-hidden", !isSalt));

  $("profileHint").textContent = `${pool.name} - ${sanitizerLabels[sanitizer]}`;
  $("poolProfileNote").textContent = pool.note;
  $("testSetHint").textContent = testSet === "full" ? "Weekly test" : "Daily test";
  $("targetSummary").textContent = targetSummary;
  $("phReadingHelp").textContent = isBromine ? "Vic bromine range 7.2-8.0" : "Vic chlorine range 7.2-7.8";
  $("targetPhHelp").textContent = isBromine ? "Vic bromine range 7.2-8.0" : "Vic chlorine range 7.2-7.8";
  $("targetChlorineHelp").textContent = cyaAllowed || isSalt ? "Vic min 2.0 ppm where CYA is used" : "Vic min 1.0 ppm without CYA";
  $("targetCyaHelp").textContent = cyaAllowed ? "Vic outdoor max 100 ppm; ideal 30 ppm or less" : "Indoor pools do not use CYA";
  $("chemicalSummary").textContent = `${formatNumber(positiveNumber("muriaticStrength", 31.45), 1)}% hydrochloric acid, ${formatNumber(positiveNumber("calciumPurity", 77), 1)}% calcium chloride`;
  fitSegmentLabels();
}

function fitSegmentLabels() {
  if (typeof window === "undefined" || !window.getComputedStyle) return;

  all(".segmented span").forEach((label) => {
    if (!label.clientWidth) return;

    label.style.fontSize = "";
    const baseSize = parseFloat(window.getComputedStyle(label).fontSize);
    let nextSize = baseSize;

    while (label.scrollWidth > label.clientWidth && nextSize > 10) {
      nextSize -= 0.5;
      label.style.fontSize = `${nextSize}px`;
    }
  });
}

function saveState() {
  savePoolSettings();
  const state = {
    activePool: currentPoolKey(),
    testSet: selected("testSet"),
    profileSettings,
    values: {}
  };

  valueIds.forEach((id) => {
    if ($(id)) state.values[id] = $(id).value;
  });

  localStorage.setItem(storageKey, JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem(storageKey);

  if (!raw) {
    setValue("poolProfile", "chiller");
    applyPoolProfile("chiller");
    calculate();
    return;
  }

  try {
    const state = JSON.parse(raw);
    profileSettings = {
      ...makeDefaultProfileSettings(),
      ...(state.profileSettings || {})
    };

    setValue("poolProfile", state.activePool || "chiller");
    if (state.testSet) setRadio("testSet", state.testSet);
    applyPoolProfile(currentPoolKey());

    Object.entries(state.values || {}).forEach(([id, value]) => {
      if (!$(id)) return;
      if (id === "poolVolume") return;
      if (id === "volumeUnit") return;
      setValue(id, value);
    });
  } catch {
    localStorage.removeItem(storageKey);
    profileSettings = makeDefaultProfileSettings();
    setValue("poolProfile", "chiller");
    applyPoolProfile("chiller");
  }

  updateVisibility();
  calculate();
}

function setStatus(text) {
  $("statusPill").textContent = text;
}

function hasAnyReading() {
  return readingIds.some((id) => numberValue(id) !== null);
}

function calculate() {
  updateVisibility();
  syncCombinedChlorine();

  const volume = poolVolumeLitres();
  $("volumeReadout").textContent = `${formatNumber(volume, 0)} L - ${currentPool().name}`;

  if (!volume || volume <= 0 || !hasAnyReading()) {
    renderCards([]);
    setStatus("Ready");
    saveState();
    return;
  }

  const cards = [];
  const sanitizer = selected("sanitizer");
  const testSet = selected("testSet");
  const alkalinity = numberValue("alkalinity");
  const liquidStrength = positiveNumber("liquidChlorineStrength", 12.5);
  const granularStrength = positiveNumber("granularChlorineStrength", 65);
  const hydrochloricStrength = positiveNumber("muriaticStrength", 31.45);

  if (sanitizer === "bromine") {
    calculateBromine(cards, volume);
  } else {
    calculateChlorine(cards, volume, liquidStrength, granularStrength);
  }

  calculatePh(cards, volume, alkalinity, hydrochloricStrength);

  if (testSet === "full") {
    calculateAlkalinity(cards, volume, hydrochloricStrength);
    calculateCalcium(cards, volume);
    calculateCya(cards, volume, sanitizer);
    calculateSalt(cards, volume, sanitizer);
  }

  if (cards.length === 0 && hasAnyReading()) {
    cards.push({
      title: "No dose needed",
      badge: "ok",
      amount: "Balanced",
      chemical: "for the saved targets",
      body: "Keep circulating and retest on the normal schedule.",
      effect: "No chemical change is recommended from the readings entered."
    });
  }

  renderCards(cards);
  const doseCount = cards.filter((card) => card.badge === "dose").length;
  setStatus(doseCount ? `${doseCount} dose${doseCount === 1 ? "" : "s"}` : "No dose");
  saveState();
}

function calculateChlorine(cards, volume, liquidStrength, granularStrength) {
  const free = numberValue("freeChlorine");
  const total = numberValue("totalChlorine");
  const combined = syncCombinedChlorine();
  const target = positiveNumber("targetChlorine", currentDefaultTargets().chlorine);
  const combinedAction = positiveNumber("targetCombined", 1);
  const combinedIdeal = 0.2;

  if (free !== null) {
    if (free < target - 0.1) {
      const delta = target - free;
      const liquidMl = ppmDose(volume, delta, liquidStrength);
      const granularGrams = ppmDose(volume, delta, granularStrength);
      cards.push({
        title: "Raise free chlorine",
        badge: "dose",
        amount: formatVolume(liquidMl),
        chemical: `${formatNumber(liquidStrength, 1)}% liquid chlorine`,
        body: `Raises free chlorine by about ${formatNumber(delta, 1)} ppm to ${formatNumber(target, 1)} ppm.`,
        effect: "Raises the active sanitiser residual. Liquid chlorine can also slowly add salt and nudge pH upward.",
        alt: [`Alternative: ${formatMass(granularGrams)} of ${formatNumber(granularStrength, 1)}% granular chlorine.`]
      });
    } else if (free > target + 1.5) {
      cards.push({
        title: "Free chlorine is high",
        badge: "watch",
        amount: "Hold",
        chemical: "chlorine dosing",
        body: `Current free chlorine is ${formatNumber(free, 1)} ppm. Let it drift down toward ${formatNumber(target, 1)} ppm before adding more.`,
        effect: "Holding chlorine dosing lets the sanitiser residual reduce through normal demand, sunlight and circulation."
      });
    }
  }

  if (total !== null && total > 10) {
    cards.push({
      title: "Total chlorine above Victorian max",
      badge: "stop",
      amount: "Hold",
      chemical: "chlorine dosing",
      body: `Victorian guidance lists total chlorine max 10 ppm. Current total chlorine is ${formatNumber(total, 1)} ppm.`,
      effect: "Do not add more chlorinating product while total chlorine is above the operating limit."
    });
  }

  if (combined !== null && combined > combinedAction) {
    const shockDelta = combined * 10;
    const liquidMl = ppmDose(volume, shockDelta, liquidStrength);
    const granularGrams = ppmDose(volume, shockDelta, granularStrength);
    cards.push({
      title: "Combined chlorine cleanup",
      badge: "dose",
      amount: formatVolume(liquidMl),
      chemical: `${formatNumber(liquidStrength, 1)}% liquid chlorine`,
      body: `Breakpoint estimate for ${formatNumber(combined, 1)} ppm combined chlorine. Victorian max is ${formatNumber(combinedAction, 1)} ppm and ideal is under ${formatNumber(combinedIdeal, 1)} ppm.`,
      effect: "Oxidises chloramines, which are used-up chlorine compounds that can cause odour, eye irritation and poor disinfection.",
      alt: [`Alternative: ${formatMass(granularGrams)} of ${formatNumber(granularStrength, 1)}% granular chlorine.`]
    });
  } else if (combined !== null && combined > combinedIdeal) {
    cards.push({
      title: "Combined chlorine above ideal",
      badge: "watch",
      amount: `${formatNumber(combined, 1)} ppm`,
      chemical: "combined chlorine",
      body: `Victorian guidance says combined chlorine should ideally be under ${formatNumber(combinedIdeal, 1)} ppm and must be less than free chlorine.`,
      effect: "Combined chlorine is chlorine that has reacted with contaminants; improved oxidation, ventilation, dilution or UV can reduce it."
    });
  }
}

function calculateBromine(cards, volume) {
  const bromine = numberValue("bromine");
  const target = positiveNumber("targetBromine", 4);
  const strength = positiveNumber("bromineStrength", 61);

  if (bromine === null) return;

  if (bromine < target - 0.1) {
    const delta = target - bromine;
    const grams = ppmDose(volume, delta, strength);
    cards.push({
      title: "Raise bromine",
      badge: "dose",
      amount: formatMass(grams),
      chemical: `${formatNumber(strength, 1)}% bromine granules`,
      body: `Raises total bromine by about ${formatNumber(delta, 1)} ppm to ${formatNumber(target, 1)} ppm.`,
      effect: "Raises the bromine sanitiser residual so the water can keep disinfecting between bather loads."
    });
  } else if (bromine > target + 2) {
    cards.push({
      title: "Bromine is high",
      badge: "watch",
      amount: "Hold",
      chemical: "bromine dosing",
      body: `Current bromine is ${formatNumber(bromine, 1)} ppm. Let it drift down toward ${formatNumber(target, 1)} ppm.`,
      effect: "Holding bromine dosing lets the residual reduce through normal demand and dilution."
    });
  }
}

function calculatePh(cards, volume, alkalinity, hydrochloricStrength) {
  const ph = numberValue("ph");
  const target = positiveNumber("targetPh", selected("sanitizer") === "bromine" ? 7.6 : 7.5);

  if (ph === null) return;

  if (ph > target + 0.05) {
    const drop = ph - target;
    const dryAcid = dryAcidForPh(volume, drop, alkalinity);
    const hydrochloric = hydrochloricForPh(volume, drop, alkalinity, hydrochloricStrength);
    const splitNote = drop > 0.4 ? " Split the dose and retest between additions." : "";
    cards.push({
      title: "Lower pH",
      badge: "dose",
      amount: formatVolume(hydrochloric),
      chemical: `${formatNumber(hydrochloricStrength, 1)}% hydrochloric acid`,
      body: `Estimated drop from pH ${formatNumber(ph, 1)} to ${formatNumber(target, 1)}.${splitNote}`,
      effect: "Lowers pH and also lowers total alkalinity a little.",
      alt: [`Dry acid option: ${formatMass(dryAcid)}.`]
    });
  } else if (ph < target - 0.05) {
    const rise = target - ph;
    const sodiumBicarb = sodiumBicarbForPh(volume, rise);
    cards.push({
      title: "Raise pH",
      badge: "dose",
      amount: formatMass(sodiumBicarb),
      chemical: "sodium bicarbonate",
      body: `Estimated slow pH lift from ${formatNumber(ph, 1)} toward ${formatNumber(target, 1)}. Retest after circulation.`,
      effect: "Raises pH slowly and increases total alkalinity."
    });
  }
}

function calculateAlkalinity(cards, volume, hydrochloricStrength) {
  const current = numberValue("alkalinity");
  const target = positiveNumber("targetAlkalinity", 100);

  if (current === null) return;

  if (current < target - 5) {
    const delta = target - current;
    cards.push({
      title: "Raise alkalinity",
      badge: "dose",
      amount: formatMass(bicarbForAlkalinity(volume, delta)),
      chemical: "sodium bicarbonate",
      body: `Raises total alkalinity by about ${formatNumber(delta, 0)} ppm.`,
      effect: "Increases alkalinity, which buffers pH and makes pH changes less sudden."
    });
  } else if (current > target + 15) {
    const delta = current - target;
    cards.push({
      title: "Lower alkalinity",
      badge: "watch",
      amount: formatVolume(acidForAlkalinity(volume, delta, hydrochloricStrength)),
      chemical: "hydrochloric acid total",
      body: "Use staged acid and aeration cycles; this is not a single-dose instruction.",
      effect: "Lowers total alkalinity and pH; aeration raises pH back up without restoring alkalinity.",
      alt: [`Dry acid equivalent: ${formatMass(dryAcidForAlkalinity(volume, delta))}.`]
    });
  }
}

function calculateCalcium(cards, volume) {
  const current = numberValue("calcium");
  const target = positiveNumber("targetCalcium", 250);
  const purity = positiveNumber("calciumPurity", 77);

  if (current === null) return;

  if (current < target - 10) {
    const delta = target - current;
    cards.push({
      title: "Raise calcium hardness",
      badge: "dose",
      amount: formatMass(calciumChlorideForHardness(volume, delta, purity)),
      chemical: `${formatNumber(purity, 1)}% calcium chloride`,
      body: `Raises calcium hardness by about ${formatNumber(delta, 0)} ppm.`,
      effect: "Increases calcium hardness, which helps protect concrete surfaces and tile grout from aggressive water."
    });
  } else if (current > target + 100) {
    const fraction = replacementFraction(current, target);
    cards.push({
      title: "Calcium hardness is high",
      badge: "watch",
      amount: `${formatNumber(fraction * 100, 0)}%`,
      chemical: "water replacement",
      body: `Approximate replacement volume: ${formatLitres(volume * fraction)}. Check source-water hardness first.`,
      effect: "Dilutes calcium hardness; chemical additions cannot directly remove calcium from pool water."
    });
  }
}

function calculateCya(cards, volume, sanitizer) {
  const current = numberValue("cya");
  if (current === null || sanitizer === "bromine" || !activePoolAllowsCya()) return;

  const target = positiveNumber("targetCya", 30);
  const purity = positiveNumber("stabilizerPurity", 100);

  if (current < target - 5) {
    const delta = target - current;
    cards.push({
      title: "Raise stabiliser",
      badge: "dose",
      amount: formatMass(stabilizerDose(volume, delta, purity)),
      chemical: `${formatNumber(purity, 1)}% stabiliser`,
      body: `Raises cyanuric acid by about ${formatNumber(delta, 0)} ppm.`,
      effect: "Increases stabiliser, which protects chlorine from sunlight but makes high chlorine levels less effective."
    });
  } else if (current > target + 20) {
    const fraction = replacementFraction(current, target);
    cards.push({
      title: "Stabiliser is high",
      badge: "watch",
      amount: `${formatNumber(fraction * 100, 0)}%`,
      chemical: "water replacement",
      body: `Approximate replacement volume: ${formatLitres(volume * fraction)}.`,
      effect: "Dilutes stabiliser; CYA does not evaporate and usually only drops through water replacement or splash-out."
    });
  }
}

function calculateSalt(cards, volume, sanitizer) {
  const current = numberValue("salt");
  if (current === null || sanitizer !== "salt") return;

  const target = positiveNumber("targetSalt", 4000);

  if (current < target - 100) {
    const delta = target - current;
    cards.push({
      title: "Raise salt",
      badge: "dose",
      amount: formatMass(saltDose(volume, delta)),
      chemical: "pool salt",
      body: `Raises salt by about ${formatNumber(delta, 0)} ppm. Match the chlorinator manual when it differs from this target.`,
      effect: "Increases salinity so the salt chlorinator can generate chlorine correctly."
    });
  } else if (current > target + 500) {
    const fraction = replacementFraction(current, target);
    cards.push({
      title: "Salt is high",
      badge: "watch",
      amount: `${formatNumber(fraction * 100, 0)}%`,
      chemical: "water replacement",
      body: `Approximate replacement volume: ${formatLitres(volume * fraction)}.`,
      effect: "Dilutes salinity; salt cannot be chemically removed from the water."
    });
  }
}

function renderCards(cards) {
  const results = $("results");
  results.replaceChildren();

  if (!cards.length) {
    const empty = document.createElement("article");
    empty.className = "empty-state";
    empty.innerHTML = "<strong>Enter readings</strong><span>Doses appear as soon as there is enough data.</span>";
    results.append(empty);
    return;
  }

  cards.forEach((card) => {
    const article = document.createElement("article");
    article.className = "dose-card";

    const header = document.createElement("header");
    const title = document.createElement("h3");
    title.textContent = card.title;
    const badge = document.createElement("span");
    badge.className = `badge ${card.badge || "dose"}`;
    badge.textContent = card.badge === "ok" ? "ok" : card.badge || "dose";
    header.append(title, badge);

    const main = document.createElement("div");
    main.className = "dose-main";
    const amount = document.createElement("span");
    amount.className = "dose-amount";
    amount.textContent = card.amount;
    const chemical = document.createElement("span");
    chemical.className = "dose-chemical";
    chemical.textContent = card.chemical;
    main.append(amount, chemical);

    const body = document.createElement("p");
    body.textContent = card.body;
    article.append(header, main, body);

    if (card.effect) {
      const effect = document.createElement("p");
      effect.className = "dose-effect";
      const label = document.createElement("strong");
      label.textContent = "Effect: ";
      effect.append(label, document.createTextNode(card.effect));
      article.append(effect);
    }

    if (card.alt && card.alt.length) {
      const alt = document.createElement("div");
      alt.className = "dose-alt";
      card.alt.forEach((line) => {
        const span = document.createElement("span");
        span.textContent = line;
        alt.append(span);
      });
      article.append(alt);
    }

    results.append(article);
  });
}

function showPage(page) {
  all("[data-page-panel]").forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.pagePanel === page);
  });
  all("[data-nav-page]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.navPage === page);
  });
  closeDrawer();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openDrawer() {
  $("appDrawer").classList.add("is-open");
  $("appDrawer").setAttribute("aria-hidden", "false");
  $("drawerOverlay").hidden = false;
  $("menuToggle").setAttribute("aria-expanded", "true");
}

function closeDrawer() {
  $("appDrawer").classList.remove("is-open");
  $("appDrawer").setAttribute("aria-hidden", "true");
  $("drawerOverlay").hidden = true;
  $("menuToggle").setAttribute("aria-expanded", "false");
}

function resetApp() {
  localStorage.removeItem(storageKey);
  profileSettings = makeDefaultProfileSettings();
  valueIds.forEach((id) => {
    if (id === "poolVolume") setValue(id, "7500");
    else if (id === "volumeUnit") setValue(id, "litres");
    else if (id === "targetChlorine") setValue(id, "1.5");
    else if (id === "targetCombined") setValue(id, "1");
    else if (id === "targetBromine") setValue(id, "4");
    else if (id === "targetPh") setValue(id, "7.5");
    else if (id === "targetAlkalinity") setValue(id, "100");
    else if (id === "targetCalcium") setValue(id, "250");
    else if (id === "targetCya") setValue(id, "30");
    else if (id === "targetSalt") setValue(id, "4000");
    else if (id === "liquidChlorineStrength") setValue(id, "12.5");
    else if (id === "granularChlorineStrength") setValue(id, "65");
    else if (id === "muriaticStrength") setValue(id, "31.45");
    else if (id === "bromineStrength") setValue(id, "61");
    else if (id === "calciumPurity") setValue(id, "77");
    else if (id === "stabilizerPurity") setValue(id, "100");
    else setValue(id, "");
  });
  setValue("poolProfile", "chiller");
  setRadio("sanitizer", "chlorine");
  setRadio("testSet", "basic");
  applyPoolProfile("chiller");
  showPage("calculator");
  setStatus("Reset");
}

function bindEvents() {
  valueIds.forEach((id) => {
    if (!$(id)) return;
    $(id).addEventListener("input", calculate);
    $(id).addEventListener("change", calculate);
  });

  $("poolProfile").addEventListener("change", () => {
    savePoolSettings(lastPoolKey);
    applyPoolProfile(currentPoolKey());
    saveState();
    calculate();
  });

  all('input[name="sanitizer"]').forEach((input) => {
    input.addEventListener("change", () => {
      savePoolSettings();
      setTargetsFromProfile();
    });
  });

  all('input[name="testSet"]').forEach((input) => {
    input.addEventListener("change", () => {
      updateVisibility();
      saveState();
      calculate();
    });
  });

  $("calculateNow").addEventListener("click", calculate);
  $("resetTargets").addEventListener("click", setTargetsFromProfile);
  $("saveTargets").addEventListener("click", () => {
    saveState();
    setStatus("Targets saved");
    showPage("calculator");
  });
  $("saveChemicals").addEventListener("click", () => {
    saveState();
    setStatus("Chemicals saved");
    showPage("calculator");
  });
  $("resetApp").addEventListener("click", resetApp);

  $("menuToggle").addEventListener("click", openDrawer);
  $("drawerClose").addEventListener("click", closeDrawer);
  $("drawerOverlay").addEventListener("click", closeDrawer);
  all("[data-nav-page]").forEach((button) => {
    button.addEventListener("click", () => showPage(button.dataset.navPage));
  });

  $("appDrawer").addEventListener("touchstart", (event) => {
    drawerTouchStartX = event.touches[0].clientX;
  }, { passive: true });

  $("appDrawer").addEventListener("touchend", (event) => {
    if (drawerTouchStartX === null) return;
    const delta = event.changedTouches[0].clientX - drawerTouchStartX;
    drawerTouchStartX = null;
    if (delta < -50) closeDrawer();
  }, { passive: true });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDrawer();
  });

  window.addEventListener("resize", fitSegmentLabels);
}

bindEvents();
loadState();
