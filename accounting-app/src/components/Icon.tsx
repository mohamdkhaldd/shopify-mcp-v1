interface IconProps {
  name: string;
  className?: string;
}

// Minimal hand-rolled line icon set (no external icon library needed).
const paths: Record<string, JSX.Element> = {
  home: (
    <path d="M4 11.5 12 5l8 6.5M6 10v9h12v-9M10 19v-5h4v5" />
  ),
  equipment: (
    <path d="M4 19h16M6 19V9l4-3 4 3v10M14 19v-6h4v6M9 12h2" />
  ),
  salaries: (
    <path d="M12 3v18M17 7.5c0-1.9-2.2-3-5-3s-5 1.2-5 3 2.2 2.6 5 3 5 1.1 5 3-2.2 3-5 3-5-1.1-5-3" />
  ),
  hassan: (
    <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0" />
  ),
  contractors: (
    <path d="M3 21h18M6 21V10l6-5 6 5v11M10 21v-6h4v6" />
  ),
  partners: (
    <path d="M8 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM16 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 21a6 6 0 0 1 12 0M14 15.5a6 6 0 0 1 8 5.5" />
  ),
  treasury: (
    <path d="M3 7h18v12H3zM3 7l9-4 9 4M12 12a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z" />
  ),
  suppliers: (
    <path d="M3 9h18l-2 11H5L3 9ZM3 9l1.5-4h15L21 9M9 13v4M15 13v4" />
  ),
  reports: (
    <path d="M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-7" />
  ),
  settings: (
    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 13.5a1.7 1.7 0 0 0 .35 1.9l.06.06a2 2 0 1 1-2.9 2.9l-.06-.06a1.7 1.7 0 0 0-1.9-.35 1.7 1.7 0 0 0-1 1.55V20a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.9.35l-.06.06a2 2 0 1 1-2.9-2.9l.06-.06a1.7 1.7 0 0 0 .35-1.9 1.7 1.7 0 0 0-1.55-1H4a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.35-1.9l-.06-.06a2 2 0 1 1 2.9-2.9l.06.06a1.7 1.7 0 0 0 1.9.35H10a1.7 1.7 0 0 0 1-1.55V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.9-.35l.06-.06a2 2 0 1 1 2.9 2.9l-.06.06a1.7 1.7 0 0 0-.35 1.9V10a1.7 1.7 0 0 0 1.55 1H20a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.55 1Z" />
  ),
  trendUp: <path d="M4 15l5-5 4 4 7-7M14 6h6v6" />,
  trendDown: <path d="M4 8l5 5 4-4 7 7M14 17h6v-6" />,
  sun: (
    <path d="M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" />
  ),
  moon: <path d="M20.5 14.5a8.5 8.5 0 1 1-9-11 7 7 0 0 0 9 11Z" />,
  flow: <path d="M3 8h13l-3.5-3.5M21 16H8l3.5 3.5" />,
  waste: (
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
  ),
};

export default function Icon({ name, className = "w-5 h-5" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {paths[name] ?? paths.home}
    </svg>
  );
}
