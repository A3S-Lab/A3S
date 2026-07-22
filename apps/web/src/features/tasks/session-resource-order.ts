export interface SessionResourceRequest {
  sessionId: string;
  version: number;
}

const messageRequestVersions = new Map<string, number>();
const controlsRequestVersions = new Map<string, number>();

function beginRequest(versions: Map<string, number>, sessionId: string): SessionResourceRequest {
  const version = (versions.get(sessionId) ?? 0) + 1;
  versions.set(sessionId, version);
  return { sessionId, version };
}

function isCurrent(versions: Map<string, number>, request: SessionResourceRequest): boolean {
  return versions.get(request.sessionId) === request.version;
}

export function beginSessionMessagesRequest(sessionId: string): SessionResourceRequest {
  return beginRequest(messageRequestVersions, sessionId);
}

export function invalidateSessionMessagesRequests(sessionId: string): void {
  beginSessionMessagesRequest(sessionId);
}

export function isSessionMessagesRequestCurrent(request: SessionResourceRequest): boolean {
  return isCurrent(messageRequestVersions, request);
}

export function beginSessionControlsRequest(sessionId: string): SessionResourceRequest {
  return beginRequest(controlsRequestVersions, sessionId);
}

export function invalidateSessionControlsRequests(sessionId: string): SessionResourceRequest {
  return beginSessionControlsRequest(sessionId);
}

export function isSessionControlsRequestCurrent(request: SessionResourceRequest): boolean {
  return isCurrent(controlsRequestVersions, request);
}
