# UI Component Inventory

| Page | Element | Current Implementation (file:line) | Astryx Component | Status |
|---|---|---|---|---|
| Maps (TopBar) | VM Brand Logo & Title | viewer/src/components/TopBar.tsx:58 | GAP | gap |
| Maps (TopBar) | Navigation Tabs (Maps, Changes, Timeline, Phases, Notes, Coverage) | viewer/src/components/TopBar.tsx:76 | TabList, Tab | migrated |
| Maps (TopBar) | Search Icon Button | viewer/src/components/TopBar.tsx:84 | Button | migrated |
| Maps (TopBar) | Validation Problems Pill (warnings/errors count) | viewer/src/components/TopBar.tsx:87 | Badge | migrated |
| Maps (TopBar) | Live WebSocket Status Dot | viewer/src/components/TopBar.tsx:91 | StatusDot | migrated |
| Maps (TopBar) | Beginner Mode Toggle Chip | viewer/src/components/TopBar.tsx:92 | Switch | migrated |
| Maps (TopBar) | View / Edit Segmented Control | viewer/src/components/TopBar.tsx:95 | SegmentedControl | migrated |
| Maps (TopBar) | Export Menu Trigger & Dropdown | viewer/src/components/TopBar.tsx:103 | DropdownMenu | migrated |
| Maps (TopBar) | Refresh Button | viewer/src/components/TopBar.tsx:122 | Button | migrated |
| Maps (TopBar) | Keyboard Shortcuts Help Button | viewer/src/components/TopBar.tsx:125 | Button | migrated |
| Maps (TopBar) | Settings Button | viewer/src/components/TopBar.tsx:128 | Button | migrated |
| Maps (Sidebar) | Map Filter Input | viewer/src/components/Sidebar.tsx:48 | TextInput | migrated |
| Maps (Sidebar) | Clear Filter Button | viewer/src/components/Sidebar.tsx:50 | Button | migrated |
| Maps (Sidebar) | New Map Button | viewer/src/components/Sidebar.tsx:55 | Button | migrated |
| Maps (Sidebar) | Map Tree Folder Label | viewer/src/components/Sidebar.tsx:62 | GAP | gap |
| Maps (Sidebar) | Map Row Item | viewer/src/components/Sidebar.tsx:66 | GAP | gap |
| Maps (Sidebar) | Stale Map Indicator Dot | viewer/src/components/Sidebar.tsx:81 | StatusDot | migrated |
| Maps (Sidebar) | Drift Pending Dot | viewer/src/components/Sidebar.tsx:86 | StatusDot | migrated |
| Maps (Sidebar) | Map Errors / Warnings Badge | viewer/src/components/Sidebar.tsx:90 | Badge | migrated |
| Maps (Sidebar) | Coverage Progress Bar | viewer/src/components/Sidebar.tsx:107 | ProgressBar | migrated |
| Maps (Sidebar) | Bootstrap Maps Button | viewer/src/components/Sidebar.tsx:112 | Button | migrated |
| Maps (Sidebar) | Version Footer Text | viewer/src/components/Sidebar.tsx:119 | Text | migrated |
| Maps (Overlays) | Pending Map Update Banner | viewer/src/App.tsx:1136 | Banner | migrated |
| Maps (Overlays) | Map Error Banner | viewer/src/App.tsx:1147 | Banner | migrated |
| Maps (Overlays) | History Viewing Banner | viewer/src/App.tsx:1156 | Banner | migrated |
| Maps (Overlays) | Phase Filter Active Banner | viewer/src/App.tsx:1179 | Banner | migrated |
| Maps (Overlays) | Canvas Edit Toolbar Container | viewer/src/App.tsx:1213 | Toolbar | migrated |
| Maps (Overlays) | Add Node Toolbar Button | viewer/src/App.tsx:1214 | Button | migrated |
| Maps (Overlays) | Connect Toolbar Toggle Button | viewer/src/App.tsx:1217 | ToggleButton | migrated |
| Maps (Overlays) | Sticky Note Toolbar Button | viewer/src/App.tsx:1227 | Button | migrated |
| Maps (Overlays) | Reset Layout Toolbar Button | viewer/src/App.tsx:1230 | Button | migrated |
| Maps (Overlays) | Done Edit Toolbar Button | viewer/src/App.tsx:1233 | Button | migrated |
| Maps (Overlays) | Walkthrough Step Counter | viewer/src/App.tsx:1240 | Text | migrated |
| Maps (Overlays) | Walkthrough Text | viewer/src/App.tsx:1243 | Text | migrated |
| Maps (Overlays) | Walkthrough Previous Button | viewer/src/App.tsx:1245 | Button | migrated |
| Maps (Overlays) | Walkthrough Play / Pause Button | viewer/src/App.tsx:1248 | Button | migrated |
| Maps (Overlays) | Walkthrough Next Button | viewer/src/App.tsx:1251 | Button | migrated |
| Maps (Overlays) | Walkthrough Close Button | viewer/src/App.tsx:1254 | Button | migrated |
| Maps (Overlays) | Bottom Panel Tab Switchers (Problems / Activity) | viewer/src/App.tsx:1264 | TabList, Tab | migrated |
| Maps (Overlays) | Bottom Panel Close Button | viewer/src/App.tsx:1272 | Button | migrated |
| Maps (Overlays) | Zoom In Button | viewer/src/canvas/MapCanvas.tsx:676 | Button | migrated |
| Maps (Overlays) | Zoom Percentage Label | viewer/src/canvas/MapCanvas.tsx:679 | Text | migrated |
| Maps (Overlays) | Zoom Out Button | viewer/src/canvas/MapCanvas.tsx:680 | Button | migrated |
| Maps (Overlays) | Fit To Screen Button | viewer/src/canvas/MapCanvas.tsx:683 | Button | migrated |
| Maps (Overlays) | Fit All (Unrestricted) Button | viewer/src/canvas/MapCanvas.tsx:686 | Button | migrated |
| Maps (Overlays) | Zoom Readability Hint | viewer/src/canvas/MapCanvas.tsx:691 | GAP | gap |
| Maps (Overlays) | Node Hover Tooltip | viewer/src/canvas/MapCanvas.tsx:703 | Tooltip | migrated |
| Maps (Overlays) | Toast Notification | viewer/src/App.tsx:1361 | Toast | migrated |
| Changes | Changes List Container | viewer/src/components/Panels.tsx:31 | List | migrated |
| Changes | Change Item Card | viewer/src/components/Panels.tsx:33 | ClickableCard | migrated |
| Changes | Change Item Title & Date | viewer/src/components/Panels.tsx:35 | Text | migrated |
| Changes | Change Type Badge | viewer/src/components/Panels.tsx:39 | Badge | migrated |
| Changes | Change Phase Badge | viewer/src/components/Panels.tsx:40 | Badge | migrated |
| Changes | Change Commit Sealed Badge | viewer/src/components/Panels.tsx:41 | Badge | migrated |
| Changes | Delta Added Nodes Chip | viewer/src/components/Panels.tsx:44 | Token | migrated |
| Changes | Delta Modified Nodes Chip | viewer/src/components/Panels.tsx:45 | Token | migrated |
| Changes | Delta Removed Nodes Chip | viewer/src/components/Panels.tsx:46 | Token | migrated |
| Changes | Change Detail Header | viewer/src/components/Panels.tsx:54 | Heading | migrated |
| Changes | View Diff Button | viewer/src/components/Panels.tsx:60 | Button | migrated |
| Changes | Open Map Button | viewer/src/components/Panels.tsx:64 | Button | migrated |
| Changes | Change Author & Rev Meta | viewer/src/components/Panels.tsx:70 | Text | migrated |
| Changes | Change Section Body | viewer/src/components/Panels.tsx:76 | Section | migrated |
| Changes | Associated Map Chip Button | viewer/src/components/Panels.tsx:83 | Button | migrated |
| Timeline | Timeline Header | viewer/src/components/Panels.tsx:122 | Heading | migrated |
| Timeline | Compare With Now Button | viewer/src/components/Panels.tsx:130 | Button | migrated |
| Timeline | Back To Now Button | viewer/src/components/Panels.tsx:133 | Button | migrated |
| Timeline | Timeline Range Slider | viewer/src/components/Panels.tsx:140 | Slider | migrated |
| Timeline | Timeline History Ticks | viewer/src/components/Panels.tsx:148 | GAP | gap |
| Timeline | Timeline List Container | viewer/src/components/Panels.tsx:161 | List | migrated |
| Timeline | Timeline Row Button | viewer/src/components/Panels.tsx:163 | ListItem | migrated |
| Timeline | Timeline Point Kind Dot | viewer/src/components/Panels.tsx:164 | StatusDot | migrated |
| Timeline | Timeline Point Summary & Date | viewer/src/components/Panels.tsx:166 | Text | migrated |
| Timeline | Viewing Active Badge | viewer/src/components/Panels.tsx:171 | Badge | migrated |
| Phases | Phases Header | viewer/src/components/Panels.tsx:201 | Heading | migrated |
| Phases | New Phase Title Input | viewer/src/components/Panels.tsx:214 | TextInput | migrated |
| Phases | Add Phase Button | viewer/src/components/Panels.tsx:215 | Button | migrated |
| Phases | Phase Card | viewer/src/components/Panels.tsx:225 | Card | migrated |
| Phases | Phase Status Badge | viewer/src/components/Panels.tsx:231 | Badge | migrated |
| Phases | Phase Completion Progress Bar | viewer/src/components/Panels.tsx:234 | ProgressBar | migrated |
| Phases | Start Phase Button | viewer/src/components/Panels.tsx:241 | Button | migrated |
| Phases | Finish Phase Button | viewer/src/components/Panels.tsx:246 | Button | migrated |
| Phases | View Snapshot Button | viewer/src/components/Panels.tsx:251 | Button | migrated |
| Phases | Show Only This Phase Button | viewer/src/components/Panels.tsx:255 | Button | migrated |
| Notes | Notes List Header & Title | viewer/src/components/Panels.tsx:432 | Heading | migrated |
| Notes | New Note Button | viewer/src/components/Panels.tsx:434 | Button | migrated |
| Notes | Note Row Button | viewer/src/components/Panels.tsx:439 | ListItem | migrated |
| Notes | Note Detail Title Header | viewer/src/components/Panels.tsx:449 | Heading | migrated |
| Notes | Edit Note Button | viewer/src/components/Panels.tsx:465 | Button | migrated |
| Notes | Save Note Button | viewer/src/components/Panels.tsx:457 | Button | migrated |
| Notes | Cancel Note Edit Button | viewer/src/components/Panels.tsx:460 | Button | migrated |
| Notes | Note Linked Map Badge | viewer/src/components/Panels.tsx:475 | Badge | migrated |
| Notes | Note Linked Node Badge | viewer/src/components/Panels.tsx:480 | Badge | migrated |
| Notes | Note Text Editor | viewer/src/components/Panels.tsx:486 | TextArea | migrated |
| Coverage | Coverage Head Summary & Stat | viewer/src/components/Panels.tsx:515 | Heading | migrated |
| Coverage | Coverage Percentage Ring | viewer/src/components/Panels.tsx:523 | GAP | gap |
| Coverage | Directory Coverage Progress Bar | viewer/src/components/Panels.tsx:536 | ProgressBar | migrated |
| Coverage | Gap Suggestion Item | viewer/src/components/Panels.tsx:544 | ListItem | migrated |
| Coverage | Gap Copy Prompt Button | viewer/src/components/Panels.tsx:549 | Button | migrated |
| Coverage | Unverified / Declared Node Chips | viewer/src/components/Panels.tsx:564 | Token | migrated |
| Coverage | Unmapped Files List | viewer/src/components/Panels.tsx:575 | List | migrated |
| Coverage | Unmapped File Copy Prompt Button | viewer/src/components/Panels.tsx:579 | Button | migrated |
| Settings | Modal Container | viewer/src/components/Modals.tsx:279 | Dialog | migrated |
| Settings | Modal Header & Subtitle | viewer/src/components/Modals.tsx:280 | DialogHeader | migrated |
| Settings | Close Button | viewer/src/components/Modals.tsx:285 | Button | migrated |
| Settings | Save Settings Button | viewer/src/components/Modals.tsx:288 | Button | migrated |
| Settings | Tracking Mode Select | viewer/src/components/Modals.tsx:310 | Selector | migrated |
| Settings | Granularity Select | viewer/src/components/Modals.tsx:319 | Selector | migrated |
| Settings | Agent Name Badge | viewer/src/components/Modals.tsx:332 | Badge | migrated |
| Settings | Theme Section & KV Properties | viewer/src/components/Modals.tsx:340 | Section | migrated |
| Settings | Privacy Section & KV Properties | viewer/src/components/Modals.tsx:356 | Section | migrated |
| Problems panel | Problems Panel Summary Header | viewer/src/components/Panels.tsx:595 | Heading | migrated |
| Problems panel | Run Check Button | viewer/src/components/Panels.tsx:601 | Button | migrated |
| Problems panel | Copy JSON Button | viewer/src/components/Panels.tsx:604 | Button | migrated |
| Problems panel | Issue List Container | viewer/src/components/Panels.tsx:616 | List | migrated |
| Problems panel | Issue Row Button | viewer/src/components/Panels.tsx:618 | ListItem | migrated |
| First-run tour | Tour Modal Container | viewer/src/components/Modals.tsx:408 | Dialog | migrated |
| First-run tour | Tour Step Dot Indicators | viewer/src/components/Modals.tsx:422 | Stepper | migrated |
| First-run tour | Tour Back Button | viewer/src/components/Modals.tsx:429 | Button | migrated |
| First-run tour | Tour Next / Get Started Button | viewer/src/components/Modals.tsx:434 | Button | migrated |
| First-run tour | Tour Skip Button | viewer/src/components/Modals.tsx:438 | Button | migrated |
| Shortcut help | Shortcuts Modal Container | viewer/src/components/Modals.tsx:377 | Dialog | migrated |
| Shortcut help | Shortcut List | viewer/src/components/Modals.tsx:385 | Table | migrated |
| Shortcut help | Keyboard Key Badge | viewer/src/components/Modals.tsx:388 | Kbd | migrated |
| Shortcut help | Close Button | viewer/src/components/Modals.tsx:401 | Button | migrated |
| Command palette | Search Modal Container | viewer/src/components/Modals.tsx:497 | CommandPalette | migrated |
| Command palette | Search Input Field | viewer/src/components/Modals.tsx:501 | CommandPaletteInput | migrated |
| Command palette | Empty State Notification | viewer/src/components/Modals.tsx:508 | CommandPaletteEmpty | migrated |
| Command palette | Search Results List | viewer/src/components/Modals.tsx:512 | CommandPaletteList | migrated |
| Command palette | Result Row Item | viewer/src/components/Modals.tsx:514 | CommandPaletteItem | migrated |
| Command palette | Result Kind Badge | viewer/src/components/Modals.tsx:517 | Badge | migrated |
| Command palette | Keyboard Navigation Hints Footer | viewer/src/components/Modals.tsx:550 | CommandPaletteFooter | migrated |
| Lock confirmation | Lock Confirmation Dialog | not present | not present | not present |
| Delete confirmation | Delete Node Confirmation Dialog | viewer/src/App.tsx:614 | AlertDialog | migrated |
| Inspector (nothing selected) | Map Type Eyebrow & Title | viewer/src/components/Inspector.tsx:107 | Heading | migrated |
| Inspector (nothing selected) | Map Summary Text | viewer/src/components/Inspector.tsx:111 | Text | migrated |
| Inspector (nothing selected) | Stat Cards (nodes, edges, errors, locked) | viewer/src/components/Inspector.tsx:112 | Card | migrated |
| Inspector (nothing selected) | Evidence Breakdown Section | viewer/src/components/Inspector.tsx:132 | Collapsible | migrated |
| Inspector (nothing selected) | Evidence Status Badges | viewer/src/components/Inspector.tsx:136 | Badge | migrated |
| Inspector (nothing selected) | Start Walkthrough Button | viewer/src/components/Inspector.tsx:144 | Button | migrated |
| Inspector (nothing selected) | Accessible Nodes List | viewer/src/components/Inspector.tsx:151 | List | migrated |
| Inspector (nothing selected) | Node List Row Button | viewer/src/components/Inspector.tsx:153 | ListItem | migrated |
| Inspector (nothing selected) | Details Section (Level, Phase, File, Rev) | viewer/src/components/Inspector.tsx:183 | Section | migrated |
| Inspector (nothing selected) | Open Related Notes Button | viewer/src/components/Inspector.tsx:203 | Button | migrated |
| Inspector (node selected) | Node Header & Kind Eyebrow | viewer/src/components/Inspector.tsx:277 | Heading | migrated |
| Inspector (node selected) | Clear Selection Button | viewer/src/components/Inspector.tsx:284 | Button | migrated |
| Inspector (node selected) | Evidence Status Badge | viewer/src/components/Inspector.tsx:289 | Badge | migrated |
| Inspector (node selected) | Node Locked Status Badge | viewer/src/components/Inspector.tsx:290 | Badge | migrated |
| Inspector (node selected) | Group Membership Badge | viewer/src/components/Inspector.tsx:291 | Badge | migrated |
| Inspector (node selected) | Tag Badges | viewer/src/components/Inspector.tsx:293 | Badge | migrated |
| Inspector (node selected) | Node Description Text | viewer/src/components/Inspector.tsx:371 | Text | migrated |
| Inspector (node selected) | Plain Language Note Callout | viewer/src/components/Inspector.tsx:373 | Card | migrated |
| Inspector (node selected) | Code Refs List | viewer/src/components/Inspector.tsx:379 | List | migrated |
| Inspector (node selected) | Code Ref Copy Path Button | viewer/src/components/Inspector.tsx:383 | Button | migrated |
| Inspector (node selected) | Code Ref Peek Button | viewer/src/components/Inspector.tsx:388 | Button | migrated |
| Inspector (node selected) | Code Peek Box & Dismiss Button | viewer/src/components/Inspector.tsx:398 | CodeBlock | migrated |
| Inspector (node selected) | Connections List | viewer/src/components/Inspector.tsx:409 | List | migrated |
| Inspector (node selected) | Connection Target Row Button | viewer/src/components/Inspector.tsx:413 | ListItem | migrated |
| Inspector (node selected) | Connection Kind Badge | viewer/src/components/Inspector.tsx:416 | Badge | migrated |
| Inspector (node selected) | History Section List | viewer/src/components/Inspector.tsx:427 | List | migrated |
| Inspector (node selected) | Ask Agent About This Button | viewer/src/components/Inspector.tsx:447 | Button | migrated |
| Inspector (node selected) | Lock / Unlock Node Button | viewer/src/components/Inspector.tsx:450 | Button | migrated |
| Inspector (edge selected) | Edge Inspection Panel | not present | not present | not present |
| Inspector (edit mode) | Node Label Input | viewer/src/components/Inspector.tsx:304 | TextInput | migrated |
| Inspector (edit mode) | Node Kind Selector | viewer/src/components/Inspector.tsx:309 | Selector | migrated |
| Inspector (edit mode) | Node Status Selector | viewer/src/components/Inspector.tsx:319 | Selector | migrated |
| Inspector (edit mode) | Description Textarea | viewer/src/components/Inspector.tsx:330 | TextArea | migrated |
| Inspector (edit mode) | Plain Language Note Textarea | viewer/src/components/Inspector.tsx:334 | TextArea | migrated |
| Inspector (edit mode) | Tags Input | viewer/src/components/Inspector.tsx:338 | TextInput | migrated |
| Inspector (edit mode) | Ref Path Input | viewer/src/components/Inspector.tsx:345 | TextInput | migrated |
| Inspector (edit mode) | Ref Symbol Input | viewer/src/components/Inspector.tsx:346 | TextInput | migrated |
| Inspector (edit mode) | Remove Ref Button | viewer/src/components/Inspector.tsx:347 | Button | migrated |
| Inspector (edit mode) | Add Ref Button | viewer/src/components/Inspector.tsx:352 | Button | migrated |
| Inspector (edit mode) | Save Changes Button | viewer/src/components/Inspector.tsx:357 | Button | migrated |
| Inspector (edit mode) | Reset Draft Button | viewer/src/components/Inspector.tsx:360 | Button | migrated |
| Inspector (edit mode) | Delete Node Button | viewer/src/components/Inspector.tsx:363 | Button | migrated |
| Inspector (connect mode) | Connect Mode Toggle Button | viewer/src/App.tsx:1218 | ToggleButton | migrated |
| Inspector (connect mode) | Connect Mode Guide Hint Banner | viewer/src/canvas/MapCanvas.tsx:708 | Banner | migrated |
| Inspector (diff view) | Diff Comparison Top Banner | viewer/src/App.tsx:1169 | Banner | migrated |
| Inspector (diff view) | Exit Diff Mode Button | viewer/src/App.tsx:1173 | Button | migrated |
| Inspector (diff view) | Diff Legend Badges (added, removed, modified) | viewer/src/canvas/MapCanvas.tsx:696 | Badge | migrated |
