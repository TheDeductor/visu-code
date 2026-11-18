import React from 'react';

/**
 * VisuCode icon set: hand-authored 24x24 stroke geometry (Lucide-style language).
 * One stroke width, one grid, no dependency.
 */
export type IconName =
  | 'menu'
  | 'close'
  | 'search'
  | 'refresh'
  | 'settings'
  | 'download'
  | 'help'
  | 'chevronDown'
  | 'chevronLeft'
  | 'chevronRight'
  | 'panelLeftClose'
  | 'panelRightOpen'
  | 'plus'
  | 'minus'
  | 'check'
  | 'lock'
  | 'key'
  | 'arrowUpRight'
  | 'arrowLeft'
  | 'arrowRight'
  | 'arrowLeftRight'
  | 'pencil'
  | 'clock'
  | 'history'
  | 'circleDot'
  | 'circleDashed'
  | 'square'
  | 'table'
  | 'fileCode'
  | 'fit'
  | 'zoomIn'
  | 'zoomOut'
  | 'alert'
  | 'info'
  | 'inbox'
  | 'eye'
  | 'copy'
  | 'more'
  | 'play'
  | 'pause';

const glyphs: Record<IconName, React.ReactNode> = {
  menu: (
    <>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </>
  ),
  close: (
    <>
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-3.6-3.6" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11a8 8 0 1 0-2.3 6" />
      <path d="M20 5v6h-6" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h9" />
      <path d="M17 7h3" />
      <path d="M4 12h3" />
      <path d="M11 12h9" />
      <path d="M4 17h9" />
      <path d="M17 17h3" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="15" cy="17" r="2" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11" />
      <path d="M7.5 10.5 12 15l4.5-4.5" />
      <path d="M4 19h16" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.4a2.4 2.4 0 1 1 3.1 2.3c-.5.2-.7.6-.7 1.1v.5" />
      <path d="M12 16.4h.01" />
    </>
  ),
  chevronDown: <path d="M6 9.5 12 15l6-5.5" />,
  chevronLeft: <path d="M14.5 5 8 12l6.5 7" />,
  chevronRight: <path d="M9.5 5 16 12l-6.5 7" />,
  panelLeftClose: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
      <path d="M16 9.5 13 12l3 2.5" />
    </>
  ),
  panelRightOpen: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M15 4v16" />
      <path d="M8 9.5 11 12l-3 2.5" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  minus: <path d="M5 12h14" />,
  check: <path d="M20 6.5 9.5 17 4 11.5" />,
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15.5" r="3.2" />
      <path d="M10.4 13.2 18 5.6" />
      <path d="M15.4 4.6 19.4 8.6" />
      <path d="M13 7l3 3" />
    </>
  ),
  arrowUpRight: (
    <>
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </>
  ),
  arrowLeft: (
    <>
      <path d="M19 12H5" />
      <path d="M11 6l-6 6 6 6" />
    </>
  ),
  arrowRight: (
    <>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </>
  ),
  arrowLeftRight: (
    <>
      <path d="M8 4 4 8l4 4" />
      <path d="M4 8h16" />
      <path d="M16 20l4-4-4-4" />
      <path d="M20 16H4" />
    </>
  ),
  pencil: (
    <>
      <path d="M12 20h8" />
      <path d="M16.4 3.6a2 2 0 0 1 2.9 2.9L7.5 18.3 3.6 19.4l1.1-3.9Z" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.4V12l3 1.9" />
    </>
  ),
  history: (
    <>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
      <path d="M3.2 3.8v5h5" />
      <path d="M12 8v4.2l2.8 1.7" />
    </>
  ),
  circleDot: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="2.4" />
    </>
  ),
  circleDashed: (
    <>
      <path d="M12 3.5v2.2" />
      <path d="M12 18.3v2.2" />
      <path d="M3.5 12h2.2" />
      <path d="M18.3 12h2.2" />
      <path d="M6 6l1.6 1.6" />
      <path d="M16.4 16.4 18 18" />
      <path d="M18 6l-1.6 1.6" />
      <path d="M7.6 16.4 6 18" />
    </>
  ),
  square: <rect x="4.5" y="4.5" width="15" height="15" rx="2" />,
  table: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <path d="M3 9.5h18" />
      <path d="M9 9.5v10" />
      <path d="M3 14.5h18" />
    </>
  ),
  fileCode: (
    <>
      <path d="M14 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3.5V8h4.5" />
      <path d="M10.4 12.4 8.6 14.2l1.8 1.8" />
      <path d="M13.6 12.4l1.8 1.8-1.8 1.8" />
    </>
  ),
  fit: (
    <>
      <path d="M8.5 3.5H5.5a2 2 0 0 0-2 2v3" />
      <path d="M15.5 3.5h3a2 2 0 0 1 2 2v3" />
      <path d="M20.5 15.5v3a2 2 0 0 1-2 2h-3" />
      <path d="M8.5 20.5h-3a2 2 0 0 1-2-2v-3" />
    </>
  ),
  zoomIn: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-3.6-3.6" />
      <path d="M11 8.4v5.2" />
      <path d="M8.4 11h5.2" />
    </>
  ),
  zoomOut: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-3.6-3.6" />
      <path d="M8.4 11h5.2" />
    </>
  ),
  alert: (
    <>
      <path d="M10.3 4.3 2.6 18a1.9 1.9 0 0 0 1.7 2.8h15.4a1.9 1.9 0 0 0 1.7-2.8L13.7 4.3a1.9 1.9 0 0 0-3.4 0Z" />
      <path d="M12 9.5v4" />
      <path d="M12 17h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </>
  ),
  inbox: (
    <>
      <path d="M3.5 12.5h4l1.5 2.5h6l1.5-2.5h4" />
      <path d="M5.4 4.8h13.2a1.8 1.8 0 0 1 1.7 1.2l2.2 6.5v5.7a1.8 1.8 0 0 1-1.8 1.8H4.3a1.8 1.8 0 0 1-1.8-1.8v-5.7l2.2-6.5a1.8 1.8 0 0 1 1.7-1.2Z" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.7" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M15 5.5V5a2 2 0 0 0-2-2H5.5a2 2 0 0 0-2 2V13a2 2 0 0 0 2 2H6" />
    </>
  ),
  more: (
    <>
      <path d="M6 12h.01" />
      <path d="M12 12h.01" />
      <path d="M18 12h.01" />
    </>
  ),
  play: <path d="M8 5.5 18.5 12 8 18.5Z" />,
  pause: (
    <>
      <path d="M9 5.5v13" />
      <path d="M15 5.5v13" />
    </>
  ),
};

export function Icon({
  name,
  size = 16,
  strokeWidth = 1.5,
  className,
}: {
  name: IconName;
  size?: 14 | 16 | 18 | 20 | 24;
  strokeWidth?: number;
  className?: string;
}): React.ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {glyphs[name]}
    </svg>
  );
}

export function mapTypeIcon(type: string, level?: string): IconName {
  if (type === 'sequence') return 'arrowLeftRight';
  if (type === 'erd') return 'table';
  if (type === 'mermaid') return 'fileCode';
  if (level === 'overview') return 'circleDot';
  if (level === 'detail') return 'circleDashed';
  return 'square';
}

/** VisuCode mark: black V stroke with three violet bars. */
export function VisuCodeMark({ height = 20, className }: { height?: number; className?: string }): React.ReactElement {
  const width = Math.round(((height * 620) / 384) * 100) / 100;
  return (
    <svg
      viewBox="0 0 620 384"
      width={width}
      height={height}
      className={className}
      role="img"
      aria-label="VisuCode"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g strokeLinejoin="round" strokeWidth={6}>
        <polygon fill="#15161A" stroke="#15161A" points="13,0 153,0 359,381 198,384 168,367 1,22" />
        <polygon fill="#6C4CF1" stroke="#6C4CF1" points="368,0 603,0 620,20 581,104 310,104 351,10" />
        <polygon fill="#A78BFA" stroke="#A78BFA" points="310,135 551,135 559,144 518,236 508,239 295,239 283,195" />
        <polygon fill="#DCD2FB" stroke="#DCD2FB" points="321,269 488,269 496,280 453,372 439,383 380,383 371,374 323,277" />
      </g>
    </svg>
  );
}
