const params = new URLSearchParams(window.location.search);
let sujeto = params.get("sujeto") || "";
let codigo = params.get("codigo") || "";

const TOTAL_STEPS = 19; // steps 0-18
let currentStep = -1;
let answers = {};
let registroId = null;
let insertPromise = null;
let resultShown = false;
const needManualCode = !codigo || !sujeto;

// DOM refs
const container = document.getElementById("registro-form-container");
const progressBar = document.getElementById("quiz-progress-bar");
const stepCounter = document.getElementById("quiz-step-counter");
const errorEl = document.getElementById("registro-error");
const waitingScreen = document.getElementById("quiz-waiting");
const resultScreen = document.getElementById("quiz-result");

// ————— INIT —————
function init() {
  if (needManualCode) {
    showStep("pre");
    initManualCodeStep();
  } else {
    updateTitle();
    showStep(0);
  }
  initChipGroups();
  initPreferCards();
  initNombreStep();
  initBirthdayStep();
  initNextChipsBtns();
}

function updateTitle() {
  const corazonLabel = sujeto === "A" ? "Corazón 1" : "Corazón 2";
  document.title = `Quiz - ${corazonLabel}`;
}

// ————— STEP NAVIGATION —————
function showStep(step) {
  document.querySelectorAll(".quiz-step").forEach((el) => {
    el.classList.remove("active");
  });

  const target = document.querySelector(`.quiz-step[data-step="${step}"]`);
  if (target) {
    target.classList.add("active");
    // Re-trigger animation
    target.style.animation = "none";
    target.offsetHeight; // reflow
    target.style.animation = "";
  }

  if (typeof step === "number") {
    currentStep = step;
    const progress = ((step + 1) / TOTAL_STEPS) * 100;
    progressBar.style.width = progress + "%";
    stepCounter.textContent = `${step + 1} / ${TOTAL_STEPS}`;
  }

  errorEl.style.display = "none";

  // Auto-focus input if present
  const input = target?.querySelector(".quiz-input");
  if (input) setTimeout(() => input.focus(), 300);
}

function goNext() {
  // After step 2 (birthday) → INSERT to supabase (store promise so we can await it later)
  if (currentStep === 2) {
    insertPromise = insertBasicInfo();
  }

  if (currentStep < TOTAL_STEPS - 1) {
    showStep(currentStep + 1);
  } else {
    // Last step → submit everything
    submitAllAnswers();
  }
}

// ————— MANUAL CODE STEP —————
function initManualCodeStep() {
  const preCards = document.querySelectorAll("#sujeto-manual-options .prefer-card");
  preCards.forEach((card) => {
    card.addEventListener("click", () => {
      const codeInput = document.getElementById("codigo_manual");
      const code = codeInput?.value?.trim().toUpperCase() || "";
      const errPre = document.getElementById("registro-error-pre");

      if (!code || code.length < 4) {
        if (errPre) {
          errPre.textContent = "Ingresa el código de pareja primero";
          errPre.style.display = "block";
        }
        codeInput?.focus();
        return;
      }

      codigo = code;
      sujeto = card.dataset.value;
      updateTitle();

      // Highlight selected
      preCards.forEach((c) => c.classList.remove("selected", "not-selected"));
      card.classList.add("selected");
      preCards.forEach((c) => {
        if (c !== card) c.classList.add("not-selected");
      });

      setTimeout(() => showStep(0), 400);
    });
  });
}

// ————— NOMBRE STEP —————
function initNombreStep() {
  const btn = document.getElementById("btn-nombre-next");
  const input = document.getElementById("nombre");

  if (btn && input) {
    btn.addEventListener("click", () => {
      const name = input.value.trim();
      if (!name) {
        input.style.borderColor = "#ff6b6b";
        input.focus();
        return;
      }
      input.style.borderColor = "";
      answers.nombre = name;
      goNext();
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        btn.click();
      }
    });
  }
}

// ————— ZODIAC CALCULATION —————
const ZODIAC_DATA = [
  { sign: "Capricornio", symbol: "♑", start: [1, 1], end: [1, 19] },
  { sign: "Acuario", symbol: "♒", start: [1, 20], end: [2, 18] },
  { sign: "Piscis", symbol: "♓", start: [2, 19], end: [3, 20] },
  { sign: "Aries", symbol: "♈", start: [3, 21], end: [4, 19] },
  { sign: "Tauro", symbol: "♉", start: [4, 20], end: [5, 20] },
  { sign: "Géminis", symbol: "♊", start: [5, 21], end: [6, 20] },
  { sign: "Cáncer", symbol: "♋", start: [6, 21], end: [7, 22] },
  { sign: "Leo", symbol: "♌", start: [7, 23], end: [8, 22] },
  { sign: "Virgo", symbol: "♍", start: [8, 23], end: [9, 22] },
  { sign: "Libra", symbol: "♎", start: [9, 23], end: [10, 22] },
  { sign: "Escorpio", symbol: "♏", start: [10, 23], end: [11, 21] },
  { sign: "Sagitario", symbol: "♐", start: [11, 22], end: [12, 21] },
  { sign: "Capricornio", symbol: "♑", start: [12, 22], end: [12, 31] },
];

function getZodiacSign(month, day) {
  for (const z of ZODIAC_DATA) {
    const [sm, sd] = z.start;
    const [em, ed] = z.end;
    const dateNum = month * 100 + day;
    const startNum = sm * 100 + sd;
    const endNum = em * 100 + ed;
    if (dateNum >= startNum && dateNum <= endNum) {
      return { sign: z.sign, symbol: z.symbol };
    }
  }
  return { sign: "Capricornio", symbol: "♑" };
}

const GENDER_SYMBOLS = {
  "Masculino": "♂",
  "Femenino": "♀",
  "Otro": "⚧",
  "Prefiero no decir": "✦",
};

// ————— BIRTHDAY STEP —————
function initBirthdayStep() {
  const dateInput = document.getElementById("fecha_nacimiento");
  const btn = document.getElementById("btn-birthday-next");
  const revealEl = document.getElementById("zodiac-reveal");
  const symbolEl = document.getElementById("zodiac-symbol");
  const nameEl = document.getElementById("zodiac-name");

  if (dateInput) {
    dateInput.addEventListener("change", () => {
      const val = dateInput.value;
      if (!val) {
        revealEl.style.display = "none";
        return;
      }
      const parts = val.split("-");
      const month = parseInt(parts[1]);
      const day = parseInt(parts[2]);
      const zodiac = getZodiacSign(month, day);

      symbolEl.textContent = zodiac.symbol;
      nameEl.textContent = zodiac.sign;
      revealEl.style.display = "flex";
      revealEl.style.animation = "none";
      revealEl.offsetHeight;
      revealEl.style.animation = "stepFadeIn 0.4s ease forwards";

      answers.fecha_nacimiento = val;
      answers.signo_zodiacal = zodiac.sign;
      answers.signo_symbol = zodiac.symbol;
    });
  }

  if (btn) {
    btn.addEventListener("click", () => {
      if (!answers.fecha_nacimiento) {
        dateInput.style.borderColor = "#ff6b6b";
        return;
      }
      dateInput.style.borderColor = "";
      goNext();
    });
  }
}

// ————— CHIP GROUPS —————
function initChipGroups() {
  document.querySelectorAll(".quiz-step .chip-group").forEach((group) => {
    const max = parseInt(group.dataset.max) || 1;
    const autoAdvance = group.dataset.auto === "true";
    const field = group.dataset.field;

    group.querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        if (chip.classList.contains("selected")) {
          chip.classList.remove("selected");
        } else {
          const selected = group.querySelectorAll(".chip.selected");
          if (selected.length >= max) {
            selected[0].classList.remove("selected");
          }
          chip.classList.add("selected");
        }

        // Save answer
        const selectedChips = group.querySelectorAll(".chip.selected");
        const values = Array.from(selectedChips).map((c) => c.dataset.value);
        if (max === 1) {
          answers[field] = values[0] || null;
        } else {
          answers[field] = values.length ? values : null;
        }

        // Auto-advance for single-select
        if (autoAdvance && values.length > 0) {
          setTimeout(() => goNext(), 350);
        }
      });
    });
  });
}

// ————— PREFER CARDS (VS) —————
function initPreferCards() {
  document.querySelectorAll(".quiz-step .prefer-options").forEach((group) => {
    const field = group.dataset.field;
    if (!field) return;

    const cards = group.querySelectorAll(".prefer-card");
    cards.forEach((card) => {
      card.addEventListener("click", () => {
        // Highlight
        cards.forEach((c) => c.classList.remove("selected", "not-selected"));
        card.classList.add("selected");
        cards.forEach((c) => {
          if (c !== card) c.classList.add("not-selected");
        });

        // Save
        answers[field] = card.dataset.value;

        // Auto-advance
        setTimeout(() => goNext(), 450);
      });
    });
  });
}

// ————— NEXT BUTTONS FOR MULTI-SELECT —————
function initNextChipsBtns() {
  document.querySelectorAll(".quiz-next-chips").forEach((btn) => {
    btn.addEventListener("click", () => {
      goNext();
    });
  });
}

// ————— SUPABASE: INSERT BASIC INFO —————
async function insertBasicInfo() {
  if (registroId) return; // already inserted

  let supabase;
  try {
    const mod = await import("./supabaseClient.js");
    supabase = mod.supabase;
  } catch (err) {
    console.warn("supabaseClient no disponible:", err);
    return;
  }

  try {
    const { data, error } = await supabase
      .from("participantes_valentine")
      .insert({
        codigo_par: codigo,
        sujeto: sujeto,
        nombre: answers.nombre || "Anónimo",
        genero: answers.genero || null,
        fecha_nacimiento: answers.fecha_nacimiento || null,
        signo_zodiacal: answers.signo_zodiacal || null,
      })
      .select("id")
      .single();

    if (error) throw error;
    registroId = data?.id;
  } catch (err) {
    console.error("Error al insertar:", err);
  }
}

// ————— SUPABASE: UPDATE ALL ANSWERS —————
async function submitAllAnswers() {
  // Show waiting screen
  container.style.display = "none";
  waitingScreen.style.display = "flex";

  let supabase;
  try {
    const mod = await import("./supabaseClient.js");
    supabase = mod.supabase;
  } catch (err) {
    console.warn("supabaseClient no disponible:", err);
    showResultOffline();
    return;
  }

  // CRITICAL: Wait for the INSERT to finish before trying to UPDATE
  if (insertPromise) {
    await insertPromise;
  }

  // If INSERT still hasn't completed (race condition), retry
  if (!registroId) {
    console.warn("registroId aún no disponible, reintentando INSERT...");
    await insertBasicInfo();
  }

  // Build respuestas object
  const respuestas = {};
  const answerFields = [
    "prefer_dinero_amor", "prefer_playa_montana", "prefer_noche_dia",
    "prefer_netflix_fiesta",
    "prefer_perdonar_justicia", "prefer_hablar_espacio", "prefer_razon_corazon",
    "prefer_planificar_improvisar", "prefer_pocas_muchas", "prefer_feliz_razon",
    "prefer_presente_futuro", "prefer_dar_recibir",
    "color_favorito", "valores_relacion", "musica_favorita", "algo_feliz"
  ];
  answerFields.forEach((f) => {
    if (answers[f] !== undefined) respuestas[f] = answers[f];
  });

  try {
    if (registroId) {
      const { error } = await supabase
        .from("participantes_valentine")
        .update({ respuestas })
        .eq("id", registroId);
      if (error) throw error;
    } else {
      console.error("No se pudo guardar: registroId no disponible");
    }
  } catch (err) {
    console.error("Error al guardar respuestas:", err);
  }

  // Now check for partner
  pollForPartner(supabase);
}

// ————— POLL FOR PARTNER —————
async function pollForPartner(supabase) {
  const otherSujeto = sujeto === "A" ? "B" : "A";
  let attempts = 0;
  const maxAttempts = 120; // 2 minutes max

  const check = async () => {
    attempts++;
    try {
      const { data, error } = await supabase
        .from("participantes_valentine")
        .select("nombre, respuestas")
        .eq("codigo_par", codigo)
        .eq("sujeto", otherSujeto)
        .single();

      if (!error && data && data.respuestas && Object.keys(data.respuestas).length > 0) {
        // Partner is done!
        showCompatibilityResult(data.nombre, data.respuestas);
        return;
      }
    } catch (e) {
      // ignore, keep polling
    }

    if (attempts < maxAttempts) {
      setTimeout(check, 2000);
    } else {
      // Timeout - show result with just our info
      showCompatibilityResult(null, null);
    }
  };

  // Also subscribe to realtime updates for faster detection
  try {
    supabase
      .channel("partner-check-" + codigo)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "participantes_valentine" },
        (payload) => {
          const row = payload.new;
          if (row && row.codigo_par === codigo && row.sujeto === otherSujeto && row.respuestas && Object.keys(row.respuestas).length > 0) {
            showCompatibilityResult(row.nombre, row.respuestas);
          }
        }
      )
      .subscribe();
  } catch (e) {
    // Realtime not available, polling will handle it
  }

  check();
}

// ————— COMPATIBILITY CALCULATION —————
function calculateCompatibility(myAnswers, partnerAnswers) {
  // Light questions (peso 1)
  const lightFields = [
    { field: "prefer_dinero_amor", label: "Dinero vs Amor" },
    { field: "prefer_playa_montana", label: "Playa vs Montaña" },
    { field: "prefer_noche_dia", label: "Noche vs Día" },
    { field: "prefer_netflix_fiesta", label: "Netflix vs Fiesta" },
  ];

  // Deep questions (peso 2 — valen el doble)
  const deepFields = [
    { field: "prefer_perdonar_justicia", label: "Perdón vs Consecuencias" },
    { field: "prefer_hablar_espacio", label: "Hablarlo vs Dar espacio" },
    { field: "prefer_razon_corazon", label: "Razón vs Corazón" },
    { field: "prefer_planificar_improvisar", label: "Planificar vs Improvisar" },
    { field: "prefer_pocas_muchas", label: "Pocas amistades vs Muchas" },
    { field: "prefer_feliz_razon", label: "Ser feliz vs Tener razón" },
    { field: "prefer_presente_futuro", label: "Presente vs Futuro" },
    { field: "prefer_dar_recibir", label: "Dar vs Recibir cariño" },
  ];

  let totalPoints = 0;
  let maxPoints = 0;
  const matches = [];
  const diffs = [];

  // Light (1 pt each)
  lightFields.forEach(({ field, label }) => {
    maxPoints += 1;
    const my = myAnswers[field];
    const their = partnerAnswers[field];
    if (my && their) {
      if (my === their) {
        totalPoints += 1;
        matches.push({ icon: "✅", text: `Ambos prefieren ${my}` });
      } else {
        diffs.push({ icon: "💫", text: `${label}: Tú "${my}", tu pareja "${their}"` });
      }
    }
  });

  // Deep (2 pts each)
  deepFields.forEach(({ field, label }) => {
    maxPoints += 2;
    const my = myAnswers[field];
    const their = partnerAnswers[field];
    if (my && their) {
      if (my === their) {
        totalPoints += 2;
        matches.push({ icon: "💕", text: `Ambos: "${my}"` });
      } else {
        diffs.push({ icon: "✨", text: `${label}: Tú "${my}", tu pareja "${their}"` });
      }
    }
  });

  // Color favorito (1 pt)
  maxPoints += 1;
  if (myAnswers.color_favorito && partnerAnswers.color_favorito) {
    if (myAnswers.color_favorito === partnerAnswers.color_favorito) {
      totalPoints += 1;
      matches.push({ icon: "🎨", text: `¡Mismo color favorito: ${myAnswers.color_favorito}!` });
    } else {
      diffs.push({ icon: "🎨", text: `Color: Tú ${myAnswers.color_favorito}, tu pareja ${partnerAnswers.color_favorito}` });
    }
  }

  // Multi-select: valores_relacion (peso 2), musica_favorita (peso 1), algo_feliz (peso 1)
  const multiFields = [
    { field: "valores_relacion", weight: 2, label: "Valores en relación" },
    { field: "musica_favorita", weight: 1, label: "Música" },
    { field: "algo_feliz", weight: 1, label: "Felicidad" },
  ];

  multiFields.forEach(({ field, weight, label }) => {
    maxPoints += weight;
    const myList = Array.isArray(myAnswers[field]) ? myAnswers[field] : [];
    const theirList = Array.isArray(partnerAnswers[field]) ? partnerAnswers[field] : [];
    if (myList.length > 0 && theirList.length > 0) {
      const overlap = myList.filter((v) => theirList.includes(v));
      const maxLen = Math.max(myList.length, theirList.length);
      const score = maxLen > 0 ? (overlap.length / maxLen) * weight : 0;
      totalPoints += score;
      if (overlap.length > 0) {
        matches.push({ icon: weight > 1 ? "💞" : "🎵", text: `${label}: coinciden en ${overlap.join(", ")}` });
      }
    }
  });

  const rawPercent = maxPoints > 0 ? (totalPoints / maxPoints) * 100 : 50;
  const percentage = Math.min(99, Math.max(5, Math.round(rawPercent)));

  return { percentage, matches, diffs };
}

function getCompatibilityText(percentage) {
  if (percentage >= 90) {
    return {
      label: "¡ALMAS GEMELAS!",
      text: "Su conexión es excepcional. Comparten valores profundos, ven la vida de forma similar y hasta manejan los conflictos igual. El universo los puso en el mismo camino por algo."
    };
  } else if (percentage >= 75) {
    return {
      label: "¡GRAN CONEXIÓN!",
      text: "Piensan parecido en lo que realmente importa: cómo aman, cómo resuelven problemas y qué valoran. Esa base sólida de valores compartidos es oro en cualquier relación."
    };
  } else if (percentage >= 60) {
    return {
      label: "¡BUENA ONDA!",
      text: "Hay una conexión real entre ustedes. Coinciden en temas importantes y donde difieren, se complementan. Esas diferencias pueden enriquecer la relación si se dan la oportunidad."
    };
  } else if (percentage >= 45) {
    return {
      label: "¡INTERESANTE!",
      text: "Tienen un equilibrio curioso: coinciden en algunas cosas profundas pero ven el mundo de formas distintas. Eso puede generar una chispa increíble si hay apertura mutua."
    };
  } else if (percentage >= 30) {
    return {
      label: "¡POLOS OPUESTOS!",
      text: "Son bastante diferentes en cómo piensan y sienten, pero eso no es malo. Las mejores historias nacen cuando dos mundos distintos chocan y descubren que se necesitan."
    };
  } else {
    return {
      label: "¡EL RETO DEL AMOR!",
      text: "Son mundos muy distintos. Pero el verdadero amor no se trata de ser iguales, sino de elegirse a pesar de las diferencias. Si hay voluntad, pueden escribir una historia única."
    };
  }
}

// ————— SHOW RESULT —————
function showCompatibilityResult(partnerName, partnerRespuestas) {
  if (resultShown) return; // Prevent duplicate calls from polling + realtime
  resultShown = true;

  waitingScreen.style.display = "none";
  resultScreen.style.display = "flex";

  let percentage, matches, diffs, compatText;

  if (partnerRespuestas) {
    const myRespuestas = {};
    const fields = [
      "prefer_dinero_amor", "prefer_playa_montana", "prefer_noche_dia",
      "prefer_netflix_fiesta", "prefer_perros_gatos", "prefer_llamada_mensaje",
      "prefer_cafe_chocolate", "color_favorito", "musica_favorita", "algo_feliz"
    ];
    fields.forEach((f) => { if (answers[f] !== undefined) myRespuestas[f] = answers[f]; });

    const result = calculateCompatibility(myRespuestas, partnerRespuestas);
    percentage = result.percentage;
    matches = result.matches;
    diffs = result.diffs;
    compatText = getCompatibilityText(percentage);
  } else {
    // No partner yet — show a generic message
    percentage = 0;
    matches = [];
    diffs = [];
    compatText = {
      label: "¡Resultado Parcial!",
      text: "Tu pareja aún no ha terminado el quiz. Este es un estimado basado en tus respuestas. ¡Pídele que complete el suyo para ver el resultado real!"
    };
  }

  // Animate percentage
  const percentEl = document.getElementById("result-percentage");
  const circleFill = document.getElementById("result-circle-fill");
  const labelEl = document.getElementById("result-label");
  const justEl = document.getElementById("result-justification");
  const matchesEl = document.getElementById("result-matches");

  // Circle animation
  const circumference = 2 * Math.PI * 54; // r=54
  const offset = circumference - (percentage / 100) * circumference;
  setTimeout(() => {
    circleFill.style.strokeDashoffset = offset;
  }, 100);

  // Count-up animation
  let current = 0;
  const duration = 2000;
  const start = Date.now();
  const countUp = () => {
    const elapsed = Date.now() - start;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out
    const eased = 1 - Math.pow(1 - progress, 3);
    current = Math.round(eased * percentage);
    percentEl.textContent = current;
    if (progress < 1) {
      requestAnimationFrame(countUp);
    }
  };
  requestAnimationFrame(countUp);

  // Text
  labelEl.textContent = compatText.label;
  justEl.textContent = compatText.text;

  // Matches/diffs list
  let matchesHTML = "";
  if (matches.length > 0) {
    matchesHTML += `<p class="result-matches-title">💕 En lo que coinciden</p>`;
    matches.forEach((m) => {
      matchesHTML += `<div class="result-match-item match"><span class="result-match-icon">${m.icon}</span>${m.text}</div>`;
    });
  }
  if (diffs.length > 0) {
    matchesHTML += `<p class="result-matches-title" style="margin-top:16px;">✨ Sus diferencias</p>`;
    diffs.forEach((d) => {
      matchesHTML += `<div class="result-match-item diff"><span class="result-match-icon">${d.icon}</span>${d.text}</div>`;
    });
  }
  matchesEl.innerHTML = matchesHTML;
}

// ————— OFFLINE FALLBACK —————
function showResultOffline() {
  waitingScreen.style.display = "none";
  container.style.display = "none";
  resultScreen.style.display = "flex";

  const percentage = 0;
  const compatText = {
    label: "Sin conexión",
    text: "No se pudo calcular la compatibilidad. Conecta a internet y vuelve a intentarlo."
  };

  const percentEl = document.getElementById("result-percentage");
  const circleFill = document.getElementById("result-circle-fill");

  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (percentage / 100) * circumference;
  setTimeout(() => {
    circleFill.style.strokeDashoffset = offset;
  }, 100);

  let current = 0;
  const duration = 2000;
  const start = Date.now();
  const countUp = () => {
    const elapsed = Date.now() - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    current = Math.round(eased * percentage);
    percentEl.textContent = current;
    if (progress < 1) requestAnimationFrame(countUp);
  };
  requestAnimationFrame(countUp);

  document.getElementById("result-label").textContent = compatText.label;
  document.getElementById("result-justification").textContent = compatText.text + " (Modo offline — conecta a internet para el resultado real)";
}

// ————— START —————
init();
