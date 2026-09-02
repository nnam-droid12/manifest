"""Document text/field extraction via Amazon Textract — real API, not mocked.

Reads a local document file (PNG/JPEG/PDF — a single page for the synchronous
API used here) and returns the extracted lines and detected form key/value
pairs. Production documents arrive via email/upload into S3 (see
infra/lib/data-stack.ts, documentsBucket) — this tool works the same way
against S3-sourced bytes, it just takes a local path for local dev/demo.
"""

from pathlib import Path

import boto3
from botocore.exceptions import ClientError

from strands import tool

from manifest_agents.config import get_settings


@tool
def extract_document_fields(file_path: str) -> dict:
    """Extract text lines and form key/value pairs from a document image via Textract.

    Args:
        file_path: Path to a local PNG, JPEG, or single-page PDF.

    Returns:
        {"lines": [...], "fields": {key: value, ...}} on success, or an
        "error" key if the file is missing or Textract couldn't process it.
    """
    path = Path(file_path)
    if not path.exists():
        return {"error": f"File not found: {file_path}"}

    settings = get_settings()
    client = boto3.client("textract", region_name=settings.aws_region)

    try:
        response = client.analyze_document(
            Document={"Bytes": path.read_bytes()},
            FeatureTypes=["FORMS"],
        )
    except ClientError as e:
        return {"error": f"Textract request failed: {e.response['Error']['Message']}"}

    blocks_by_id = {b["Id"]: b for b in response["Blocks"]}
    lines = [b["Text"] for b in response["Blocks"] if b["BlockType"] == "LINE"]

    def block_text(block: dict) -> str:
        parts = []
        for rel in block.get("Relationships", []):
            if rel["Type"] != "CHILD":
                continue
            for child_id in rel["Ids"]:
                child = blocks_by_id[child_id]
                if child["BlockType"] == "WORD":
                    parts.append(child["Text"])
                elif child["BlockType"] == "SELECTION_ELEMENT":
                    parts.append("[X]" if child["SelectionStatus"] == "SELECTED" else "[ ]")
        return " ".join(parts)

    fields = {}
    for block in response["Blocks"]:
        if block["BlockType"] != "KEY_VALUE_SET" or "KEY" not in block.get("EntityTypes", []):
            continue
        key_text = block_text(block).strip().rstrip(":")
        value_text = ""
        for rel in block.get("Relationships", []):
            if rel["Type"] != "VALUE":
                continue
            for value_id in rel["Ids"]:
                value_text = block_text(blocks_by_id[value_id]).strip()
        if key_text:
            fields[key_text] = value_text

    return {"lines": lines, "fields": fields}
