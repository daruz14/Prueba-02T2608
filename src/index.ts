import { loadConfig } from "./config.js";
import { createResponder } from "./ia/createResponder.js";
import { createAssistant } from "./orchestrator/assistant.js";
import { createServer } from "./server.js";

const config = loadConfig();

const assistant = createAssistant({
  responder: createResponder(config),
  onEvent: (event) => console.log(JSON.stringify(event)),
});

const server = await createServer(config, assistant);

try {
  await server.listen({ port: config.PORT, host: "0.0.0.0" });
} catch (error) {
  server.log.error(error);
  process.exit(1);
}
