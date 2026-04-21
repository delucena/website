const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

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

function validatePayload(payload) {
  if (payload.website) return null;
  if (payload.name.length < 3) return "Informe seu nome completo.";
  if (!EMAIL_RE.test(payload.email)) return "Informe um e-mail válido.";
  if (payload.phone.length < 8) return "Informe um telefone válido.";
  if (payload.organization.length < 3) return "Informe a instituição.";
  if (!payload.interest) return "Informe o interesse principal.";
  if (payload.message.length < 15) return "Mensagem muito curta.";
  if (!payload.consent) return "Consentimento obrigatório.";
  return null;
}

async function sendEmailWithResend(env, payload) {
  const apiKey = (env.RESEND_API_KEY || "").trim();
  const toEmail = normalizeWhitespace(env.CONTACT_TO_EMAIL || "josepaulo@delucena.dev", 160).toLowerCase();
  const fromEmail = normalizeWhitespace(env.CONTACT_FROM_EMAIL || "contato@lucenasolucoes.com", 160).toLowerCase();
  const subjectPrefix = normalizeWhitespace(env.CONTACT_SUBJECT_PREFIX || "[Site Lucena]", 80);

  if (!apiKey) {
    return {
      ok: false,
      status: 503,
      message:
        "Formulário temporariamente indisponível. Configuração de e-mail pendente no servidor.",
    };
  }

  if (!EMAIL_RE.test(toEmail) || !EMAIL_RE.test(fromEmail)) {
    return {
      ok: false,
      status: 503,
      message: "Formulário temporariamente indisponível. Destino de e-mail inválido.",
    };
  }

  const subject = `${subjectPrefix} Novo contato - ${payload.name}`;
  const text = [
    "Novo contato recebido pelo formulário do site.",
    "",
    `Nome: ${payload.name}`,
    `E-mail: ${payload.email}`,
    `Telefone: ${payload.phone}`,
    `Instituição: ${payload.organization}`,
    `Interesse: ${payload.interest}`,
    `Consentimento: ${payload.consent ? "sim" : "nao"}`,
    `Formulário: ${payload.formName}`,
    `Página: ${payload.pagePath}`,
    `Título: ${payload.pageTitle}`,
    "",
    "Mensagem:",
    payload.message,
  ].join("\n");

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [toEmail],
      reply_to: payload.email,
      subject,
      text,
    }),
  });

  if (!resendResponse.ok) {
    const resendBody = await resendResponse.text();
    console.error("[contact-form] resend error", resendResponse.status, resendBody);

    return {
      ok: false,
      status: 502,
      message: "Não foi possível enviar agora. Tente novamente em instantes.",
    };
  }

  return { ok: true };
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, message: "Payload inválido." }, 400);
  }

  const payload = {
    name: normalizeWhitespace(body?.name, 120),
    email: normalizeWhitespace(body?.email, 160).toLowerCase(),
    phone: normalizeWhitespace(body?.phone, 32),
    organization: normalizeWhitespace(body?.organization, 160),
    interest: normalizeWhitespace(body?.interest, 80),
    message: normalizeMessage(body?.message, 2000),
    consent: body?.consent === true,
    website: normalizeWhitespace(body?.website, 200),
    formName: normalizeWhitespace(body?.formName, 80),
    pagePath: normalizeWhitespace(body?.pagePath, 160),
    pageTitle: normalizeWhitespace(body?.pageTitle, 180),
  };

  const validationError = validatePayload(payload);
  if (validationError) {
    return jsonResponse({ ok: false, message: validationError }, 400);
  }

  if (payload.website) {
    return jsonResponse({ ok: true, message: "Solicitação recebida." }, 200);
  }

  const sendResult = await sendEmailWithResend(env, payload);
  if (!sendResult.ok) {
    return jsonResponse({ ok: false, message: sendResult.message }, sendResult.status);
  }

  return jsonResponse({ ok: true, message: "Solicitação enviada com sucesso." }, 200);
}

export async function onRequest(context) {
  if (context.request.method === "POST") {
    return onRequestPost(context);
  }

  return jsonResponse({ ok: false, message: "Método não permitido." }, 405);
}
