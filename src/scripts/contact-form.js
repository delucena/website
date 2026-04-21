const CONTACT_ENDPOINT = (import.meta.env.VITE_CONTACT_ENDPOINT || "/api/contact").trim() || "/api/contact";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

function normalizeWhitespace(value, maxLength = 160) {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function normalizeMessage(value, maxLength = 2000) {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .replace(/\r\n/g, "\n")
    .slice(0, maxLength);
}

function sanitizeAnalyticsValue(value) {
  if (typeof value === "string") return value.slice(0, 100);
  if (typeof value === "number" || typeof value === "boolean") return value;
  return undefined;
}

function trackEvent(eventName, params = {}) {
  if (typeof window.gtag !== "function") return;

  const sanitizedParams = Object.entries(params).reduce((accumulator, [key, value]) => {
    const sanitized = sanitizeAnalyticsValue(value);
    if (sanitized !== undefined && sanitized !== "") accumulator[key] = sanitized;
    return accumulator;
  }, {});

  window.gtag("event", eventName, sanitizedParams);
}

function setSubmitting(form, isSubmitting) {
  const submitButton = form.querySelector("button[type='submit']");
  if (!submitButton) return;

  if (!submitButton.dataset.defaultLabel) {
    submitButton.dataset.defaultLabel = submitButton.textContent.trim() || "Enviar solicitação";
  }

  submitButton.disabled = isSubmitting;
  submitButton.textContent = isSubmitting ? "Enviando..." : submitButton.dataset.defaultLabel;
}

function setFeedback(form, type, message) {
  const feedback = form.querySelector("[data-contact-feedback]");
  if (!feedback) return;

  feedback.classList.remove("is-error", "is-success");
  if (type === "error") feedback.classList.add("is-error");
  if (type === "success") feedback.classList.add("is-success");
  feedback.textContent = message;
}

function buildPayload(form) {
  const formData = new FormData(form);

  return {
    name: normalizeWhitespace(formData.get("name"), 120),
    email: normalizeWhitespace(formData.get("email"), 160).toLowerCase(),
    phone: normalizeWhitespace(formData.get("phone"), 32),
    organization: normalizeWhitespace(formData.get("organization"), 160),
    interest: normalizeWhitespace(formData.get("interest"), 80),
    message: normalizeMessage(formData.get("message"), 2000),
    consent: formData.get("consent") === "on",
    website: normalizeWhitespace(formData.get("website"), 200),
    formName: normalizeWhitespace(form.dataset.formName || "contato_site", 80),
    pagePath: normalizeWhitespace(window.location.pathname || "/", 160),
    pageTitle: normalizeWhitespace(document.title || "", 180),
  };
}

function validatePayload(payload) {
  if (payload.website) return null;
  if (payload.name.length < 3) return "Informe seu nome completo.";
  if (!EMAIL_RE.test(payload.email)) return "Informe um e-mail válido para retorno.";
  if (payload.phone.length < 8) return "Informe um telefone/WhatsApp válido.";
  if (payload.organization.length < 3) return "Informe o órgão, empresa ou instituição.";
  if (!payload.interest) return "Selecione o interesse principal.";
  if (payload.message.length < 15) return "Descreva um pouco mais sua necessidade para agendamento.";
  if (!payload.consent) return "Você precisa autorizar o retorno de contato.";
  return null;
}

async function submitContactForm(form) {
  if (form.dataset.submitting === "1") return;

  const payload = buildPayload(form);
  const validationError = validatePayload(payload);

  if (validationError) {
    setFeedback(form, "error", validationError);
    trackEvent("contact_form_error", {
      error_type: "validation",
      form_name: payload.formName,
      page_path: payload.pagePath,
    });
    return;
  }

  if (payload.website) {
    form.reset();
    setFeedback(form, "success", "Solicitação enviada com sucesso. Em breve retornaremos o contato.");
    return;
  }

  form.dataset.submitting = "1";
  setSubmitting(form, true);
  setFeedback(form, "", "");

  trackEvent("contact_form_submit_attempt", {
    form_name: payload.formName,
    interest: payload.interest,
    page_path: payload.pagePath,
  });

  try {
    const response = await fetch(CONTACT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.message || "Nao foi possivel enviar agora.");
    }

    form.reset();
    setFeedback(form, "success", "Solicitação enviada com sucesso. Em breve retornaremos o contato.");

    trackEvent("contact_form_submit_success", {
      form_name: payload.formName,
      interest: payload.interest,
      page_path: payload.pagePath,
    });
  } catch (error) {
    setFeedback(
      form,
      "error",
      "Nao foi possivel enviar agora. Tente novamente em instantes ou ligue para +55 (83) 98838-3198."
    );

    trackEvent("contact_form_error", {
      error_type: "request",
      form_name: payload.formName,
      page_path: payload.pagePath,
    });

    console.error("[contact-form]", error);
  } finally {
    delete form.dataset.submitting;
    setSubmitting(form, false);
  }
}

function bindContactForms() {
  const forms = document.querySelectorAll("[data-contact-form]");
  if (!forms.length) return;

  forms.forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      submitContactForm(form);
    });
  });
}

bindContactForms();
