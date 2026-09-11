const typing = new Map<string, { fan?: Date; team?: Date }>();

export function setTyping(conversationId: string, sender: "fan" | "team") {
  const entry = typing.get(conversationId) ?? {};
  entry[sender] = new Date();
  typing.set(conversationId, entry);
}

export function clearTyping(conversationId: string, sender: "fan" | "team") {
  const entry = typing.get(conversationId);
  if (!entry) return;
  delete entry[sender];
  if (!entry.fan && !entry.team) {
    typing.delete(conversationId);
  }
}

export function getTyping(conversationId: string): { fanTyping: boolean; teamTyping: boolean } {
  const entry = typing.get(conversationId);
  if (!entry) return { fanTyping: false, teamTyping: false };
  const now = Date.now();
  const threshold = 3000;
  return {
    fanTyping: entry.fan ? now - entry.fan.getTime() < threshold : false,
    teamTyping: entry.team ? now - entry.team.getTime() < threshold : false,
  };
}
