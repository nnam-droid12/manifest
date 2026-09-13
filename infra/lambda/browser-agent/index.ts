import { PlaywrightBrowser } from "bedrock-agentcore/browser/playwright";
import { RekognitionClient, DetectTextCommand } from "@aws-sdk/client-rekognition";
import { ComprehendClient, DetectSyntaxCommand } from "@aws-sdk/client-comprehend";
import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";

const REGION = process.env.AWS_REGION || "us-east-1";
const rekognition = new RekognitionClient({ region: REGION });
const comprehend = new ComprehendClient({ region: REGION });
const polly = new PollyClient({ region: REGION });

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
interface ReadPriceRequest {
  action: "readPrice";
  sessionId: string;
  url: string;
}
interface ExtractItemRequest {
  action: "extractItem";
  text: string;
}
interface SpeakRequest {
  action: "speak";
  text: string;
}
type Request =
  | StartRequest
  | NavigateRequest
  | StopRequest
  | ReadPriceRequest
  | ExtractItemRequest
  | SpeakRequest;

const PRICE_PATTERN = /\$\s?\d{1,5}(?:,\d{3})*(?:\.\d{2})?/g;

// Trigger prepositions/determiners that introduce the thing being asked
// about in a spoken request like "open amazon with a ring camera" or
// "check the price of the industrial generator" -- Comprehend's DetectText
// entity types (ORGANIZATION, COMMERCIAL_ITEM, etc.) don't reliably tag
// everyday product phrases like "ring camera", so this walks the real
// DetectSyntax POS tags instead: find one of these trigger words, skip any
// determiner right after it, then take the run of NOUN/ADJ/PROPN tokens
// that follows as the item phrase.
const TRIGGER_WORDS = new Set(["with", "for", "of", "about"]);
const PHRASE_TAGS = new Set(["NOUN", "ADJ", "PROPN"]);

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

    if (req.action === "readPrice") {
      const browser = new PlaywrightBrowser({ region: REGION });
      browser.attachSession(req.sessionId);
      await browser.navigate({ url: req.url, waitUntil: "domcontentloaded", timeout: 20000 });
      // Let images/prices actually render before capturing -- domcontentloaded
      // fires before most product-grid content has painted.
      await new Promise((r) => setTimeout(r, 3000));
      const screenshot = await browser.screenshot({ encoding: "base64", type: "png" });
      const bytes = Buffer.from(screenshot as string, "base64");

      const detect = await rekognition.send(new DetectTextCommand({ Image: { Bytes: bytes } }));
      const lines = (detect.TextDetections || [])
        .filter((d) => d.Type === "LINE")
        .map((d) => d.DetectedText || "");

      const prices = new Set<string>();
      for (const line of lines) {
        const matches = line.match(PRICE_PATTERN);
        if (matches) matches.forEach((m) => prices.add(m.replace(/\s/g, "")));
      }

      return json(200, { ok: true, prices: [...prices], sampleText: lines.slice(0, 20) });
    }

    if (req.action === "stop") {
      const browser = new PlaywrightBrowser({ region: REGION });
      browser.attachSession(req.sessionId);
      await browser.stopSession();
      return json(200, { ok: true });
    }

    if (req.action === "extractItem") {
      const syntax = await comprehend.send(
        new DetectSyntaxCommand({ LanguageCode: "en", Text: req.text })
      );
      const tokens = syntax.SyntaxTokens || [];

      let item: string | null = null;
      for (let i = 0; i < tokens.length; i++) {
        const word = (tokens[i].Text || "").toLowerCase();
        if (!TRIGGER_WORDS.has(word)) continue;

        let j = i + 1;
        if (tokens[j] && tokens[j].PartOfSpeech?.Tag === "DET") j++;

        const phraseTokens: string[] = [];
        while (tokens[j] && PHRASE_TAGS.has(tokens[j].PartOfSpeech?.Tag || "")) {
          phraseTokens.push(tokens[j].Text || "");
          j++;
        }
        if (phraseTokens.length > 0) {
          item = phraseTokens.join(" ");
          break;
        }
      }

      // Fall back to the longest run of NOUN/ADJ/PROPN tokens anywhere in
      // the sentence if no trigger word matched (covers phrasing like
      // "ring camera price on amazon" with no leading preposition).
      if (!item) {
        let best: string[] = [];
        let current: string[] = [];
        for (const tok of tokens) {
          if (PHRASE_TAGS.has(tok.PartOfSpeech?.Tag || "")) {
            current.push(tok.Text || "");
          } else {
            if (current.length > best.length) best = current;
            current = [];
          }
        }
        if (current.length > best.length) best = current;
        if (best.length > 0) item = best.join(" ");
      }

      return json(200, { ok: true, item });
    }

    if (req.action === "speak") {
      const speech = await polly.send(
        new SynthesizeSpeechCommand({
          Text: req.text,
          OutputFormat: "mp3",
          VoiceId: "Joanna",
          Engine: "neural",
        })
      );
      const bytes = await speech.AudioStream?.transformToByteArray();
      const audioBase64 = bytes ? Buffer.from(bytes).toString("base64") : null;
      return json(200, { ok: true, audioBase64 });
    }

    return json(400, { error: "unknown action" });
  } catch (err) {
    console.error(err);
    return json(500, { error: err instanceof Error ? err.message : String(err) });
  }
};
