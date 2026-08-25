# Prueba técnica — Software Engineer Semi Senior

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
