import { PlaywrightBrowser } from "bedrock-agentcore/browser/playwright";

const REGION = process.env.AWS_REGION || "us-east-1";

interface StartRequest {
  action: "start";
}
interface NavigateRequest {
  action: "navigate";
  sessionId: string;
  url: string;
}
interface StopRequest {
  action: "stop";
  sessionId: string;
}
type Request = StartRequest | NavigateRequest | StopRequest;

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export const handler = async (event: any) => {
  let req: Request;
  try {
    req = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "invalid JSON body" });
  }

  try {
    if (req.action === "start") {
      const browser = new PlaywrightBrowser({ region: REGION });
      const session = await browser.startSession({
        sessionName: `manifest-fraud-verify-${Date.now()}`,
        timeout: 300,
        viewport: { width: 1280, height: 800 },
      });
      const liveViewUrl = await browser.generateLiveViewUrl(280);
      return json(200, { sessionId: session.sessionId, liveViewUrl, remoteWidth: 1280, remoteHeight: 800 });
    }

    if (req.action === "navigate") {
      const browser = new PlaywrightBrowser({ region: REGION });
      browser.attachSession(req.sessionId);
      await browser.navigate({ url: req.url, waitUntil: "domcontentloaded", timeout: 20000 });
      return json(200, { ok: true });
    }

    if (req.action === "stop") {
      const browser = new PlaywrightBrowser({ region: REGION });
      browser.attachSession(req.sessionId);
      await browser.stopSession();
      return json(200, { ok: true });
    }

    return json(400, { error: "unknown action" });
  } catch (err) {
    console.error(err);
    return json(500, { error: err instanceof Error ? err.message : String(err) });
  }
};
