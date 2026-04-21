const GA4_MEASUREMENT_ID = (import.meta.env.VITE_GA4_MEASUREMENT_ID || "").trim();
const PAGE_KIND = window.location.pathname.includes("paraiba-pet") ? "paraiba_pet" : "home";
const ENTRY_TRACKED_KEY = "ls_entry_origin_tracked_v1";

function getSessionFlag(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function setSessionFlag(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // no-op
  }
}

function loadGoogleTag(measurementId) {
  if (typeof window.gtag === "function") return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };

  window.gtag("js", new Date());
  window.gtag("config", measurementId, {
    send_page_view: true,
    allow_google_signals: false,
  });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);
}

function sanitizeValue(value) {
  if (typeof value === "string") return value.slice(0, 100);
  if (typeof value === "number" || typeof value === "boolean") return value;
  return undefined;
}

function sanitizeParams(params) {
  return Object.entries(params).reduce((accumulator, [key, value]) => {
    const sanitized = sanitizeValue(value);
    if (sanitized !== undefined && sanitized !== "") accumulator[key] = sanitized;
    return accumulator;
  }, {});
}

function trackEvent(eventName, params = {}) {
  if (typeof window.gtag !== "function") return;
  window.gtag("event", eventName, sanitizeParams(params));
}

function getReferrerHost(referrer) {
  if (!referrer) return "";

  try {
    return new URL(referrer).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function classifyEntryOrigin({ utmSource, referrerHost }) {
  const normalizedSource = (utmSource || "").toLowerCase();

  if (
    normalizedSource.includes("paraiba_pet") ||
    normalizedSource.includes("paraiba-pet") ||
    referrerHost.includes("sepa.pb.gov.br") ||
    referrerHost.includes("paraiba")
  ) {
    return "paraiba_pet";
  }

  if (normalizedSource.includes("google") || /(^|\.)google\./.test(referrerHost)) {
    return "google";
  }

  if (!referrerHost) return "direct";
  return "referral";
}

function getSectionId(element) {
  if (!element) return "unknown";

  const section = element.closest("section[id]");
  if (section?.id) return section.id;
  return "unknown";
}

function getLinkType(anchor) {
  const href = anchor.getAttribute("href") || "";
  if (!href) return "unknown";
  if (href.startsWith("mailto:")) return "mailto";
  if (href.startsWith("tel:")) return "tel";
  if (href.startsWith("#")) return "anchor";
  if (href.startsWith("/")) return "internal";

  try {
    const url = new URL(href, window.location.origin);
    return url.origin === window.location.origin ? "internal" : "external";
  } catch {
    return "unknown";
  }
}

function normalizeTarget(anchor) {
  const href = anchor.getAttribute("href") || "";
  if (!href) return "none";

  if (href.startsWith("mailto:") || href.startsWith("tel:")) return href;

  try {
    const url = new URL(href, window.location.origin);
    return `${url.hostname}${url.pathname}`;
  } catch {
    return href;
  }
}

function trackEntryOrigin() {
  if (getSessionFlag(ENTRY_TRACKED_KEY) === "1") return;

  const searchParams = new URLSearchParams(window.location.search);
  const utmSource = searchParams.get("utm_source") || "";
  const utmMedium = searchParams.get("utm_medium") || "";
  const utmCampaign = searchParams.get("utm_campaign") || "";
  const utmId = searchParams.get("utm_id") || "";
  const referrerHost = getReferrerHost(document.referrer);
  const entryOrigin = classifyEntryOrigin({ utmSource, referrerHost });

  trackEvent("entry_origin_detected", {
    entry_origin: entryOrigin,
    entry_source: utmSource || "(none)",
    entry_medium: utmMedium || "(none)",
    entry_campaign: utmCampaign || "(none)",
    entry_id: utmId || "(none)",
    referrer_host: referrerHost || "(direct)",
    landing_path: window.location.pathname,
    page_kind: PAGE_KIND,
  });

  setSessionFlag(ENTRY_TRACKED_KEY, "1");
}

function bindLinkTracking() {
  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const anchor = event.target.closest("a[href]");
    if (!anchor) return;

    const label = (anchor.textContent || "").trim().replace(/\s+/g, " ").slice(0, 100);
    const linkType = getLinkType(anchor);
    const target = normalizeTarget(anchor);
    const sectionId = getSectionId(anchor);

    trackEvent("cta_click", {
      cta_label: label || "sem_rotulo",
      cta_type: linkType,
      cta_target: target,
      cta_section: sectionId,
      page_kind: PAGE_KIND,
      page_path: window.location.pathname,
    });

    if (linkType === "mailto" || linkType === "tel") {
      trackEvent("contact_click", {
        contact_type: linkType,
        contact_target: target,
        cta_label: label || "sem_rotulo",
        page_kind: PAGE_KIND,
      });
    }
  });
}

function bindModalTracking() {
  document.querySelectorAll("[data-modal-target]").forEach((trigger) => {
    trigger.addEventListener("click", () => {
      const targetId = trigger.getAttribute("data-modal-target") || "unknown";
      const label = (trigger.textContent || "").trim().replace(/\s+/g, " ").slice(0, 100);

      trackEvent("modal_open", {
        modal_id: targetId,
        trigger_label: label || "sem_rotulo",
        page_kind: PAGE_KIND,
      });
    });
  });

  document.querySelectorAll("dialog[id]").forEach((dialog) => {
    dialog.addEventListener("close", () => {
      trackEvent("modal_close", {
        modal_id: dialog.id,
        page_kind: PAGE_KIND,
      });
    });
  });
}

if (!GA4_MEASUREMENT_ID) {
  console.info("[analytics] GA4 desativado: defina VITE_GA4_MEASUREMENT_ID.");
} else {
  loadGoogleTag(GA4_MEASUREMENT_ID);
  trackEntryOrigin();
  bindLinkTracking();
  bindModalTracking();
}
