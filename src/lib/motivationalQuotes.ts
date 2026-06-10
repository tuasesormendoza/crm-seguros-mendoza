// Frases motivadoras para el Dashboard. Se muestran 2 veces al día (mañana y
// tarde/noche) — el índice cambia automáticamente con la fecha y la hora, así
// que cada frase se mantiene fija durante medio día y luego cambia.

export const MOTIVATIONAL_QUOTES: string[] = [
  'Cada llamada es una oportunidad de cambiar la vida de una familia.',
  'El éxito es la suma de pequeños esfuerzos repetidos día tras día.',
  'No se trata de vender un seguro, se trata de proteger un sueño.',
  'Tu actitud de hoy define tus resultados de mañana.',
  'Las mejores relaciones con clientes se construyen con honestidad, no con prisa.',
  'Un "no" de hoy puede ser el "sí" de la próxima semana — sigue insistiendo.',
  'La constancia vence al talento cuando el talento no es constante.',
  'Cada cliente satisfecho es la mejor publicidad que puedes tener.',
  'El primer paso para lograr algo es decidir que puedes hacerlo.',
  'Trabaja en silencio, deja que tus resultados hagan ruido.',
  'La disciplina es el puente entre tus metas y tus logros.',
  'Hoy es un buen día para superar tu récord de ayer.',
  'No esperes la oportunidad perfecta, créala con tu esfuerzo diario.',
  'Cuida a tus clientes y ellos cuidarán tu negocio.',
  'El miedo al rechazo es más caro que el rechazo mismo.',
  'Cada renovación es la prueba de que hiciste bien tu trabajo.',
  'La confianza se gana respondiendo, no prometiendo.',
  'Pequeños progresos diarios producen grandes resultados anuales.',
  'Tu mejor competencia es la persona que fuiste ayer.',
  'Ayuda primero, vende después — el orden importa.',
  'La organización de hoy es la tranquilidad de mañana.',
  'Cada póliza activa es una familia más protegida gracias a ti.',
  'No cuentes los días, haz que los días cuenten.',
  'El esfuerzo de hoy es la comisión de mañana.',
  'Las grandes carteras de clientes se construyen una llamada a la vez.',
  'Sonríe, hasta por teléfono se nota.',
  'La preparación elimina la mayoría de los nervios.',
  'Un cliente bien atendido vuelve y trae a alguien más.',
  'El crecimiento empieza fuera de la zona de comodidad.',
  'Haz de cada "gracias por su tiempo" una puerta abierta para el futuro.',
  'La paciencia y la persistencia tienen un efecto mágico ante las dificultades.',
  'No trabajes solo por la comisión, trabaja por la confianza.',
  'Cada día es una nueva oportunidad de mejorar tu negocio.',
  'El seguimiento es lo que separa a los buenos agentes de los excelentes.',
  'Tu energía es contagiosa — elige transmitir la correcta.',
  'Enfócate en el progreso, no en la perfección.',
  'Detrás de cada número en el CRM hay una persona que confió en ti.',
  'La gratitud convierte lo que tienes en suficiente.',
  'Empieza el día organizando tus prioridades, no apagando incendios.',
  'Las metas escritas se cumplen más que las metas pensadas.',
  'Cada cliente que ayudas hoy es una semilla para tu futuro.',
  'La calidad de tu seguimiento define la calidad de tu cartera.',
  'No dejes para mañana la llamada que puedes hacer hoy.',
  'El optimismo es el motor de las ventas.',
  'Tu reputación se construye en cada pequeña interacción.',
  'Si fue difícil, lo vas a disfrutar más cuando lo logres.',
  'Aprende algo nuevo cada día y aplícalo mañana mismo.',
  'La mejor manera de predecir tu futuro es crearlo.',
  'Cuida los detalles, los clientes los notan.',
  'El trabajo duro de hoy es la libertad de mañana.',
]

/**
 * Devuelve una frase motivadora basada en la fecha y la hora actual.
 * Cambia 2 veces al día: una para la mañana (antes de las 12pm) y otra
 * para la tarde/noche, de forma determinística (no aleatoria) para que
 * se mantenga igual durante toda la mitad del día.
 */
export function getMotivationalQuote(date: Date = new Date()): string {
  const start = new Date(date.getFullYear(), 0, 0)
  const diff = date.getTime() - start.getTime()
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24))
  const half = date.getHours() < 12 ? 0 : 1
  const index = (dayOfYear * 2 + half) % MOTIVATIONAL_QUOTES.length
  return MOTIVATIONAL_QUOTES[index]
}
