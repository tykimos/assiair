/**
 * Capture URL query parameters from the current page URL.
 * If captureKeys is empty, captures all parameters.
 * keyMapping renames captured keys (e.g., { "t": "userToken" }).
 */
export function captureUrlParams(
  captureKeys: string[],
  keyMapping: Record<string, string>
): Record<string, string> {
  if (typeof window === 'undefined') return {};

  const params = new URLSearchParams(window.location.search);
  const result: Record<string, string> = {};

  if (captureKeys.length === 0) {
    // Capture all parameters
    params.forEach((value, key) => {
      const mappedKey = keyMapping[key] || key;
      result[mappedKey] = value;
    });
  } else {
    // Capture only specified keys
    for (const key of captureKeys) {
      const value = params.get(key);
      if (value !== null) {
        const mappedKey = keyMapping[key] || key;
        result[mappedKey] = value;
      }
    }
  }

  return result;
}
