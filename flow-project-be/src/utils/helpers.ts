
export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
};

export const extractDomain = (url: string): string | null => {
  try {
    const { hostname } = new URL(url);
    return hostname.replace('www.', '');
  } catch (e) {
    return null;
  }
};
