// Mensajes para solicitar referidos por WhatsApp de manera ingeniosa y respetuosa.
// Hay varias variantes para que cada cliente reciba un mensaje con un tono
// natural y no se sienta como un mensaje masivo/copiado. La variante se elige
// de forma determinística según el id del cliente, así el mismo cliente
// siempre recibe el mismo "estilo" (consistencia si se reenvía).

const INITIAL_TEMPLATES: ((name: string) => string)[] = [
  (name) => `¡Hola ${name}! 😊 Espero que estés disfrutando de la tranquilidad de tener tu seguro en orden. Quería pedirte un pequeño favor: si conoces a alguien —familiar, amigo o compañero de trabajo— que también necesite ayuda con su seguro de salud, o sienta que está pagando de más, me encantaría atenderle con el mismo cuidado que a ti, sin costo ni compromiso. Solo compárteme su nombre y número, y yo me encargo del resto 🙌. ¡Gracias por tu confianza! — Omar Mendoza, Tu Asesor de Seguros`,
  (name) => `Hola ${name} 👋. Ha sido un gusto ayudarte con tu seguro. Tengo un pequeño favor que pedirte: ¿hay alguien en tu familia o círculo cercano que aún no tenga un buen seguro de salud, o que no esté seguro si está bien cubierto? Me encantaría ofrecerle una revisión gratuita y sin compromiso, igual que hice contigo. Si se te viene alguien a la mente, solo pásame su contacto 🙏. ¡Gracias!`,
  (name) => `${name}, ¡qué tal! 🌟 Quería tomarme un momento para agradecerte por confiar en mí con tu seguro. Como agradecimiento, me encantaría poder ayudar también a las personas que tú quieres — si conoces a alguien que necesite orientación con su seguro de salud, cuéntame y le doy la misma atención personalizada que a ti, totalmente gratis. ¡Un abrazo!`,
  (name) => `Hola ${name} 😊, espero que todo vaya muy bien por allá. Te escribo porque mi negocio crece principalmente gracias a la confianza de personas como tú. Si conoces a alguien que esté buscando seguro de salud, o que sienta que su plan actual no le conviene, me encantaría poder ayudarle — sin compromiso y con la misma honestidad que te ofrecí a ti. ¡Cualquier referido es bienvenido y muy apreciado! 🙏`,
]

const REMINDER_TEMPLATES: ((name: string) => string)[] = [
  (name) => `Hola ${name} 👋, ¿cómo va todo? Hace unos días te comenté sobre la posibilidad de referirme a alguien que necesite ayuda con su seguro de salud. Sé que el día a día nos consume — si se te ocurre alguien, con gusto le doy la misma atención que a ti, sin compromiso. ¡Gracias de nuevo por tu confianza! 🙏`,
  (name) => `${name}, espero que estés muy bien 😊. Solo quería darte un empujoncito amistoso por si se te pasó mi mensaje anterior — si conoces a alguien que pudiera beneficiarse de una asesoría de seguro de salud sin costo, me encantaría conocerlo. ¡Sin ninguna prisa! Aquí estoy cuando gustes 🙌`,
  (name) => `Hola ${name} 👋. Quería saludarte y, de paso, recordarte con mucho cariño: si en algún momento conoces a alguien que necesite orientación con su seguro de salud, sería un placer ayudarle como te ayudé a ti. ¡Gracias por tenerme en mente! 🙏`,
  (name) => `Hola ${name}, ¡espero que todo esté excelente! 🌟 Solo paso a recordarte con cariño que si conoces a alguien —familia, amigos, compañeros de trabajo— que necesite revisar su seguro de salud, sería un gusto ayudarle igual que a ti, sin ningún costo. ¡Gracias por tu tiempo! 🙏`,
]

function pickTemplate(templates: ((name: string) => string)[], seed: string): (name: string) => string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return templates[hash % templates.length]
}

export function getReferralInitialMessage(name: string, clientId: string): string {
  return pickTemplate(INITIAL_TEMPLATES, clientId)(name)
}

export function getReferralReminderMessage(name: string, clientId: string): string {
  return pickTemplate(REMINDER_TEMPLATES, `${clientId}-r`)(name)
}
