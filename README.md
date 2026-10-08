# Prueba técnica — Software Engineer
**Tiempo estimado: 4 horas.** Está diseñada para que **no alcances a hacer todo**: queremos ver qué priorizas, qué dejas fuera y cómo lo explicas. Recortar alcance con criterio es parte de la evaluación.

## El problema

Lidz opera asistentes de ventas con IA para inmobiliarias. El asistente conversa por WhatsApp con personas interesadas en un proyecto, responde sus dudas, agenda visitas a la sala de ventas y, cuando el lead está listo, se lo pasa a un ejecutivo humano con un resumen de todo lo que se sabe de esa persona.

Vamos a lanzar el asistente para el proyecto **Mirador Ñuñoa**. La inmobiliaria ya nos dio el catálogo de unidades y las reglas del negocio. Necesitamos una primera versión funcional y, sobre todo, **una manera de convencernos (y convencer al cliente) de que se comporta bien antes de ponerlo frente a clientes reales**.

## Lo que el cliente espera del asistente

Estas son las reglas que nos dio la inmobiliaria. Incumplir cualquiera de las tres primeras en producción significa perder al cliente.

1. **Nunca inventa información.** Precios, metrajes, disponibilidad, horarios: todo lo que dice tiene que venir del catálogo que nos entregaron. Si no lo sabe, lo dice y ofrece derivar a un ejecutivo.
2. **Nunca ofrece unidades que no están disponibles.** Ya vendieron departamentos y les llegaron reclamos porque un asistente anterior los seguía ofreciendo.
3. **Nunca revela la política de descuentos.** Es información comercial confidencial. Si le preguntan por descuentos, deriva a un ejecutivo. La gente va a intentar sacársela de todas las formas posibles.
4. **Agenda visitas solo en los horarios de la sala de ventas.** Si piden un horario fuera de rango, propone uno válido.
5. **Sabe cuándo no le corresponde a él.** Reclamos, consultas sobre subsidios habitacionales y situaciones que se salen del guion las deriva a un humano en vez de improvisar.
6. **Es amable, claro y habla como chileno**, sin sonar a robot ni a vendedor de feria.

## Lo que necesita el ejecutivo al final

Cuando la conversación llega a un humano, no tiene tiempo de leerla completa. Necesita una **ficha del lead**: qué busca, cuánto puede pagar, qué tan apurado está, si ya tiene una visita agendada (y cuándo), si hay que atenderlo con urgencia porque reclamó o pidió algo especial, y un resumen corto.

## Lo que te entregamos

- `fixtures/catalogo.json`: el proyecto, sus 8 unidades (algunas ya vendidas), horarios de visita y la política de descuentos confidencial.
- `fixtures/conversaciones.json`: 10 aperturas típicas de conversación con leads de este proyecto. Úsalas como referencia de cómo escribe la gente real.
- Una API key de Gemini (Google AI Studio) (variable de entorno `GEMINI_API_KEY`) con límite de gasto.

## Lo que esperamos de vuelta

1. El asistente funcionando, en **TypeScript**, expuesto de una forma en que nuestra integración con WhatsApp pueda mandarle mensajes y recibir respuestas, manteniendo el hilo de cada conversación.
2. La ficha del lead disponible para cualquier conversación.
3. **Lo más importante:** una forma de demostrar que el asistente cumple las reglas del cliente. Cuando cambiemos el prompt, el modelo o el catálogo, queremos poder volver a correrlo y saber si algo se rompió. Piensa que se lo vas a mostrar al gerente comercial de la inmobiliaria para que autorice el lanzamiento: ¿qué le mostrarías? Incluye los resultados en el repo.
4. Evidencia de que tu código funciona y seguirá funcionando cuando alguien lo toque, independiente de cómo esté el modelo ese día.
5. Un `README.md` **detallado y escrito por ti, no por una IA**. Queremos saber cómo piensas, y eso no lo podemos evaluar en un texto generado. Debe cubrir al menos:
   - Cómo correrlo.
   - Arquitectura (un diagrama ASCII basta) y por qué la elegiste sobre las alternativas.
   - Las decisiones de negocio que tomaste (ver abajo) y su fundamento.
   - Cómo demuestras que cumple las reglas del cliente, qué tan confiable es esa demostración y qué **no** logras medir.
   - Cuánto costó en dinero correr tus pruebas.
   - **Qué dejaste fuera y por qué**, y qué cambiarías para llevarlo a producción.

   Puede tener errores de redacción; no puede ser genérico. En la entrevista vamos a conversar sobre lo que escribiste.

## Decisiones de negocio

El brief tiene huecos a propósito: ¿qué pasa si el lead pide algo que el catálogo no tiene?, ¿el asistente insiste o se despide?, ¿cuántas veces intenta agendar antes de derivar?, ¿qué cuenta como "reclamo"?, ¿qué información puede dar sobre una unidad vendida? No vamos a responder esas preguntas por ti. **Puedes tomar cualquier decisión de negocio que necesites**, pero tiene que quedar escrita en el README con su fundamento, y la vamos a evaluar como parte de la prueba: nos importa tanto la calidad de la decisión como que hayas notado que había que tomarla.

## Entrega

- **Repo en GitHub**, público o privado. Si es privado, compártelo con **@joaquincastillo**. Debe contener el código y el `README.md`.
- **Un deploy simple y funcional**, en GCP (Cloud Run, por ejemplo) u otro proveedor que prefieras (Railway, Render, Fly.io, Vercel, AWS…). Tiene que estar arriba cuando revisemos: la URL va en el README junto con cómo probarla (un `curl` de ejemplo basta). El deploy pesa bastante en la evaluación: que exista, que responda, que sea reproducible (idealmente con un comando o pipeline) y que la key y la configuración estén manejadas como corresponde.
- No aceptamos `.zip` ni código por correo.

## Reglas

- La API key nunca va en el repo.
- Puedes usar cualquier herramienta de IA para programar. El README no: ese lo escribes tú. En la entrevista vas a defender el diseño y cambiar algo en vivo.

---

# Respuestas

## Cómo correrlo

Requisitos: Node 20 o superior (el `Dockerfile` usa Node 24) y npm.

```bash
npm ci                 # instala dependencias exactas del lockfile
cp .env.example .env   # configuración local
```

`.env` importante:

| Variable | Qué hace | Valor local |
|---|---|---|
| `MODEL_BACKEND` | `fake` (sin red y determinista) o `gemini` (modelo real) | `fake` para desarrollo y tests |
| `GEMINI_API_KEY` | key de Google AI Studio. Solo se usa si `MODEL_BACKEND=gemini` | vacío con backend `fake` |
| `GEMINI_MODEL` | modelo a usar, disponible con la API-KEY de Gemini | `gemini-3.5-flash-lite` |
| `PORT` | puerto del servidor | `8080` |
| `TZ` | zona horaria de agendamiento | `America/Santiago` |
| `INGRESS_API_KEY` | si tiene valor, exige `x-api-key` en todo menos `/health`. Utilizado solo para estas pruebas como API-KEY de request | vacío = abierto |

Comandos:

- Para desarrollo con hot reload en el puerto configurado
```bash
npm run dev
```
- Para ejecutar tests (87 tests unitarios con vitest, sin red y sin key)
```bash
npm test
```
- Para compilar
```bash
npm run build
```
- Para ejecutar lo compilado
```bash
npm start
```
- Para probar las 14 reglas del cliente
```bash
npm run eval
```

La API tiene tres rutas:
- Status del servidor `/health`
- Enviar un mensaje de un lead (retomar o crear un hilo de conversación) `/messages`
- Obtener la ficha del lead asociada a un hilo de conversación `/lead/<lead-id>`

**Nota**: Recordar que si esta el API-KEY de request configurada, esta se debe incluir para las rutas de mensajes y ficha del lead

## Arquitectura

```
                       integración WhatsApp
                               |
                               v
                    +--------------------+
                    |  Fastify (server)  |  POST /messages
                    |  validación con    |  GET  /lead/:threadId
                    |  zod + auth opc.   |  GET  /health
                    +---------+----------+
                              |
                              v
                 +---------------------------+
                 |   orchestrator/assistant  |  ← dueño del hilo
                 |  1. guardrail de entrada  |    (1 regla -> respuesta fija)
                 |  2. loop de tools (≤3)    |
                 |  3. validador de salida   |    -> regenera (1 vez) o deriva
                 +---+-----------+-----------+
                     |           |
        +------------+           +----------------+
        v                          v
+-----------------+      +------------------+      +------------------+
| ia/responder    |      | orchestrator/    |      | lead/profile     |
|  fake  | gemini |      | tools (5)       |      | ficha del lead   |
+-----------------+      +--------+---------+      +------------------+
                                  |
                         +--------v---------+
                         | domain/          |
                         |  catalog (8 UF)  |
                         |  scheduling      |  horarios, timezone CL
                         |  amounts         |  extracción de UF/$
                         +------------------+

   estado en memoria: orchestrator/state (Map<hilo>) + caché messageId->respuesta
   datos: fixtures/catalogo.json (catálogo + política confidencial)
   evaluación: eval/ corre el asistente real y valida las respuestas
```

Argumentos de la arquitectura elegida:

- **Guardrails fuera del modelo**: El prompt solo da instrucciones, por lo que no garantiza nada. De esta manera, las reglas duras (precios, unidades vendidas, descuentos, horarios, fuga del prompt) se validan con código en `guardrails/output.ts` y, si la respuesta no pasa, se reintenta una vez y si falla se responde con un mensaje seguro y se escala. Esto permite atajar los casos donde el modelo puede fallar, pero el validador no.
- **Las tools son la única fuente de información:** Los precios y disponibilidad se obtienen de `domain/catalog.ts` donde se maneja el JSON con zod. De esta forma, el modelo nunca calcula, ni recuerda precios: si un monto no está en el catálogo, existirá la verificación de `checkAmounts` que bloqueará la respuesta.
- **Respuestas fijas para lo datos/temas sensibles:** Para consultas de descuento, reclamo, subsidio y datos personales se evita que  lleguen al modelo a través de `guardrails/entry.ts` que los detecta con regex y responde con texto armado en `safeReply.ts`. Esto nos permite hacer ahorro de consultas al modelo, gasto de tokens innecesariamente y que exista variación de comportamiento.
- **Responder intercambiable.** `MODEL_BACKEND=fake` usa un respondedor determinista que además ejercita las mismas tools: los tests y el eval corren igual el día que Gemini esté caído o sin key.
- **Estado en memoria:** Se hace uso de un `Map<hilo>` con límite de 24 turnos y caché de 200 respuestas por `messageId`. Esto se debe a la decisión por alcance, ya que no hubiera sido un ideal haber incluido el manejo de memoria tanto por cache(Redis por ejemplo) y base de datos (postgresql, etc) para hacer más robusta la entrega y uso a una forma de uso real diario.

- **Alternativas descartadas:** Solo hacer uso de prompt, un framework de agentes como LangChain/LangGraph, ya que son dependencias pesadas y que para el caso de la prueba aportaban poco con 5 tools. Tampoco se consideró RAG con embeddings, ya que el catálogo son 8 unidades y era más fácil el manejo con las tools. Finalmente uso de webhook de WhatsApp directamente por tema de tiempo y la API actual permite la comunicación y uso desde requests.

## Decisiones de negocio

1. **Unidad vendida: solo se dice que no está disponible.** Nunca se indica precio ni metraje (`get_unit_detail` devuelve `available: false` a secas y `checkUnits` bloquea frases que nombran una vendida sin negación). Se nos indica que el cliente ya recibió reclamos por asistentes con estos problemas.
2. **Descuento: respuesta única y siempre igual.** Cualquier mención (incluido "5%") escala con `derivationReply("discount")`, así evitamos pasar por el modelo.
3. **Lo que no existe en el catálogo:** Se responde "en este proyecto no contamos con eso", se ofrece **una** alternativa real que más se asemeje y se escala. No se inventa y no se deriva al principio. De esta forma el lead tiene una respuesta útil y el ejecutivo recibe el caso marcado como fuera de catálogo.
4. **Cuántas veces intenta agendar:** Se valida fecha, horario, duplicado y disponibilidad. De esta forma si falla, el modelo propone otro horario dentro de los próximos 21 días obtenidos a partir de `nextValidSlots`. El loop de tools corta en 3 rondas y, si se agota, se responde con mensaje seguro y escala. De esta manera existe  máximo dos intentos fallidos antes de pasar a humano evita que el asistente amargue la conversación.
5. **Qué cuenta como reclamo:** SERNAC, demanda, "nadie me llamó", "no responden", "mala atención", etc. → escala **urgente** y nunca intenta resolverlo. Así un reclamo mal manejado escala mucho más "caro" que una derivación temprana.
6. **Subsidio DS19:** el catálogo dice `subsidio_ds19: false`, así que la respuesta es "no está habilitado" y se deriva, sin explicar requisitos ni montos. De esta forma evitamos inventar requisitos de un subsidio que termina siendo un riesgo legal.
7. **Datos personales:** RUT, cuentas y tarjetas no se repiten ni se guardan. Solo se responde que no se usen por ese canal y se deriva.
8. **El asistente no hace cálculos financieros.** Evita hacer ventas de la forma de promoción de cuotas o recomendación por presupuesto. Esto se debe a que no es su rol, y un cálculo mal dado se vuelve una promesa para el posible cliente y también futuro problema legal.
9. **Tono:** máximo 3 frases por respuesta, español chileno, sin precios inventados y sin sonar a vendedor. El prompt lo pide y el validador corta si aparecen montos desconocidos.
10. **Idempotencia por `messageId`:** si WhatsApp reintenta el mensaje, se devuelve la misma respuesta. Con esto un reenvío no debe/puede agendar dos visitas ni gastar dos llamadas al modelo.
11. **Ficha del lead sin LLM:** `lead/profile.ts` arma la ficha con regex sobre el hilo (dormitorios, tipología, presupuesto, unidades nombradas, visita, escalamiento, resumen). Esto se decidió considerando que la ficha debe salir aunque el modelo esté caído y debe ser siempre igual para el mismo hilo.

## Cómo demuestro que cumple las reglas

Dos capas, y ninguna depende del humor del modelo ese día:

1. **Tests unitarios (`npm test`, 87 tests en 9 archivos).** Estos  cubren el catálogo, montos, horarios (incluye timezone de Santiago), los dos guardrails, la ficha del lead, el server (auth, validación, 404) y el orquestador con respondedor falso.
2. **Evaluación de reglas (`npm run eval`, 14 casos en `eval/casos.json`).** Corre el asistente real (con `fake` o con `gemini`, lo que diga `.env`) caso por caso y comprueba: si escala cuando debe, cuántas reservas quedaron, qué contiene y qué **no** puede contener la respuesta (nada de "descuento", nada del precio de la vendida B-704, sí "DS19" cuando corresponde), que cada respuesta pase `validateOutput`, y que ninguna repita la política confidencial del catálogo normalizada. Los resultados quedan escritos en `eval/resultados.json` para poder comparar corridas antes/después de cambiar prompt, modelo o catálogo.


**Qué no logro medir:** la calidad y el tono de la redacción, cómo se comporta el modelo con un prompt distinto sin re-correr el eval, latencia y estabilidad bajo carga y el flujo real de WhatsApp (webhook, entregas, reintentos). Por la arquitectura elegida, tampoco medimos las conversaciones largas con quiebres de contexto.

## Cuánto costó correr las pruebas

- `npm test`: **0 USD**, no hace ninguna llamada a la API.
- `npm run eval` con backend `fake`: **0 USD**, tampoco.
- `npm run eval` con `gemini`: **0 USD** porque la key es de Google AI Studio en *free tier*; el límite real es de 15 requests/minuto por modelo, no de dinero. El tope teórico de una corrida completa es 14 casos × `EVAL_MAX_REQUESTS=4` = 56 llamadas a `gemini-3.5-flash-lite`; en la práctica quedó en el orden de las 35-40. Con una key facturable ese volumen es de orden centavos de dólar, pero preferí no medirlo con una key que paga.

## Deploy

Todo el proceso se incluye en el archivo:
```bash
./deploy.sh
```

Este sube a Cloud Run (`us-central1`, región donde el free tier de Cloud Run no cobra), con:

- `--source .` + `Dockerfile`
- `--allow-unauthenticated` e `--ingress all`
- `GEMINI_API_KEY` desde Secret Manager (`mirador-gemini`) y, cuando se activa con `USE_INGRESS_KEY=1`, también `INGRESS_API_KEY` desde (`mirador-ingress-key`), nunca desde el repo.
- Actualmente el servicio **está protegido** con `INGRESS_API_KEY`: `/messages` y `/lead/*` exigen `x-api-key` (o `Authorization: Bearer ...`). `/health` queda libre.

URL pública: `https://mirador-nunoa-4jj36yavta-uc.a.run.app`

### Curl de ejemplo para probar el deploy

La API está protegida con `INGRESS_API_KEY` en `/messages` y `/lead/*`. Reemplaza `TU_INGRESS_KEY` por la misma key que aparece en `.env`.

```bash
# salud
curl -s https://mirador-nunoa-4jj36yavta-uc.a.run.app/health

# enviar un mensaje al asistente
curl -s -X POST https://mirador-nunoa-4jj36yavta-uc.a.run.app/messages \
  -H 'content-type: application/json' \
  -H 'x-api-key: TU_INGRESS_KEY' \
  -d '{"threadId":"demo","messageId":"m1","text":"Hola, ¿tienen departamentos de 2 dormitorios?"}'

# ver la ficha del lead de esa conversación
curl -s https://mirador-nunoa-4jj36yavta-uc.a.run.app/lead/demo \
  -H 'x-api-key: TU_INGRESS_KEY'
```


## Qué dejé fuera y qué cambiaría para producción

Dejado fuera, con motivo:

- **Persistencia:** El estado vive en un `Map` en memoria, lo que implica que con cada reinicion, las conversaciones son borradas. Esto afecta más considerando si se usara más de una instancia de servidor donde cada cual tendría su propio mapa e hilo de conversaciones. Esto no es útil ni funcional a nivel de producto pero por temas de tiempo acotado no se incluyo un uso de servicio como Redis, ni tampoco una DB persistente a largo plazo como Postgresql, etc.
- **Webhook de WhatsApp:** Esta no está incluida, la API es HTTP para que la integración sea de forma "manual". Haría falta verificar firmas, manejar entregas/fallas y reintentos.
- **Auth de ingreso:** Actualmente usa en producción `INGRESS_API_KEY` como solución momentanea pero sería mejor el correcto flujo de key o mejor usar firma del webhook de WhatsApp + restrict de dominio.
- **Clasificador LLM:** `assessInput` calcula `needsLlmClassifier` para cuando ninguna regex hace match, pero nadie lo consume todavía: hoy un reclamo mal escrito puede no detectarse, siendo de esta forma útil como siguiente paso y así abarcar más casos.
- **Rate limiting y límite de gasto:** Actualmente cualquiera con la URL y API-KEY puede gastar la cuota de Gemini. Haría falta cuota por `threadId` y por IP.
- **Eval con modelo real:** se cae si llega a un 429. Lo arreglaría con backoff respetando `RetryInfo` y con throttle entre casos.
- **Observabilidad:** Actualmente solo se manejan los eventos por `console.log`. En producción esto debe ser con logs estructurados a Cloud Logging, métricas de escalamientos y monitoreo.
- **Tests de contrato con el modelo:** el eval cubre 14 casos, falto incluir los 10 openings de `fixtures/conversaciones.json` como casos de humo y para casos futuros más robustos una ejecución programada con un cron que compare contra el último `resultados.json` ante cualquier caso de cambios de modelo o prompt, etc.
