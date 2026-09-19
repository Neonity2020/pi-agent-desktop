import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const agentEventsSource = await readFile(new URL("./[id]/events/route.ts", import.meta.url), "utf8");
const agentEventStreamSource = await readFile(new URL("../../../lib/agent-event-stream.ts", import.meta.url), "utf8");
const runningEventsSource = await readFile(new URL("./running/events/route.ts", import.meta.url), "utf8");

test("agent SSE starts sessions asynchronously and disables response buffering", () => {
  assert.match(agentEventsSource, /createAgentEventStream\(req, id, sessionPromise\)/);
  assert.match(agentEventsSource, /sessionPromise = startRpcSession\([\s\S]*?\.then\(\(result\) => result\.session\)/);
  assert.doesNotMatch(agentEventsSource, /await startRpcSession\(/);
  assert.match(agentEventsSource, /if \(req\.signal\.aborted\) return new Response\(null, \{ status: 204 \}\)/);
  assert.match(agentEventsSource, /"Cache-Control": "no-cache, no-transform"/);
  assert.match(agentEventsSource, /"X-Accel-Buffering": "no"/);
});

test("agent SSE reuses one TextEncoder per stream", () => {
  assert.equal((agentEventStreamSource.match(/new TextEncoder\(\)/g) ?? []).length, 1);
  assert.match(agentEventStreamSource, /controller\.enqueue\(encoder\.encode\(/);
});

test("SSE routes clean up safely when the response consumer cancels", () => {
  // The per-agent stream uses a cancelStream helper; the running-id stream
  // keeps the original inline dispose pattern. Both must guard reentry and
  // tolerate an already-closed controller.
  assert.match(agentEventStreamSource, /let cancelStream: \(closeController: boolean\) => void = \(\) => \{\}/);
  assert.match(agentEventStreamSource, /if \(closed\) return/);
  assert.match(agentEventStreamSource, /cancel\(\) \{\s*cancelStream\(false\);/);

  assert.match(runningEventsSource, /let dispose = \(\) => \{\}/);
  assert.match(runningEventsSource, /if \(closed\) return/);
  assert.match(runningEventsSource, /try \{ controller\.close\(\); \} catch/);
  assert.match(runningEventsSource, /cancel\(\) \{\s*dispose\(\);/);
});
