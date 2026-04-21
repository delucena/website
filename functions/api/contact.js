const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const CONTACT_FN_VERSION = "2026-04-21.03";

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

function getRuntimeConfig(env) {
  const apiKey = (env.RESEND_API_KEY || "").trim();
  const toEmail = normalizeWhitespace(env.CONTACT_TO_EMAIL || "josepaulo@delucena.dev", 160).toLowerCase();
  const fromEmail = normalizeWhitespace(env.CONTACT_FROM_EMAIL || "contato@lucenasolucoes.com", 160).toLowerCase();
  const subjectPrefix = normalizeWhitespace(env.CONTACT_SUBJECT_PREFIX || "[Site Lucena]", 80);

  return {
    apiKey,
    toEmail,
    fromEmail,
    subjectPrefix,
  };
}

function getConfigDiagnostics(config) {
  return {
    contact_fn_version: CONTACT_FN_VERSION,
    has_resend_api_key: Boolean(config.apiKey),
    resend_api_key_prefix: config.apiKey ? config.apiKey.slice(0, 3) : "",
    resend_api_key_length: config.apiKey.length,
    has_contact_to_email: Boolean(config.toEmail),
    has_contact_from_email: Boolean(config.fromEmail),
    contact_to_email_valid: EMAIL_RE.test(config.toEmail),
    contact_from_email_valid: EMAIL_RE.test(config.fromEmail),
    subject_prefix: config.subjectPrefix || "[vazio]",
  };
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
  const config = getRuntimeConfig(env);
  const diagnostics = getConfigDiagnostics(config);

  console.info("[contact-form] runtime diagnostics", diagnostics);

  if (!config.apiKey) {
    return {
      ok: false,
      status: 503,
      message: "RESEND_API_KEY ausente no runtime da Cloudflare Function.",
      code: "missing_resend_api_key",
      diagnostics,
    };
  }

  if (!EMAIL_RE.test(config.toEmail) || !EMAIL_RE.test(config.fromEmail)) {
    return {
      ok: false,
      status: 503,
      message: "CONTACT_TO_EMAIL ou CONTACT_FROM_EMAIL inválido no runtime.",
      code: "invalid_contact_emails",
      diagnostics,
    };
  }

  const subject = `${config.subjectPrefix} Novo contato - ${payload.name}`;
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
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.fromEmail,
      to: [config.toEmail],
      reply_to: payload.email,
      subject,
      text,
    }),
  });

  if (!resendResponse.ok) {
    const resendBody = await resendResponse.text();
    console.error("[contact-form] resend error", resendResponse.status, resendBody);
    let resendMessage = "Não foi possível enviar agora. Tente novamente em instantes.";
    try {
      const parsed = JSON.parse(resendBody);
      if (parsed?.message) resendMessage = `Resend: ${String(parsed.message).slice(0, 220)}`;
    } catch {
      // no-op
    }

    return {
      ok: false,
      status: 502,
      message: resendMessage,
      code: "resend_api_error",
      diagnostics,
    };
  }

  return { ok: true, diagnostics };
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
    return jsonResponse(
      {
        ok: false,
        message: sendResult.message,
        code: sendResult.code || "send_failed",
        diagnostics: sendResult.diagnostics,
      },
      sendResult.status
    );
  }

  return jsonResponse(
    {
      ok: true,
      message: "Solicitação enviada com sucesso.",
      diagnostics: sendResult.diagnostics,
    },
    200
  );
}

export async function onRequest(context) {
  const config = getRuntimeConfig(context.env || {});
  const diagnostics = getConfigDiagnostics(config);
  console.info("[contact-form] request", {
    method: context.request.method,
    path: new URL(context.request.url).pathname,
    diagnostics,
  });

  if (context.request.method === "GET") {
    return jsonResponse({
      ok: true,
      message: "Contact endpoint online.",
      diagnostics,
    });
  }

  if (context.request.method === "POST") {
    return onRequestPost(context);
  }

  return jsonResponse({ ok: false, message: "Método não permitido." }, 405);
}
