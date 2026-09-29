import { useEffect } from 'react';

export const BRAND_NAME = 'FoxTrade';

/**
 * Hook to set the document.title in industry-standard format:
 * "${title} · FoxTrade" (or exact custom title if exact is true)
 */
export function usePageTitle(title, exact = false) {
  useEffect(() => {
    if (!title) {
      document.title = `${BRAND_NAME} — Institutional Trading Journal for Indian Traders`;
    } else {
      document.title = exact ? title : `${title} · ${BRAND_NAME}`;
    }
  }, [title, exact]);
}

export function setPageTitle(title, exact = false) {
  if (!title) {
    document.title = `${BRAND_NAME} — Institutional Trading Journal for Indian Traders`;
  } else {
    document.title = exact ? title : `${title} · ${BRAND_NAME}`;
  }
}
