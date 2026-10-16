function normalizePhone(phone) {
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

// Abhi: console log + wa.me link. Baad mein yahan WhatsApp Cloud API / Twilio lagayenge.
async function sendCredentials({
  phone,
  studentName,
  role = "student",
  userId,
  password,
}) {
  const to = normalizePhone(phone);
  const intro =
    role === "teacher"
      ? `School ERP me ${studentName} (Teacher) ka account ban gaya hai.`
      : `School ERP me ${studentName} ka admission ho gaya hai.`;

  const text =
    `${intro}\nUser ID: ${userId}\nPassword: ${password}\n` +
    `Pehli baar login ke baad password change kar lein.`;

  const waLink = `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
  console.log(`[WhatsApp -> ${to}]\n${text}\n`);

  return { sent: false, mode: "manual-link", waLink };
}

module.exports = { sendCredentials };
