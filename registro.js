const params = new URLSearchParams(window.location.search);
let sujeto = params.get("sujeto") || "";
let codigo = params.get("codigo") || "";

const TOTAL_STEPS = 20; // steps 0-19
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
    initPreFlowSteps();
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

  const progressWrap = document.querySelector(".quiz-progress-wrap");
  if (typeof step === "number") {
    currentStep = step;
    const progress = ((step + 1) / TOTAL_STEPS) * 100;
    progressBar.style.width = progress + "%";
    stepCounter.textContent = `${step + 1} / ${TOTAL_STEPS}`;
    if (progressWrap) progressWrap.style.display = "";
  } else {
    // Hide progress bar for pre-steps
    if (progressWrap) progressWrap.style.display = "none";
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

// ————— CODE GENERATION —————
function generarCodigoPar() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ————— PRE-FLOW STEPS (mobile-only) —————
function initPreFlowSteps() {
  const btnCrear = document.getElementById("btn-crear-pareja");
  const btnUnirse = document.getElementById("btn-unirse-pareja");
  const btnCodeReady = document.getElementById("btn-code-ready");
  const btnCopyCode = document.getElementById("btn-copy-code");
  const btnJoinSubmit = document.getElementById("btn-join-submit");

  // === "Crear pareja" ===
  if (btnCrear) {
    btnCrear.addEventListener("click", () => {
      codigo = generarCodigoPar();
      sujeto = "A";

      // Show code on screen
      const codeEl = document.getElementById("generated-code");
      if (codeEl) codeEl.textContent = codigo;

      showStep("pre-code");
    });
  }

  // === Copy code ===
  if (btnCopyCode) {
    btnCopyCode.addEventListener("click", () => {
      if (navigator.clipboard && codigo) {
        navigator.clipboard.writeText(codigo).then(() => {
          btnCopyCode.textContent = "✅";
          setTimeout(() => { btnCopyCode.textContent = "📋"; }, 1500);
        }).catch(() => {
          // Fallback: select text
          const codeEl = document.getElementById("generated-code");
          if (codeEl) {
            const range = document.createRange();
            range.selectNodeContents(codeEl);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
          }
        });
      }
    });
  }

  // === "Mi pareja ya lo tiene" === (sujeto A: comprobar que B se unió)
  if (btnCodeReady) {
    btnCodeReady.addEventListener("click", () => {
      if (sujeto !== "A") {
        updateTitle();
        showStep(0);
        return;
      }
      showStep("pre-confirm");
      checkPartnerJoined();
    });
  }

  // Pre-confirm: Empezar el quiz
  const btnConfirmStart = document.getElementById("btn-confirm-start");
  if (btnConfirmStart) {
    btnConfirmStart.addEventListener("click", () => {
      updateTitle();
      showStep(0);
    });
  }
  // Reintentar
  const btnConfirmRetry = document.getElementById("btn-confirm-retry");
  if (btnConfirmRetry) {
    btnConfirmRetry.addEventListener("click", () => {
      document.getElementById("pre-confirm-actions").style.display = "none";
      document.getElementById("pre-confirm-retry").style.display = "none";
      document.getElementById("pre-confirm-status").style.display = "";
      document.getElementById("pre-confirm-msg").textContent = "Comprobando...";
      document.getElementById("pre-confirm-spinner").style.display = "";
      checkPartnerJoined();
    });
  }
  // Empezar sin confirmar
  const btnConfirmSkip = document.getElementById("btn-confirm-skip");
  if (btnConfirmSkip) {
    btnConfirmSkip.addEventListener("click", () => {
      updateTitle();
      showStep(0);
    });
  }

  // === "Tengo un código" ===
  if (btnUnirse) {
    btnUnirse.addEventListener("click", () => {
      showStep("pre-join");
      const codeInput = document.getElementById("codigo_manual");
      if (codeInput) setTimeout(() => codeInput.focus(), 300);
    });
  }

  // === Submit join code === (B: insertar stub para que A pueda confirmar)
  if (btnJoinSubmit) {
    btnJoinSubmit.addEventListener("click", async () => {
      const codeInput = document.getElementById("codigo_manual");
      const code = codeInput?.value?.trim().toUpperCase() || "";
      const errPre = document.getElementById("registro-error-pre");

      if (!code || code.length < 4) {
        if (errPre) {
          errPre.textContent = "Ingresa el código que te compartió tu pareja";
          errPre.style.display = "block";
        }
        codeInput?.focus();
        return;
      }

      codigo = code;
      sujeto = "B";
      updateTitle();
      if (errPre) errPre.style.display = "none";

      await insertStubForJoiner();
      showStep(0);
    });
  }

  // Allow enter key on code input
  const codeInput = document.getElementById("codigo_manual");
  if (codeInput) {
    codeInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (btnJoinSubmit) btnJoinSubmit.click();
      }
    });
  }
}

// ————— STUB INSERT (B se une: aparece en la lista para que A confirme) —————
async function insertStubForJoiner() {
  if (sujeto !== "B" || !codigo) return;
  try {
    const mod = await import("./supabaseClient.js");
    const { data, error } = await mod.supabase
      .from("participantes_valentine")
      .insert({
        codigo_par: codigo,
        sujeto: "B",
        nombre: "Por confirmar",
      })
      .select("id")
      .single();
    if (!error && data?.id) registroId = data.id;
  } catch (err) {
    console.warn("Stub insert:", err);
  }
}

// ————— COMPROBAR QUE LA PAREJA SE UNIÓ (para A) —————
async function checkPartnerJoined() {
  const statusEl = document.getElementById("pre-confirm-status");
  const msgEl = document.getElementById("pre-confirm-msg");
  const spinnerEl = document.getElementById("pre-confirm-spinner");
  const actionsEl = document.getElementById("pre-confirm-actions");
  const retryEl = document.getElementById("pre-confirm-retry");

  let supabase;
  try {
    const mod = await import("./supabaseClient.js");
    supabase = mod.supabase;
  } catch (err) {
    if (msgEl) msgEl.textContent = "Sin conexión. Puedes empezar igual.";
    if (spinnerEl) spinnerEl.style.display = "none";
    if (retryEl) {
      retryEl.style.display = "block";
      retryEl.querySelector(".quiz-sub").textContent = "";
    }
    return;
  }

  const maxWait = 12000;
  const interval = 1500;
  const start = Date.now();

  const check = async () => {
    const { data, error } = await supabase
      .from("participantes_valentine")
      .select("id")
      .eq("codigo_par", codigo)
      .eq("sujeto", "B")
      .maybeSingle();

    if (!error && data) {
      if (statusEl) statusEl.style.display = "none";
      if (msgEl) msgEl.textContent = "";
      if (spinnerEl) spinnerEl.style.display = "none";
      if (actionsEl) {
        actionsEl.style.display = "block";
        const btn = document.getElementById("btn-confirm-start");
        if (btn) btn.textContent = "¡Tu pareja se unió! Empezar el quiz →";
      }
      if (retryEl) retryEl.style.display = "none";
      return true;
    }
    if (Date.now() - start >= maxWait) {
      if (spinnerEl) spinnerEl.style.display = "none";
      if (msgEl) msgEl.textContent = "Aún no vemos a tu pareja.";
      if (statusEl) statusEl.style.display = "";
      if (retryEl) retryEl.style.display = "block";
      if (actionsEl) actionsEl.style.display = "none";
      return false;
    }
    return false;
  };

  if (await check()) return;
  const t = setInterval(async () => {
    if (await check()) clearInterval(t);
  }, interval);
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
  let supabase;
  try {
    const mod = await import("./supabaseClient.js");
    supabase = mod.supabase;
  } catch (err) {
    console.warn("supabaseClient no disponible:", err);
    return;
  }

  try {
    if (registroId) {
      // B ya tiene fila (stub al unirse): actualizar con nombre, género, etc.
      await supabase
        .from("participantes_valentine")
        .update({
          nombre: answers.nombre || "Anónimo",
          genero: answers.genero || null,
          fecha_nacimiento: answers.fecha_nacimiento || null,
          signo_zodiacal: answers.signo_zodiacal || null,
        })
        .eq("id", registroId);
      return;
    }

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
    "carrera", "color_favorito", "valores_relacion", "musica_favorita", "algo_feliz"
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

// Mensajes humanos para cada coincidencia y diferencia
const QUESTION_INSIGHTS = {
  prefer_dinero_amor: {
    matchMsg: (v) => `Los dos valoran lo mismo: ${v === "Dinero" ? "la estabilidad económica" : "el amor por encima de todo"}. Eso dice mucho de sus prioridades.`,
    diffMsg: (my, their) => `Uno prioriza ${my === "Dinero" ? "la estabilidad material" : "los sentimientos"} y el otro ${their === "Dinero" ? "lo económico" : "el amor"}. Pueden equilibrarse si se entienden.`,
  },
  prefer_playa_montana: {
    matchMsg: (v) => `¡Ambos son de ${v === "Playa" ? "arena y sal" : "aire fresco y alturas"}! Ya saben a dónde ir de vacaciones juntos.`,
    diffMsg: (my, their) => `Uno sueña con ${my === "Playa" ? "la playa" : "la montaña"} y el otro con ${their === "Playa" ? "el mar" : "las alturas"}. Más destinos para explorar juntos.`,
  },
  prefer_noche_dia: {
    matchMsg: (v) => `Los dos son personas de ${v === "Noche" ? "noche, les gusta la magia de la oscuridad" : "día, aprovechan la luz al máximo"}.`,
    diffMsg: (my, their) => `Uno es ${my === "Noche" ? "noctámbulo" : "madrugador"} y el otro ${their === "Noche" ? "de noche" : "de día"}. Se van a cubrir las 24 horas.`,
  },
  prefer_netflix_fiesta: {
    matchMsg: (v) => `Ambos prefieren ${v === "Netflix en casa" ? "una noche tranquila en casa" : "salir y vivir la fiesta"}. No habrá discusión los viernes.`,
    diffMsg: (my, their) => `Uno prefiere ${my === "Netflix en casa" ? "quedarse en casa" : "salir de fiesta"} y el otro ${their === "Netflix en casa" ? "la tranquilidad del sofá" : "la rumba"}. Tendrán que negociar los fines de semana.`,
  },
  prefer_perdonar_justicia: {
    matchMsg: (v) => `Coinciden en cómo manejan los errores: ${v === "Perdonar" ? "ambos perdonan con facilidad, lo cual es hermoso" : "ambos creen en las consecuencias, valoran la responsabilidad"}.`,
    diffMsg: (my, their) => `Uno ${my === "Perdonar" ? "perdona fácilmente" : "cree en que se asuman las consecuencias"} y el otro ${their === "Perdonar" ? "prefiere perdonar" : "es más firme"}. Esa diferencia puede generar aprendizaje mutuo si hay comunicación.`,
  },
  prefer_hablar_espacio: {
    matchMsg: (v) => `Los dos prefieren ${v === "Hablarlo ya" ? "enfrentar los problemas hablando de frente" : "tomarse un respiro antes de hablar"}. Eso evita muchos malentendidos.`,
    diffMsg: (my, their) => `Cuando hay conflicto, uno ${my === "Hablarlo ya" ? "necesita hablarlo ya" : "necesita espacio"} y el otro ${their === "Hablarlo ya" ? "quiere resolverlo al instante" : "prefiere enfriarse primero"}. Respetar el ritmo del otro es clave aquí.`,
  },
  prefer_razon_corazon: {
    matchMsg: (v) => `Ambos se guían por ${v === "La razón" ? "la lógica y la cabeza fría" : "lo que sienten, por el corazón"}. Toman decisiones de la misma forma.`,
    diffMsg: (my, their) => `Uno se deja llevar por ${my === "La razón" ? "la razón" : "el corazón"} y el otro por ${their === "La razón" ? "la lógica" : "los sentimientos"}. Juntos pueden tomar decisiones más completas.`,
  },
  prefer_planificar_improvisar: {
    matchMsg: (v) => `¡Los dos son de ${v === "Planificar" ? "planificar todo al detalle, el orden los une" : "improvisar y dejarse llevar, la espontaneidad es su fuerte"}!`,
    diffMsg: (my, their) => `Uno ${my === "Planificar" ? "planifica cada paso" : "fluye con lo que venga"} y el otro ${their === "Planificar" ? "necesita estructura" : "improvisa sobre la marcha"}. El balance entre ambos puede ser perfecto.`,
  },
  prefer_pocas_muchas: {
    matchMsg: (v) => `Coinciden: ${v === "Pocas profundas" ? "prefieren pocas amistades pero genuinas y profundas" : "les gusta rodearse de mucha gente y socializar"}.`,
    diffMsg: (my, their) => `Uno ${my === "Pocas profundas" ? "prefiere un círculo pequeño y profundo" : "disfruta estar rodeado de gente"} y el otro ${their === "Pocas profundas" ? "es más selectivo con sus amistades" : "es más sociable"}. Pueden ampliar la perspectiva del otro.`,
  },
  prefer_feliz_razon: {
    matchMsg: (v) => `Los dos eligen ${v === "Ser feliz" ? "ser felices antes que tener razón, eso habla de madurez emocional" : "defender lo que creen, valoran sus principios"}.`,
    diffMsg: (my, their) => `Uno ${my === "Ser feliz" ? "prefiere soltar y ser feliz" : "defiende su posición"} y el otro ${their === "Ser feliz" ? "elige la paz" : "lucha por tener razón"}. Esa tensión puede enseñarles a encontrar el punto medio.`,
  },
  prefer_presente_futuro: {
    matchMsg: (v) => `Ambos ${v === "Vivir el momento" ? "viven el presente y disfrutan el ahora" : "construyen pensando en el mañana"}. Comparten la misma visión del tiempo.`,
    diffMsg: (my, their) => `Uno ${my === "Vivir el momento" ? "vive el momento" : "planifica el futuro"} y el otro ${their === "Vivir el momento" ? "disfruta el presente" : "piensa a largo plazo"}. Uno le enseña al otro a disfrutar hoy y a soñar con el mañana.`,
  },
  prefer_dar_recibir: {
    matchMsg: (v) => `Los dos prefieren ${v === "Dar cariño" ? "dar cariño, son personas generosas con su amor" : "recibir cariño, necesitan sentirse amados"}. Se entienden en lo afectivo.`,
    diffMsg: (my, their) => `Uno ${my === "Dar cariño" ? "ama dando" : "ama recibiendo"} y el otro ${their === "Dar cariño" ? "prefiere dar" : "necesita recibir"}. ${my !== their ? "¡Eso es perfecto! Uno da lo que el otro necesita." : ""}`,
  },
};

function calculateCompatibility(myAnswers, partnerAnswers) {
  // Light questions (peso 1)
  const lightFields = [
    "prefer_dinero_amor", "prefer_playa_montana", "prefer_noche_dia",
    "prefer_netflix_fiesta",
  ];

  // Deep questions (peso 2 — valen el doble)
  const deepFields = [
    "prefer_perdonar_justicia", "prefer_hablar_espacio", "prefer_razon_corazon",
    "prefer_planificar_improvisar", "prefer_pocas_muchas", "prefer_feliz_razon",
    "prefer_presente_futuro", "prefer_dar_recibir",
  ];

  let totalPoints = 0;
  let maxPoints = 0;
  const matches = [];
  const diffs = [];

  // Helper to process binary fields
  function processBinary(field, weight) {
    maxPoints += weight;
    const my = myAnswers[field];
    const their = partnerAnswers[field];
    const insight = QUESTION_INSIGHTS[field];
    if (my && their && insight) {
      if (my === their) {
        totalPoints += weight;
        matches.push({ icon: weight > 1 ? "💕" : "✅", text: insight.matchMsg(my) });
      } else {
        diffs.push({ icon: weight > 1 ? "✨" : "💫", text: insight.diffMsg(my, their) });
      }
    }
  }

  // Light (1 pt each)
  lightFields.forEach((f) => processBinary(f, 1));

  // Deep (2 pts each)
  deepFields.forEach((f) => processBinary(f, 2));

  // Carrera (1 pt)
  maxPoints += 1;
  if (myAnswers.carrera && partnerAnswers.carrera) {
    if (myAnswers.carrera === partnerAnswers.carrera) {
      totalPoints += 1;
      matches.push({ icon: "📚", text: `¡Los dos en ${myAnswers.carrera}! Comparten el mismo camino académico.` });
    } else {
      diffs.push({ icon: "📚", text: `Tú ${myAnswers.carrera}, tu pareja ${partnerAnswers.carrera}. Diferentes áreas que se complementan.` });
    }
  }

  // Color favorito (1 pt)
  maxPoints += 1;
  if (myAnswers.color_favorito && partnerAnswers.color_favorito) {
    if (myAnswers.color_favorito === partnerAnswers.color_favorito) {
      totalPoints += 1;
      matches.push({ icon: "🎨", text: `¡Los dos aman el ${myAnswers.color_favorito}! Hasta en los colores conectan.` });
    } else {
      diffs.push({ icon: "🎨", text: `Tú vibras con el ${myAnswers.color_favorito} y tu pareja con el ${partnerAnswers.color_favorito}. Juntos hacen una paleta única.` });
    }
  }

  // Multi-select: valores_relacion (peso 2), musica_favorita (peso 1), algo_feliz (peso 1)
  const multiFields = [
    { field: "valores_relacion", weight: 2, matchLabel: "Valoran lo mismo en una relación", diffLabel: "Valores en la relación" },
    { field: "musica_favorita", weight: 1, matchLabel: "Comparten gusto musical", diffLabel: "Gustos musicales" },
    { field: "algo_feliz", weight: 1, matchLabel: "Los hace felices lo mismo", diffLabel: "Fuentes de felicidad" },
  ];

  multiFields.forEach(({ field, weight, matchLabel, diffLabel }) => {
    maxPoints += weight;
    const myList = Array.isArray(myAnswers[field]) ? myAnswers[field] : [];
    const theirList = Array.isArray(partnerAnswers[field]) ? partnerAnswers[field] : [];
    if (myList.length > 0 && theirList.length > 0) {
      const overlap = myList.filter((v) => theirList.includes(v));
      const onlyMine = myList.filter((v) => !theirList.includes(v));
      const onlyTheirs = theirList.filter((v) => !myList.includes(v));
      const maxLen = Math.max(myList.length, theirList.length);
      const score = maxLen > 0 ? (overlap.length / maxLen) * weight : 0;
      totalPoints += score;
      if (overlap.length > 0) {
        matches.push({ icon: weight > 1 ? "💞" : "🎵", text: `${matchLabel}: ${overlap.join(", ")}` });
      }
      if (onlyMine.length > 0 && onlyTheirs.length > 0) {
        diffs.push({ icon: "🌈", text: `${diffLabel}: Tú elegiste ${onlyMine.join(", ")} y tu pareja ${onlyTheirs.join(", ")}. Se pueden descubrir cosas nuevas.` });
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
      "prefer_netflix_fiesta",
      "prefer_perdonar_justicia", "prefer_hablar_espacio", "prefer_razon_corazon",
      "prefer_planificar_improvisar", "prefer_pocas_muchas", "prefer_feliz_razon",
      "prefer_presente_futuro", "prefer_dar_recibir",
      "carrera", "color_favorito", "valores_relacion", "musica_favorita", "algo_feliz"
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
      matchesHTML += `<div class="result-match-item match"><span class="result-item-icon">${m.icon}</span><span class="result-item-text">${m.text}</span></div>`;
    });
  }
  if (diffs.length > 0) {
    matchesHTML += `<p class="result-matches-title" style="margin-top:20px;">✨ Sus diferencias</p>`;
    diffs.forEach((d) => {
      matchesHTML += `<div class="result-match-item diff"><span class="result-item-icon">${d.icon}</span><span class="result-item-text">${d.text}</span></div>`;
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
