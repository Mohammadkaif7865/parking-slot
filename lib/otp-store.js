const otpStore = globalThis.__parkingOtpStore || new Map();
globalThis.__parkingOtpStore = otpStore;

export function createOtp(mobile) {
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  otpStore.set(mobile, {
    otp,
    expiresAt: Date.now() + 5 * 60 * 1000
  });
  return otp;
}

export function verifyOtp(mobile, otp) {
  const record = otpStore.get(mobile);
  if (!record) return false;
  if (record.expiresAt < Date.now()) {
    otpStore.delete(mobile);
    return false;
  }
  if (record.otp !== otp) return false;
  otpStore.delete(mobile);
  return true;
}

