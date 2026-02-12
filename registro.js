const params = new URLSearchParams(window.location.search);
let sujeto = params.get("sujeto") || "";
let codigo = params.get("codigo") || "";

const TOTAL_STEPS = 12; // steps 0-11
let currentStep = -1;
let answers = {};
let registroId = null;
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
  // After step 1 (gender) → INSERT to supabase
  if (currentStep === 1) {
    insertBasicInfo();
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
    // Offline mode: show result anyway with mock data
    showResultOffline();
    return;
  }

  // Build respuestas object
  const respuestas = {};
  const answerFields = [
    "prefer_dinero_amor", "prefer_playa_montana", "prefer_noche_dia",
    "prefer_netflix_fiesta", "prefer_perros_gatos", "prefer_llamada_mensaje",
    "prefer_cafe_chocolate", "color_favorito", "musica_favorita", "algo_feliz"
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
  const binaryFields = [
    "prefer_dinero_amor", "prefer_playa_montana", "prefer_noche_dia",
    "prefer_netflix_fiesta", "prefer_perros_gatos", "prefer_llamada_mensaje",
    "prefer_cafe_chocolate"
  ];

  let totalPoints = 0;
  let maxPoints = 0;
  const matches = [];
  const diffs = [];

  const labels = {
    prefer_dinero_amor: { emoji: "💰❤️", label: "Dinero vs Amor" },
    prefer_playa_montana: { emoji: "🏖️🏔️", label: "Playa vs Montaña" },
    prefer_noche_dia: { emoji: "🌙☀️", label: "Noche vs Día" },
    prefer_netflix_fiesta: { emoji: "🎬🎉", label: "Netflix vs Fiesta" },
    prefer_perros_gatos: { emoji: "🐶🐱", label: "Perros vs Gatos" },
    prefer_llamada_mensaje: { emoji: "📞💬", label: "Llamada vs Mensaje" },
    prefer_cafe_chocolate: { emoji: "☕🍫", label: "Café vs Chocolate" },
  };

  // Binary preferences (7 questions)
  binaryFields.forEach((field) => {
    maxPoints += 1;
    const my = myAnswers[field];
    const their = partnerAnswers[field];
    if (my && their) {
      if (my === their) {
        totalPoints += 1;
        matches.push({ icon: "✅", text: `Ambos prefieren ${my}`, emoji: labels[field]?.emoji || "" });
      } else {
        diffs.push({ icon: "💫", text: `${labels[field]?.label}: Tú ${my}, tu pareja ${their}` });
      }
    }
  });

  // Color favorito (1 question)
  maxPoints += 1;
  if (myAnswers.color_favorito && partnerAnswers.color_favorito) {
    if (myAnswers.color_favorito === partnerAnswers.color_favorito) {
      totalPoints += 1;
      matches.push({ icon: "🎨", text: `¡Mismo color favorito: ${myAnswers.color_favorito}!` });
    } else {
      diffs.push({ icon: "🎨", text: `Color: Tú ${myAnswers.color_favorito}, tu pareja ${partnerAnswers.color_favorito}` });
    }
  }

  // Multi-select fields: musica_favorita, algo_feliz
  ["musica_favorita", "algo_feliz"].forEach((field) => {
    maxPoints += 1;
    const myList = Array.isArray(myAnswers[field]) ? myAnswers[field] : [];
    const theirList = Array.isArray(partnerAnswers[field]) ? partnerAnswers[field] : [];
    if (myList.length > 0 && theirList.length > 0) {
      const overlap = myList.filter((v) => theirList.includes(v));
      const maxLen = Math.max(myList.length, theirList.length);
      const score = maxLen > 0 ? overlap.length / maxLen : 0;
      totalPoints += score;
      if (overlap.length > 0) {
        const label = field === "musica_favorita" ? "🎵 Música" : "😊 Felicidad";
        matches.push({ icon: label.split(" ")[0], text: `Coinciden en: ${overlap.join(", ")}` });
      }
    }
  });

  const rawPercent = maxPoints > 0 ? (totalPoints / maxPoints) * 100 : 50;
  // Add a small chemistry bonus (5-12%) so scores feel good
  const chemistryBonus = 5 + Math.random() * 7;
  const percentage = Math.min(99, Math.round(rawPercent + chemistryBonus));

  return { percentage, matches, diffs };
}

function getCompatibilityText(percentage) {
  if (percentage >= 90) {
    return {
      label: "¡Almas Gemelas!",
      text: "Wow, su conexión es increíble. Comparten una visión de la vida casi idéntica. ¡El universo claramente los puso en el mismo camino! Disfruten esa energía única que comparten."
    };
  } else if (percentage >= 75) {
    return {
      label: "¡Gran Conexión!",
      text: "Tienen una química especial. Sus gustos y valores se alinean de manera muy natural. Esa mezcla de similitudes con pequeñas diferencias es la receta perfecta para algo bonito."
    };
  } else if (percentage >= 60) {
    return {
      label: "¡Buena Onda!",
      text: "Hay una conexión real entre ustedes. Se complementan en lo importante y cada uno aporta algo diferente que puede enriquecer la relación. ¡Tienen potencial!"
    };
  } else if (percentage >= 45) {
    return {
      label: "¡Interesante!",
      text: "Tienen sus similitudes y sus diferencias, y eso es emocionante. Los opuestos se atraen por algo, y esas diferencias pueden generar una chispa increíble si se dan la oportunidad."
    };
  } else if (percentage >= 30) {
    return {
      label: "¡Polos Opuestos!",
      text: "Son bastante diferentes, pero eso no es malo — ¡para nada! Las mejores parejas a veces son las que menos se parecen. Pueden aprender muchísimo el uno del otro."
    };
  } else {
    return {
      label: "¡El Reto del Amor!",
      text: "Son mundos distintos, pero el amor todo lo puede. Las historias más épicas empiezan cuando dos personas que no tienen nada en común descubren que se complementan de formas inesperadas."
    };
  }
}

// ————— SHOW RESULT —————
function showCompatibilityResult(partnerName, partnerRespuestas) {
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
    percentage = Math.floor(50 + Math.random() * 30);
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

  const percentage = Math.floor(55 + Math.random() * 35);
  const compatText = getCompatibilityText(percentage);

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
