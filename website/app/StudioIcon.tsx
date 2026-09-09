type IconName = "search" | "scan" | "grid" | "list" | "filter" | "cards" | "arrow";

const paths: Record<IconName, React.ReactNode> = {
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
  scan: <><path d="M8 3H4a1 1 0 0 0-1 1v4m13-5h4a1 1 0 0 1 1 1v4M3 16v4a1 1 0 0 0 1 1h4m8 0h4a1 1 0 0 0 1-1v-4M3 12h18" /><rect x="8" y="7" width="8" height="10" rx="1" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  list: <><rect x="3" y="4" width="5" height="6" rx="1" /><rect x="3" y="14" width="5" height="6" rx="1" /><path d="M12 5h9m-9 4h6m-6 6h9m-9 4h6" /></>,
  filter: <><path d="M3 6h18M3 12h18M3 18h18" /><path d="M8 3v6m8 0v6M7 15v6" /></>,
  cards: <><rect x="8" y="5" width="12" height="16" rx="2" /><path d="M15 2H5a2 2 0 0 0-2 2v12M12 10h4m-4 4h4" /></>,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
};

export default function StudioIcon({ name }: { name: IconName }) {
  return <svg className="studio-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
