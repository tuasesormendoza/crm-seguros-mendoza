// ─────────────────────────────────────────────────────────────────────────────
// CONOCIMIENTO DE FONDO SOBRE LA LEY ACA (Obamacare)
//
// Esto no explica cómo usar el CRM (para eso está CRM_GUIDE), sino la LEY: qué
// cubre, quién califica, cómo funcionan los subsidios y qué papeles pide el
// Mercado. Sirve para que el asistente responda dudas de seguros, no solo de
// botones.
//
// OJO AL MANTENERLO: las cifras de aquí tienen que cuadrar con las que calcula
// el CRM de verdad (src/lib/aptcSchedule.ts y los valores FPL de Configuración).
// Si se desincronizan, el asistente le dará al agente un número distinto al de
// su propia Calculadora APTC delante del cliente. Por eso, ante cualquier
// número concreto, la regla es mandar a usar la calculadora.
// ─────────────────────────────────────────────────────────────────────────────

export const ACA_KNOWLEDGE = `
CONOCIMIENTO DE LA LEY ACA (Obamacare). Úsalo para responder dudas de seguros de salud, no solo de cómo usar el CRM. Explica siempre en lenguaje sencillo, como se lo explicarías a un cliente.

QUÉ ES
La Ley de Cuidado de Salud a Bajo Precio (ACA), aprobada en marzo de 2010, es la reforma de salud más profunda de EE.UU. en décadas. Busca que más gente tenga seguro, abaratarlo con subsidios y poner reglas estrictas a las aseguradoras.

LOS TRES PILARES
1. Protección al consumidor: las aseguradoras NO pueden negar cobertura ni cobrar más caro por condiciones preexistentes (diabetes, cáncer, embarazo...). Tampoco pueden cancelar la póliza porque el cliente se enferme, ni poner topes de por vida a los beneficios esenciales.
2. Subsidios: créditos fiscales federales que bajan la prima mensual según ingresos y tamaño del hogar. (El "mandato individual" federal existe pero su multa es $0 desde 2019; algunos estados tienen la suya.)
3. Expansión de Medicaid: la ley financió a los estados para cubrir con Medicaid a adultos hasta el 138% del FPL. CADA ESTADO DECIDE si la adopta. Georgia, Florida y Texas NO la adoptaron — esto importa mucho (ver "brecha de cobertura").

LOS 10 BENEFICIOS ESENCIALES DE SALUD (EHB) — ningún plan ACA puede excluirlos
1. Servicios ambulatorios (consulta sin ingresar al hospital)
2. Servicios de emergencia
3. Hospitalización (cirugías y estadías)
4. Maternidad y atención al recién nacido
5. Salud mental y tratamiento por uso de sustancias
6. Medicamentos recetados
7. Rehabilitación y habilitación (terapias y dispositivos)
8. Servicios de laboratorio
9. Servicios preventivos y de bienestar (vacunas, chequeo anual, mamografías — sin deducible)
10. Servicios pediátricos, incluidos dental y visión para niños

NIVELES DE METAL — reparto del costo, NO calidad de la atención
• Bronce: la aseguradora paga ~60%, el cliente ~40%. Prima más baja, deducible más alto.
• Plata (Silver): ~70% / ~30%. Prima moderada. ES EL ÚNICO NIVEL que da derecho a la Reducción de Costos Compartidos (CSR).
• Oro (Gold): ~80% / ~20%. Prima alta, gastos de bolsillo bajos.
• Platino: ~90% / ~10%. Prima más alta.
Consejo de venta: si el cliente califica para CSR, casi siempre le conviene Plata aunque el Bronce sea más barato, porque el CSR le baja deducible y copagos de golpe.

LOS DOS TIPOS DE AYUDA ECONÓMICA
• Crédito Fiscal para la Prima (APTC/PTC): baja la mensualidad. Se calcula sobre el "plan Plata de referencia" (SLCSP, el 2º Silver más barato de su zona).
• Reducción de Costos Compartidos (CSR): baja deducible, copagos y coaseguro. Requiere DOS condiciones a la vez: ingresos entre 100% y 250% del FPL Y elegir un plan Plata.

MUY IMPORTANTE — LOS SUBSIDIOS MEJORADOS YA EXPIRARON
Los subsidios ampliados (ARPA/IRA, vigentes 2021–2025) TERMINARON el 01/01/2026. Si encuentras información que diga "nadie paga más del 8.5% de sus ingresos" o "se eliminó el límite del 400%", ESO YA NO APLICA a 2026 en adelante. Desde 2026:
• Volvió el "precipicio del 400%": por encima del 400% del FPL NO hay ningún crédito fiscal, ni un dólar.
• El cliente aporta MÁS de su bolsillo. La tabla del IRS va desde 2.1% del ingreso (por debajo del 133% del FPL) hasta 9.96% (entre 300% y 400%).
Si un cliente pregunta por qué su subsidio bajó respecto al año pasado, ESTA es la razón. No es un error del agente ni de la aseguradora.

RANGOS DE INGRESO PARA CALIFICAR
El subsidio va, en general, del 100% al 400% del FPL. NO cites cifras en dólares de memoria: el FPL cambia cada enero y el CRM tiene los valores exactos configurados. Manda siempre al agente a la Calculadora APTC (menú: Calc. APTC), que usa los valores oficiales y da el número real. Si entra desde la ficha del cliente, se llena sola con sus datos.

BRECHA DE COBERTURA (ojo, error común)
Es FALSO que quien gana menos del 100% del FPL siempre pase a Medicaid. Eso solo ocurre en los estados que expandieron Medicaid.
En los estados que NO lo expandieron —Georgia, Florida, Texas, Alabama, Misisipi, Carolina del Sur, Tennessee, Kansas, Wisconsin, Wyoming— una persona por debajo del 100% del FPL queda en la BRECHA DE COBERTURA: gana muy poco para el subsidio del Mercado y demasiado para el Medicaid de su estado. Se queda sin ninguna de las dos ayudas.
La Calculadora APTC del CRM ya detecta este caso y lo avisa. Cuando pase, explícaselo al agente con claridad y sugiérele revisar si el ingreso estimado del cliente está bien calculado (mucha gente subestima su ingreso anual sin querer).

QUIÉN PUEDE INSCRIBIRSE
• Vivir en EE.UU., en el estado/código postal donde solicita.
• Tener estatus migratorio legal: ciudadano, naturalizado, residente permanente (Green Card) u otro estatus calificado (asilo concedido, refugiado, TPS, visas de trabajo o estudiante, EAD...).
• No estar encarcelado cumpliendo condena.

QUIÉN NO PUEDE USAR LOS SUBSIDIOS (aunque sí pueda inscribirse)
• Quien tiene seguro del trabajo que la ley considera "asequible y adecuado".
• Quien ya califica o está inscrito en Medicare, Medicaid tradicional o CHIP.
• Y desde el 01/01/2027, quien no sea ciudadano ni residente permanente (ver la REGLA DEL 01/01/2027 más arriba: podrán inscribirse, pero a precio completo).

PERIODOS DE INSCRIPCIÓN
• Inscripción Abierta (OEP): del 1 de noviembre al 15 de enero en la mayoría de los estados, incluida Georgia. Es el único momento en que cualquiera puede inscribirse o cambiar de plan sin dar explicaciones.
• Periodo Especial (SEP): fuera de esas fechas, solo con un "evento de vida calificado" ocurrido en los últimos 60 DÍAS: perder el seguro del trabajo, casarse, divorciarse, tener o adoptar un hijo, mudarse a otro código postal, cumplir 26 años y salir del seguro de los padres. Insiste en el plazo de 60 días: es lo que más clientes pierde.

HMO vs PPO
• HMO: red cerrada (solo médicos de la red, salvo emergencia real). Médico de cabecera OBLIGATORIO y hace falta su referido para ir al especialista. Prima generalmente más baja.
• PPO: red flexible, se puede salir de la red pagando más. NO exige médico de cabecera ni referidos. Prima generalmente más alta.
Cómo aconsejar: HMO si el cliente prioriza ahorrar en la mensualidad; PPO si quiere conservar a sus médicos actuales o ir directo al especialista.

DOCUMENTOS QUE PIDE EL MERCADO
• Identidad y estatus (uno por cada persona que se inscribe): SSN, pasaporte de EE.UU. o certificado de naturalización; Green Card (I-551); permiso de trabajo (EAD, I-765); pasaporte extranjero con visa vigente (H-1B, L-1, F-1, J-1); I-94; o la aprobación de asilo/refugio/TPS.
• Ingresos (el Mercado usa el MAGI estimado del año): talones de pago de los últimos 30 días o W-2 del año anterior; si es 1099 o cuenta propia, la declaración más reciente (1040 con Schedule C) o un libro de ingresos y gastos; cartas de desempleo, pensión alimenticia o jubilación.
• Domicilio: factura de servicios o contrato de renta.
• Si tiene trabajo con seguro: el formulario "Employer Coverage Tool" lleno por el empleador.
Todo esto se guarda en la ficha del cliente, en Documentos, con su categoría.

CÓMO ESTIMAR EL INGRESO (lo más delicado de la solicitud)
El subsidio se calcula sobre el MAGI que el cliente ESPERA ganar en todo el año, no sobre lo que ganó el mes pasado.
Método: (1) sumar el ingreso bruto anual esperado; (2) si trabaja por su cuenta, restar los gastos deducibles del negocio (gasolina de trabajo, herramientas, suministros, publicidad) — el empleado con W-2 NO puede restarlos; (3) sumar otras fuentes: inversiones, pensión, desempleo y el ingreso del cónyuge si declaran juntos; (4) dividir entre 12 para el promedio mensual.
Si el ingreso es inestable (comisiones, propinas, temporadas): usar la línea 11 del 1040 del año pasado como base, o promediar un mes bueno y uno malo y multiplicar por 12.
REGLA DE ORO: es preferible estimar un poco POR ENCIMA. Si se estima muy por debajo, el gobierno adelanta más subsidio del que corresponde y el cliente tendrá que DEVOLVERLO al declarar impuestos. Y si a mitad de año cambian los ingresos, hay que entrar a CuidadoDeSalud.gov (o Georgia Access) y actualizarlos: el sistema recalcula el subsidio al momento y protege al cliente.

DÓNDE SE INSCRIBE
• La mayoría de los estados usan el mercado federal: CuidadoDeSalud.gov (HealthCare.gov).
• Georgia tiene mercado propio: georgiaaccess.gov. NO se cotiza en CuidadoDeSalud.gov. La Calculadora APTC del CRM ya cotiza Georgia automáticamente con los planes y tarifas oficiales del estado.
• Otros estados con mercado propio (California, Nueva York, Pensilvania, Nevada, Nuevo México, Idaho, Minnesota...) tienen su propia página; la calculadora muestra el enlace y permite escribir a mano el precio del plan Plata de referencia.
`
