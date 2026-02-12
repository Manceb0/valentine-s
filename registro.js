const params = new URLSearchParams(window.location.search);
let sujeto = params.get("sujeto") || "";
let codigo = params.get("codigo") || "";

if (codigo && sujeto) {
  const corazonLabel = sujeto === "A" ? "Corazón 1" : "Corazón 2";
  document.title = `Registro - ${corazonLabel}`;
  const titleEl = document.querySelector(".registro-title");
  if (titleEl) titleEl.textContent = `Regístrate como ${corazonLabel}`;
} else {
  const grupoCodigo = document.getElementById("grupo-codigo");
  const grupoSujeto = document.getElementById("grupo-sujeto-manual");
  if (grupoCodigo) grupoCodigo.style.display = "block";
  if (grupoSujeto) grupoSujeto.style.display = "block";
}

let registroId = null;
const paso1 = document.getElementById("paso-1");
const paso2 = document.getElementById("paso-2");
const container = document.getElementById("registro-form-container");
const successEl = document.getElementById("registro-success");
const errorEl = document.getElementById("registro-error");
const errorEl2 = document.getElementById("registro-error-2");
const btnConfirmar = document.getElementById("btn-confirmar");
const btnEnviar = document.getElementById("btn-enviar");

function getCodigoYSujeto() {
  let c = codigo;
  let s = sujeto;
  if (!c) c = (document.getElementById("codigo_manual") || {}).value?.trim().toUpperCase() || "";
  if (!s) s = (document.getElementById("sujeto_manual") || {}).value || "A";
  return { codigo: c, sujeto: s };
}

// Paso 1: solo nombre -> INSERT
const formPaso1 = document.getElementById("form-paso-1");
if (formPaso1) {
  formPaso1.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.style.display = "none";
    errorEl.textContent = "";
    btnConfirmar.disabled = true;
    btnConfirmar.textContent = "Enviando...";

    const { codigo: c, sujeto: s } = getCodigoYSujeto();
    const nombre = document.getElementById("nombre").value.trim();
    const genero = document.getElementById("genero_paso1")?.value?.trim() || null;

    if (!c) {
      errorEl.textContent = "Ingresa el código de pareja que aparece en la pantalla.";
      errorEl.style.display = "block";
      btnConfirmar.disabled = false;
      btnConfirmar.textContent = "Confirmar";
      return;
    }

    let supabase;
    try {
      const mod = await import("./supabaseClient.js");
      supabase = mod.supabase;
    } catch (err) {
      errorEl.textContent = "No se pudo conectar. Verifica que supabaseClient.js esté desplegado.";
      errorEl.style.display = "block";
      btnConfirmar.disabled = false;
      btnConfirmar.textContent = "Confirmar";
      return;
    }

    try {
      const { data, error } = await supabase
        .from("participantes_valentine")
        .insert({
          codigo_par: c,
          sujeto: s,
          nombre,
          genero,
          fecha_nacimiento: null,
          carrera: null,
          signo_zodiacal: null,
        })
        .select("id")
        .single();

      if (error) throw error;
      registroId = data?.id;
      codigo = c;
      sujeto = s;
      paso1.style.display = "none";
      paso2.style.display = "block";
    } catch (err) {
      errorEl.textContent = err.message || "Error al registrar. Intenta de nuevo.";
      errorEl.style.display = "block";
      btnConfirmar.disabled = false;
      btnConfirmar.textContent = "Confirmar";
    }
  });
}

// Paso 2: resto -> UPDATE
const formPaso2 = document.getElementById("form-paso-2");
if (formPaso2) {
  formPaso2.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl2.style.display = "none";
    errorEl2.textContent = "";
    btnEnviar.disabled = true;
    btnEnviar.textContent = "Enviando...";

    if (!registroId) {
      errorEl2.textContent = "Sesión inválida. Vuelve a escanear el QR.";
      errorEl2.style.display = "block";
      btnEnviar.disabled = false;
      btnEnviar.textContent = "Enviar";
      return;
    }

    const fecha_nacimiento = document.getElementById("fecha_nacimiento").value || null;
    const carrera = document.getElementById("carrera").value || null;
    const signo_zodiacal = document.getElementById("signo_zodiacal").value || null;
    const respuestas = {
      color_favorito: document.getElementById("color_favorito")?.value?.trim() || null,
      tiempo_libre: document.getElementById("tiempo_libre")?.value?.trim() || null,
      musica_favorita: document.getElementById("musica_favorita")?.value?.trim() || null,
      lugar_visitar: document.getElementById("lugar_visitar")?.value?.trim() || null,
      algo_feliz: document.getElementById("algo_feliz")?.value?.trim() || null,
    };

    let supabase;
    try {
      const mod = await import("./supabaseClient.js");
      supabase = mod.supabase;
    } catch (err) {
      errorEl2.textContent = "No se pudo conectar.";
      errorEl2.style.display = "block";
      btnEnviar.disabled = false;
      btnEnviar.textContent = "Enviar";
      return;
    }

    try {
      const { error } = await supabase
        .from("participantes_valentine")
        .update({
          fecha_nacimiento: fecha_nacimiento || null,
          carrera,
          signo_zodiacal,
          respuestas,
        })
        .eq("id", registroId);

      if (error) throw error;
      container.style.display = "none";
      successEl.style.display = "flex";
    } catch (err) {
      errorEl2.textContent = err.message || "Error al guardar. Intenta de nuevo.";
      errorEl2.style.display = "block";
      btnEnviar.disabled = false;
      btnEnviar.textContent = "Enviar";
    }
  });
}
