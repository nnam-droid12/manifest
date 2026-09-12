// Real, public FMCSA SAFER Company Snapshot lookup — the same government
// database a human fraud investigator would actually check by hand. Opens in
// a new tab on user request; browsers block truly script-initiated tab opens
// outside a direct click, so this is always a real button, not an automatic
// popup.
export function extractMcNumber(text: string): string | null {
  const m = text.match(/MC-(\d+)/);
  return m ? m[1] : null;
}

export function saferSnapshotUrl(mcNumber: string): string {
  const params = new URLSearchParams({
    searchtype: "ANY",
    query_type: "queryCarrierSnapshot",
    query_param: "MC_MX",
    query_string: mcNumber,
  });
  return `https://safer.fmcsa.dot.gov/query.asp?${params.toString()}`;
}
