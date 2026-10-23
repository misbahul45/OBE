const fileRefPattern = /^[A-Za-z0-9_-]{1,80}:[A-Za-z0-9-]{8,64}$/;

export const newFileRef = (actorId: string, token: string) => `${actorId}:${token}`;

export const isOwnedFileRef = (ref: string, actorId: string) => fileRefPattern.test(ref) && ref.startsWith(`${actorId}:`);
