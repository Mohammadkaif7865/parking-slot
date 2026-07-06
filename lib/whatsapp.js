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

  const response = await fetch(`https://api.chatbox.biz/v3/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: `91${mobile}`,
      type: "text",
      text: {
        preview_url: false,
        body: `Your parking login OTP is ${otp}. It is valid for 5 minutes.`
      }
    })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const providerError = result.error?.message || result.message || result.error || "WhatsApp OTP send failed.";
    throw new Error(typeof providerError === "string" ? providerError : "WhatsApp OTP send failed.");
  }

  return { mode, sent: true, providerResponse: result };
}
