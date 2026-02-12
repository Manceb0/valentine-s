import { supabase } from "./supabaseClient.js";

const params = new URLSearchParams(window.location.search);
const sujeto = params.get("sujeto") || "A";
const codigo = params.get("codigo") || "";

if (codigo) {
  document.title = `Registro - Sujeto ${sujeto}`;
  const titleEl = document.querySelector(".registro-title");
  if (titleEl) titleEl.textContent = `Regístrate como Sujeto ${sujeto}`;
} else {
  const sinCodigoEl = document.getElementById("registro-sin-codigo");
  if (sinCodigoEl) sinCodigoEl.style.display = "block";
}

const form = document.getElementById("form-registro");
const container = document.getElementById("registro-form-container");
const successEl = document.getElementById("registro-success");
const errorEl = document.getElementById("registro-error");
const btnEnviar = document.getElementById("btn-enviar");

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.style.display = "none";
    errorEl.textContent = "";
    btnEnviar.disabled = true;
    btnEnviar.textContent = "Enviando...";

    const nombre = document.getElementById("nombre").value.trim();
    const fecha_nacimiento = document.getElementById("fecha_nacimiento").value;
    const carrera = document.getElementById("carrera").value;
    const genero = document.getElementById("genero").value;
    const signo_zodiacal = (document.getElementById("signo_zodiacal") || {}).value || null;

    if (!codigo) {
      errorEl.textContent = "Falta el código de pareja. Escanea el QR de la pantalla.";
      errorEl.style.display = "block";
      btnEnviar.disabled = false;
      btnEnviar.textContent = "Enviar";
      return;
    }

    try {
      const { error } = await supabase.from("participantes_valentine").insert({
        codigo_par: codigo,
        sujeto,
        nombre,
        fecha_nacimiento,
        carrera,
        genero,
        signo_zodiacal,
      });

      if (error) throw error;
      container.style.display = "none";
      successEl.style.display = "flex";
    } catch (err) {
      errorEl.textContent = err.message || "Error al registrar. Intenta de nuevo.";
      errorEl.style.display = "block";
      btnEnviar.disabled = false;
      btnEnviar.textContent = "Enviar";
    }
  });
}
