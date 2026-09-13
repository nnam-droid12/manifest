import { RekognitionClient, DetectLabelsCommand } from "@aws-sdk/client-rekognition";

const REGION = process.env.AWS_REGION || "us-east-1";
const client = new RekognitionClient({ region: REGION });

interface AnalyzeRequest {
  image: string; // base64, no data: prefix
}

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export const handler = async (event: any) => {
  let req: AnalyzeRequest;
  try {
    req = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "invalid JSON body" });
  }

  if (!req.image) {
    return json(400, { error: "missing 'image' (base64)" });
  }

  try {
    const bytes = Buffer.from(req.image, "base64");
    if (bytes.length > 5_000_000) {
      return json(400, { error: "image too large (max 5MB)" });
    }

    const resp = await client.send(
      new DetectLabelsCommand({
        Image: { Bytes: bytes },
        MaxLabels: 20,
        MinConfidence: 55,
      })
    );

    const labels = (resp.Labels || []).map((l) => ({
      name: l.Name,
      confidence: l.Confidence,
      instances: (l.Instances || [])
        .filter((i) => i.BoundingBox)
        .map((i) => ({
          left: i.BoundingBox!.Left,
          top: i.BoundingBox!.Top,
          width: i.BoundingBox!.Width,
          height: i.BoundingBox!.Height,
          confidence: i.Confidence,
        })),
    }));

    return json(200, { labels });
  } catch (err) {
    console.error(err);
    return json(500, { error: err instanceof Error ? err.message : String(err) });
  }
};
