/** Load an OpenFEC credential without normalizing, logging, or returning its source. */
export function loadFecApiCredential(env: NodeJS.ProcessEnv): string {
  const credential = env.FEC_API_CREDENTIAL;
  const legacy = env.FEC_API_KEY;
  if (credential && legacy && credential !== legacy)
    throw new Error("FEC_API_CREDENTIAL_CONFLICT");
  const selected = credential ?? legacy;
  if (
    !selected ||
    selected.length > 256 ||
    selected !== selected.trim() ||
    /[\u0000-\u0020\u007f]/.test(selected)
  ) throw new Error("FEC_API_CREDENTIAL_REQUIRED");
  return selected;
}
