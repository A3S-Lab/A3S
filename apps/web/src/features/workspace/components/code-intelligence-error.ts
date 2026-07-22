import { ApiError } from '../../../lib/api';

const unsupportedErrorCode = 'CODE_INTELLIGENCE_UNSUPPORTED';

export function isUnsupportedCodeIntelligenceError(error: unknown): boolean {
  return unsupportedErrorDetails(error) !== null;
}

export function isUnsupportedCodeIntelligenceLanguageError(error: unknown): boolean {
  const details = unsupportedErrorDetails(error);
  if (!details) return false;
  if (details.operation === 'language') return true;

  const message = details.message;
  if (typeof message !== 'string') return false;
  const normalizedMessage = message.startsWith(`${unsupportedErrorCode}: `)
    ? message.slice(unsupportedErrorCode.length + 2)
    : message;
  return normalizedMessage.startsWith("Code Intelligence operation 'language' is unsupported:");
}

function unsupportedErrorDetails(error: unknown): Record<string, unknown> | null {
  if (!(error instanceof ApiError) || error.status !== 501 || !isRecord(error.details)) return null;

  const statusCode = error.details.statusCode;
  if (statusCode === unsupportedErrorCode) return error.details;

  const message = error.details.message;
  return typeof message === 'string' && message.startsWith(`${unsupportedErrorCode}:`) ? error.details : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}
