export function getWhatsappMode() {
  return (process.env.WHATSAPP_OTP_MODE || "demo").toLowerCase() === "live" ? "live" : "demo";
}

function getEnvValue(...keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim()) return value.trim();
  }
  return "";
}

function normalizeWhatsappRecipient(mobile) {
  const digits = String(mobile || "").replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

async function readProviderResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export async function sendOtpMessage(mobile, otp) {
  const mode = getWhatsappMode();
  if (mode === "demo") {
    return { mode, sent: false };
  }

  const phoneNumberId = getEnvValue(
    "CHATBOX_PHONE_NUMBER_ID",
    "WHATSAPP_PHONE_NUMBER_ID",
    "PHONE_NUMBER_ID"
  );
  const apiKey = getEnvValue(
    "CHATBOX_WABA_API_KEY",
    "CHATBOX_API_KEY",
    "WHATSAPP_API_KEY",
    "WABA_API_KEY"
  );
  if (!phoneNumberId || !apiKey) {
    throw new Error("WhatsApp live mode requires phone number id and API key env variables.");
  }

  const templateName = getEnvValue("WHATSAPP_TEMPLATE_NAME", "CHATBOX_TEMPLATE_NAME") || "shreejitop";
  const languageCode = getEnvValue("WHATSAPP_TEMPLATE_LANGUAGE", "CHATBOX_TEMPLATE_LANGUAGE") || "en";
  const hasButton = (getEnvValue("WHATSAPP_TEMPLATE_HAS_BUTTON", "CHATBOX_TEMPLATE_HAS_BUTTON") || "true").toLowerCase() !== "false";
  const apiBaseUrl = (getEnvValue("WHATSAPP_API_BASE_URL", "CHATBOX_API_BASE_URL") || "https://whatsappapi.app.3inboxpro.com").replace(/\/+$/, "");
  const components = [
    {
      type: "body",
      parameters: [{ type: "text", text: String(otp) }]
    }
  ];

  if (hasButton) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: String(otp) }]
    });
  }

  const response = await fetch(`${apiBaseUrl}/v3/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizeWhatsappRecipient(mobile),
      type: "template",
      template: {
        name: templateName,
        language: {
          code: languageCode
        },
        components
      }
    })
  });

  const result = await readProviderResponse(response);
  if (!response.ok) {
    const providerError = result.error?.message || result.message || result.error || "WhatsApp OTP send failed.";
    throw new Error(typeof providerError === "string" ? providerError : "WhatsApp OTP send failed.");
  }

  return { mode, sent: true, providerResponse: result };
}
