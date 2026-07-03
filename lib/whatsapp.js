export function getWhatsappMode() {
  return (process.env.WHATSAPP_OTP_MODE || "demo").toLowerCase() === "live" ? "live" : "demo";
}

export async function sendOtpMessage(mobile, otp) {
  const mode = getWhatsappMode();
  if (mode === "demo") {
    return { mode, sent: false };
  }

  const phoneNumberId = process.env.CHATBOX_PHONE_NUMBER_ID;
  const apiKey = process.env.CHATBOX_WABA_API_KEY;
  if (!phoneNumberId || !apiKey) {
    throw new Error("WhatsApp live mode requires CHATBOX_PHONE_NUMBER_ID and CHATBOX_WABA_API_KEY.");
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
    throw new Error(result.error?.message || result.message || "WhatsApp OTP send failed.");
  }

  return { mode, sent: true, providerResponse: result };
}

