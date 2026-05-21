"use strict";

const profiles = {
  chlorine: {
    label: "Victorian chlorine profile",
    targets: { chlorine: 1.5, combined: 1, ph: 7.5, alkalinity: 100, calcium: 250, cya: 0, salt: 0, bromine: 4 },
    ranges: { sanitizer: "min 1.0 ppm", ph: "7.2-7.8", cya: "none indoors" }
  },
  salt: {
    label: "Victorian outdoor salt profile",
    targets: { chlorine: 2, combined: 1, ph: 7.5, alkalinity: 100, calcium: 250, cya: 30, salt: 4000, bromine: 4 },
    ranges: { sanitizer: "min 2.0 ppm with CYA", ph: "7.2-7.8", cya: "ideal <= 30 ppm" }
  },
  bromine: {
    label: "Victorian bromine profile",
    targets: { chlorine: 1.5, combined: 1, ph: 7.6, alkalinity: 100, calcium: 250, cya: 0, salt: 0, bromine: 4 },
    ranges: { sanitizer: "2-8 ppm", ph: "7.2-8.0", cya: "no benefit" }
  }
};

const storageKey = "pool-dose-calculator-v2";

const ids = [
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
  "stabilizerPurity",
  "reportPaste"
];

const $ = (id) => document.getElementById(id);
const all = (selector) => Array.from(document.querySelectorAll(selector));

function selected(name) {
  return document.querySelector(`input[name="${name}"]:checked`).value;
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
    return null;
  }

  return numberValue("combinedChlorine");
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

function muriaticForPh(volumeLitres, phDrop, alkalinity, strength) {
  const alkFactor = clamp((alkalinity || 90) / 90, 0.75, 1.6);
  const standardStrength = 31.45;
  return 473 * (volumeLitres / 37854) * (phDrop / 0.2) * alkFactor * (standardStrength / strength);
}

function sodaAshForPh(volumeLitres, phRise) {
  return 22.5 * (volumeLitres / 10000) * (phRise / 0.1);
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

function setTargetsFromProfile() {
  const profile = profiles[selected("sanitizer")];
  setValue("targetChlorine", profile.targets.chlorine);
  setValue("targetCombined", profile.targets.combined);
  setValue("targetBromine", profile.targets.bromine);
  setValue("targetPh", profile.targets.ph);
  setValue("targetAlkalinity", profile.targets.alkalinity);
  setValue("targetCalcium", profile.targets.calcium);
  setValue("targetCya", profile.targets.cya);
  setValue("targetSalt", profile.targets.salt);
  updateVisibility();
  saveState();
  calculate();
}

function updateVisibility() {
  const sanitizer = selected("sanitizer");
  const testSet = selected("testSet");
  const isBromine = sanitizer === "bromine";
  const isFull = testSet === "full";
  const isSalt = sanitizer === "salt";
  const targetSummary = sanitizer === "bromine"
    ? `Bromine ${formatNumber(positiveNumber("targetBromine", profiles.bromine.targets.bromine), 1)} ppm, pH ${formatNumber(positiveNumber("targetPh", profiles.bromine.targets.ph), 1)}`
    : `Free chlorine ${formatNumber(positiveNumber("targetChlorine", profiles[sanitizer].targets.chlorine), 1)} ppm, pH ${formatNumber(positiveNumber("targetPh", profiles[sanitizer].targets.ph), 1)}`;

  all(".chlorine-field").forEach((node) => node.classList.toggle("is-hidden", isBromine));
  all(".bromine-field").forEach((node) => node.classList.toggle("is-hidden", !isBromine));
  all(".target-chlorine").forEach((node) => node.classList.toggle("is-hidden", isBromine));
  all(".target-combined").forEach((node) => node.classList.toggle("is-hidden", isBromine));
  all(".target-bromine").forEach((node) => node.classList.toggle("is-hidden", !isBromine));
  all(".full-test").forEach((node) => node.classList.toggle("is-hidden", !isFull));
  all(".target-cya").forEach((node) => node.classList.toggle("is-hidden", !isFull || isBromine));
  all(".target-salt").forEach((node) => node.classList.toggle("is-hidden", !isFull || !isSalt));

  $("profileHint").textContent = profiles[sanitizer].label;
  $("targetSummary").textContent = targetSummary;
  $("targetPhHelp").textContent = sanitizer === "bromine" ? "Vic bromine range 7.2-8.0" : "Vic chlorine range 7.2-7.8";
}

function saveState() {
  const state = {
    sanitizer: selected("sanitizer"),
    testSet: selected("testSet"),
    values: {}
  };

  ids.forEach((id) => {
    state.values[id] = $(id).value;
  });

  localStorage.setItem(storageKey, JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem(storageKey);
  if (!raw) {
    updateVisibility();
    calculate();
    return;
  }

  try {
    const state = JSON.parse(raw);
    if (state.sanitizer) {
      const sanitizerInput = document.querySelector(`input[name="sanitizer"][value="${state.sanitizer}"]`);
      if (sanitizerInput) sanitizerInput.checked = true;
    }
    if (state.testSet) {
      const testInput = document.querySelector(`input[name="testSet"][value="${state.testSet}"]`);
      if (testInput) testInput.checked = true;
    }
    Object.entries(state.values || {}).forEach(([id, value]) => {
      if ($(id)) $(id).value = value;
    });
  } catch {
    localStorage.removeItem(storageKey);
  }

  updateVisibility();
  calculate();
}

function parseReport() {
  const text = $("reportPaste").value;
  if (!text.trim()) {
    setStatus("Paste empty");
    return;
  }

  const patterns = [
    ["freeChlorine", /\b(?:free\s*(?:chlorine|cl)|fc)\b[^0-9.-]*(-?\d+(?:\.\d+)?)/i],
    ["totalChlorine", /\b(?:total\s*(?:chlorine|cl)|tc)\b[^0-9.-]*(-?\d+(?:\.\d+)?)/i],
    ["combinedChlorine", /\b(?:combined\s*(?:chlorine|cl)|cc)\b[^0-9.-]*(-?\d+(?:\.\d+)?)/i],
    ["bromine", /\b(?:total\s*bromine|bromine|br)\b[^0-9.-]*(-?\d+(?:\.\d+)?)/i],
    ["ph", /\bpH\b[^0-9.-]*(-?\d+(?:\.\d+)?)/i],
    ["alkalinity", /\b(?:total\s*alkalinity|alkalinity|alk|ta)\b[^0-9.-]*(-?\d+(?:\.\d+)?)/i],
    ["calcium", /\b(?:calcium\s*hardness|hardness|calcium|ch)\b[^0-9.-]*(-?\d+(?:\.\d+)?)/i],
    ["cya", /\b(?:cyanuric\s*acid|stabili[sz]er|cya)\b[^0-9.-]*(-?\d+(?:\.\d+)?)/i],
    ["salt", /\b(?:salt|salinity|nacl)\b[^0-9.-]*(-?\d+(?:\.\d+)?)/i]
  ];

  let count = 0;
  patterns.forEach(([id, pattern]) => {
    const match = text.match(pattern);
    if (match && $(id)) {
      setValue(id, match[1]);
      count += 1;
    }
  });

  const free = numberValue("freeChlorine");
  const total = numberValue("totalChlorine");
  if (free !== null && total !== null) {
    syncCombinedChlorine();
    count += 1;
  }

  setStatus(count ? `${count} readings parsed` : "No readings found");
  saveState();
  calculate();
}

function setStatus(text) {
  $("statusPill").textContent = text;
}

function hasAnyReading() {
  return [
    "freeChlorine",
    "totalChlorine",
    "combinedChlorine",
    "bromine",
    "ph",
    "alkalinity",
    "calcium",
    "cya",
    "salt"
  ].some((id) => numberValue(id) !== null);
}

function calculate() {
  updateVisibility();
  syncCombinedChlorine();
  const volume = poolVolumeLitres();
  $("volumeReadout").textContent = `${formatNumber(volume, 0)} L pool`;

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
  const muriaticStrength = positiveNumber("muriaticStrength", 31.45);

  if (sanitizer === "bromine") {
    calculateBromine(cards, volume);
  } else {
    calculateChlorine(cards, volume, liquidStrength, granularStrength);
  }

  calculatePh(cards, volume, alkalinity, muriaticStrength);

  if (testSet === "full") {
    calculateAlkalinity(cards, volume, muriaticStrength);
    calculateCalcium(cards, volume);
    calculateCya(cards, volume, sanitizer);
    calculateSalt(cards, volume, sanitizer);
  }

  if (cards.length === 0 && hasAnyReading()) {
    cards.push({
      title: "No dose needed",
      badge: "ok",
      amount: "Balanced",
      chemical: "for the entered targets",
      body: "Keep circulating and retest on the normal schedule."
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
  let combined = syncCombinedChlorine();
  const target = positiveNumber("targetChlorine", profiles[selected("sanitizer")].targets.chlorine);
  const combinedAction = positiveNumber("targetCombined", profiles[selected("sanitizer")].targets.combined);
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
  const target = positiveNumber("targetBromine", profiles.bromine.targets.bromine);
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

function calculatePh(cards, volume, alkalinity, muriaticStrength) {
  const ph = numberValue("ph");
  const target = positiveNumber("targetPh", 7.5);

  if (ph === null) return;

  if (ph > target + 0.05) {
    const drop = ph - target;
    const dryAcid = dryAcidForPh(volume, drop, alkalinity);
    const muriatic = muriaticForPh(volume, drop, alkalinity, muriaticStrength);
    const splitNote = drop > 0.4 ? " Split the dose and retest between additions." : "";
    cards.push({
      title: "Lower pH",
      badge: "dose",
      amount: formatMass(dryAcid),
      chemical: "dry acid",
      body: `Estimated drop from pH ${formatNumber(ph, 1)} to ${formatNumber(target, 1)}.${splitNote}`,
      effect: "Lowers pH and also lowers total alkalinity a little.",
      alt: [`Alternative: ${formatVolume(muriatic)} of ${formatNumber(muriaticStrength, 1)}% muriatic acid.`]
    });
  } else if (ph < target - 0.05) {
    const rise = target - ph;
    const sodaAsh = sodaAshForPh(volume, rise);
    cards.push({
      title: "Raise pH",
      badge: "dose",
      amount: formatMass(sodaAsh),
      chemical: "soda ash",
      body: `Estimated rise from pH ${formatNumber(ph, 1)} to ${formatNumber(target, 1)}.`,
      effect: "Raises pH and can also lift total alkalinity."
    });
  }
}

function calculateAlkalinity(cards, volume, muriaticStrength) {
  const current = numberValue("alkalinity");
  const target = positiveNumber("targetAlkalinity", 90);

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
      amount: formatVolume(acidForAlkalinity(volume, delta, muriaticStrength)),
      chemical: "muriatic acid total",
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
      effect: "Increases calcium hardness, which helps protect plaster/concrete surfaces from aggressive water."
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
  if (current === null || sanitizer === "bromine") return;

  const target = positiveNumber("targetCya", profiles[sanitizer].targets.cya);
  const purity = positiveNumber("stabilizerPurity", 100);

  if (current < target - 5) {
    const delta = target - current;
    cards.push({
      title: "Raise stabilizer",
      badge: "dose",
      amount: formatMass(stabilizerDose(volume, delta, purity)),
      chemical: `${formatNumber(purity, 1)}% cyanuric acid`,
      body: `Raises stabilizer by about ${formatNumber(delta, 0)} ppm. Add slowly through the skimmer or sock method per label.`,
      effect: "Increases CYA, which protects chlorine from sunlight but makes high chlorine levels less effective."
    });
  } else if (current > target + 20) {
    const fraction = replacementFraction(current, target);
    cards.push({
      title: "Stabilizer is high",
      badge: "watch",
      amount: `${formatNumber(fraction * 100, 0)}%`,
      chemical: "water replacement",
      body: `Approximate replacement volume: ${formatLitres(volume * fraction)}.`,
      effect: "Dilutes stabilizer; CYA does not evaporate and usually only drops through water replacement or splash-out."
    });
  }
}

function calculateSalt(cards, volume, sanitizer) {
  const current = numberValue("salt");
  if (current === null || sanitizer !== "salt") return;

  const target = positiveNumber("targetSalt", profiles.salt.targets.salt);

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

function resetApp() {
  localStorage.removeItem(storageKey);
  ids.forEach((id) => {
    if (id === "poolVolume") setValue(id, "50000");
    else if (id === "volumeUnit") setValue(id, "litres");
    else if (id === "liquidChlorineStrength") setValue(id, "12.5");
    else if (id === "granularChlorineStrength") setValue(id, "65");
    else if (id === "muriaticStrength") setValue(id, "31.45");
    else if (id === "bromineStrength") setValue(id, "61");
    else if (id === "calciumPurity") setValue(id, "77");
    else if (id === "stabilizerPurity") setValue(id, "100");
    else if (id !== "reportPaste") setValue(id, "");
    else setValue(id, "");
  });
  document.querySelector('input[name="sanitizer"][value="chlorine"]').checked = true;
  document.querySelector('input[name="testSet"][value="basic"]').checked = true;
  setTargetsFromProfile();
  setStatus("Reset");
}

function bindEvents() {
  ids.forEach((id) => {
    $(id).addEventListener("input", calculate);
    $(id).addEventListener("change", calculate);
  });

  all('input[name="sanitizer"]').forEach((input) => {
    input.addEventListener("change", setTargetsFromProfile);
  });

  all('input[name="testSet"]').forEach((input) => {
    input.addEventListener("change", () => {
      updateVisibility();
      saveState();
      calculate();
    });
  });

  $("calculateNow").addEventListener("click", calculate);
  $("parseReport").addEventListener("click", parseReport);
  $("resetTargets").addEventListener("click", setTargetsFromProfile);
  $("resetApp").addEventListener("click", resetApp);
}

bindEvents();
loadState();
