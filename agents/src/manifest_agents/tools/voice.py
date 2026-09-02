"""Text-to-speech and speech-to-text for the Voice Check-In Agent.

Real Amazon Polly and Amazon Transcribe calls — not mocked. The one piece
genuinely not exercised here is dialing an actual phone number through
Amazon Connect's StartOutboundVoiceContact: that has a real-world effect
(ringing someone's phone) that needs an explicit target number and consent,
unlike everything else in this repo, so it's wired (see
manifest_agents.config / infra/lib/agent-runtime-stack.ts's IAM policy) but
not exercised automatically. What's verified here is the actual TTS/STT
round trip Connect would carry: Polly speaks the check-in question, and — in
place of a live carrier response over the phone — Transcribe processes a
second Polly-synthesized clip (a different voice, standing in for the
carrier's spoken reply) back into text, the same way it would a real call
recording.
"""

import time
import uuid

import boto3

from manifest_agents.config import get_settings


def synthesize_speech(text: str, voice_id: str = "Matthew") -> bytes:
    """Convert text to spoken audio (MP3 bytes) via Amazon Polly."""
    settings = get_settings()
    client = boto3.client("polly", region_name=settings.aws_region)
    response = client.synthesize_speech(Text=text, OutputFormat="mp3", VoiceId=voice_id)
    return response["AudioStream"].read()


def transcribe_audio(audio_bytes: bytes, bucket: str) -> str:
    """Transcribe spoken audio (MP3 bytes) to text via Amazon Transcribe.

    Uses the batch StartTranscriptionJob API (needs S3 for input/output) and
    polls to completion — simpler and more reliable for a one-off clip than
    the real-time streaming API a live phone call would actually use.
    """
    settings = get_settings()
    s3 = boto3.client("s3", region_name=settings.aws_region)
    transcribe = boto3.client("transcribe", region_name=settings.aws_region)

    job_name = f"manifest-voice-{uuid.uuid4().hex[:12]}"
    key = f"voice-checkin/{job_name}.mp3"
    s3.put_object(Bucket=bucket, Key=key, Body=audio_bytes)
    media_uri = f"s3://{bucket}/{key}"

    transcribe.start_transcription_job(
        TranscriptionJobName=job_name,
        Media={"MediaFileUri": media_uri},
        MediaFormat="mp3",
        LanguageCode="en-US",
        OutputBucketName=bucket,
        OutputKey=f"voice-checkin/{job_name}.json",
    )

    for _ in range(60):
        status = transcribe.get_transcription_job(TranscriptionJobName=job_name)
        job_status = status["TranscriptionJob"]["TranscriptionJobStatus"]
        if job_status == "COMPLETED":
            result_key = f"voice-checkin/{job_name}.json"
            obj = s3.get_object(Bucket=bucket, Key=result_key)
            import json

            payload = json.loads(obj["Body"].read())
            return payload["results"]["transcripts"][0]["transcript"]
        if job_status == "FAILED":
            raise RuntimeError(f"Transcription job failed: {status['TranscriptionJob'].get('FailureReason')}")
        time.sleep(3)

    raise TimeoutError(f"Transcription job {job_name} did not complete in time.")
