const cohorts = [
  { key: "jp-0", branch: "JP", label: "JP・0期生", tag: "#0期生" },
  { key: "jp-1", branch: "JP", label: "JP・1期生", tag: "#1期生" },
  { key: "jp-2", branch: "JP", label: "JP・2期生", tag: "#2期生" },
  { key: "jp-gamers", branch: "JP", label: "JP・Gamers", tag: "#ゲーマーズ" },
  { key: "jp-3", branch: "JP", label: "JP・3期生", tag: "#3期生" },
  { key: "jp-4", branch: "JP", label: "JP・4期生", tag: "#4期生" },
  { key: "jp-5", branch: "JP", label: "JP・5期生", tag: "#5期生" },
  { key: "jp-holox", branch: "JP", label: "JP・holoX（6期生）", tag: "#秘密結社holoX" },
  { key: "jp-special", branch: "JP", label: "JP・跨世代組合" },
  { key: "dev-regloss", branch: "DEV_IS", label: "DEV_IS・ReGLOSS", tag: "#ReGLOSS" },
  { key: "dev-flow-glow", branch: "DEV_IS", label: "DEV_IS・FLOW GLOW", tag: "#FLOW GLOW" },
  { key: "dev-other", branch: "DEV_IS", label: "DEV_IS・其他" },
  { key: "en-myth", branch: "EN", label: "EN・Myth（1期生）", tag: "#Myth" },
  { key: "en-promise", branch: "EN", label: "EN・Promise", tag: "#Promise" },
  { key: "en-advent", branch: "EN", label: "EN・Advent（3期生）", tag: "#Advent" },
  { key: "en-justice", branch: "EN", label: "EN・Justice（4期生）", tag: "#Justice" },
  { key: "en-other", branch: "EN", label: "EN・其他" },
  { key: "id-1", branch: "ID", label: "ID・1期生", tag: "#ID1期生" },
  { key: "id-2", branch: "ID", label: "ID・2期生", tag: "#ID2期生" },
  { key: "id-3", branch: "ID", label: "ID・3期生", tag: "#ID3期生" },
  { key: "id-other", branch: "ID", label: "ID・其他" },
];

function branchFor(tags) {
  if (tags.has("#DEV_IS")) return "DEV_IS";
  if (tags.has("#EN")) return "EN";
  if (tags.has("#ID")) return "ID";
  return "JP";
}

function cohortFor(originalName, tags) {
  const branch = branchFor(tags);
  if (branch === "JP" && originalName === "ラムダック") return "jp-special";

  const matched = cohorts.find(
    (cohort) => cohort.branch === branch && cohort.tag && tags.has(cohort.tag),
  );
  if (matched) return matched.key;

  if (branch === "DEV_IS") return "dev-other";
  if (branch === "EN") return "en-other";
  if (branch === "ID") return "id-other";
  return "jp-special";
}

export function groupMemberOptions(cards) {
  const members = new Map();

  for (const card of cards) {
    if (card.group !== "oshi" && card.group !== "holomem") continue;
    const originalName = (card.jpName || card.name || "").trim();
    if (!originalName) continue;

    const current = members.get(originalName) || {
      displayName: (card.name || originalName).trim(),
      tags: new Set(),
    };
    if (current.displayName === originalName && card.name) current.displayName = card.name.trim();
    for (const tag of card.tags || []) current.tags.add(tag);
    members.set(originalName, current);
  }

  const grouped = new Map(cohorts.map((cohort) => [cohort.key, []]));
  for (const [value, member] of members) {
    const key = cohortFor(value, member.tags);
    grouped.get(key).push({
      value,
      displayName: member.displayName,
      label: member.displayName === value ? member.displayName : `${member.displayName}（${value}）`,
    });
  }

  return cohorts
    .map((cohort) => ({
      key: cohort.key,
      label: cohort.label,
      options: grouped
        .get(cohort.key)
        .sort((left, right) => left.displayName.localeCompare(right.displayName, "zh-Hant")),
    }))
    .filter((group) => group.options.length > 0);
}
