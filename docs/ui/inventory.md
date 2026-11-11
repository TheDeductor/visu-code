# UI Component Inventory

| Page | Element | Current Implementation (file:line) | Astryx Component from docs/ui/astryx-components.md, or GAP |
|---|---|---|---|
| Maps (TopBar) | VM Brand Logo & Title | viewer/src/components/TopBar.tsx:58 | GAP |
| Maps (TopBar) | Navigation Tabs (Maps, Changes, Timeline, Phases, Notes, Coverage) | viewer/src/components/TopBar.tsx:76 | TabList, Tab |
| Maps (TopBar) | Search Icon Button | viewer/src/components/TopBar.tsx:84 | Button |
| Maps (TopBar) | Validation Problems Pill (warnings/errors count) | viewer/src/components/TopBar.tsx:87 | Badge |
| Maps (TopBar) | Live WebSocket Status Dot | viewer/src/components/TopBar.tsx:91 | StatusDot |
| Maps (TopBar) | Beginner Mode Toggle Chip | viewer/src/components/TopBar.tsx:92 | Switch |
| Maps (TopBar) | View / Edit Segmented Control | viewer/src/components/TopBar.tsx:95 | SegmentedControl |
| Maps (TopBar) | Export Menu Trigger & Dropdown | viewer/src/components/TopBar.tsx:103 | DropdownMenu |
| Maps (TopBar) | Refresh Button | viewer/src/components/TopBar.tsx:122 | Button |
| Maps (TopBar) | Keyboard Shortcuts Help Button | viewer/src/components/TopBar.tsx:125 | Button |
| Maps (TopBar) | Settings Button | viewer/src/components/TopBar.tsx:128 | Button |
| Maps (Sidebar) | Map Filter Input | viewer/src/components/Sidebar.tsx:48 | TextInput |
| Maps (Sidebar) | Clear Filter Button | viewer/src/components/Sidebar.tsx:50 | Button |
| Maps (Sidebar) | New Map Button | viewer/src/components/Sidebar.tsx:55 | Button |
| Maps (Sidebar) | Map Tree Folder Label | viewer/src/components/Sidebar.tsx:62 | GAP |
| Maps (Sidebar) | Map Row Item | viewer/src/components/Sidebar.tsx:66 | GAP |
| Maps (Sidebar) | Stale Map Indicator Dot | viewer/src/components/Sidebar.tsx:81 | StatusDot |
| Maps (Sidebar) | Drift Pending Dot | viewer/src/components/Sidebar.tsx:86 | StatusDot |
| Maps (Sidebar) | Map Errors / Warnings Badge | viewer/src/components/Sidebar.tsx:90 | Badge |
| Maps (Sidebar) | Coverage Progress Bar | viewer/src/components/Sidebar.tsx:107 | ProgressBar |
| Maps (Sidebar) | Bootstrap Maps Button | viewer/src/components/Sidebar.tsx:112 | Button |
| Maps (Sidebar) | Version Footer Text | viewer/src/components/Sidebar.tsx:119 | Text |
| Maps (Overlays) | Pending Map Update Banner | viewer/src/App.tsx:1136 | Banner |
| Maps (Overlays) | Map Error Banner | viewer/src/App.tsx:1147 | Banner |
| Maps (Overlays) | History Viewing Banner | viewer/src/App.tsx:1156 | Banner |
| Maps (Overlays) | Phase Filter Active Banner | viewer/src/App.tsx:1179 | Banner |
| Maps (Overlays) | Canvas Edit Toolbar Container | viewer/src/App.tsx:1213 | Toolbar |
| Maps (Overlays) | Add Node Toolbar Button | viewer/src/App.tsx:1214 | Button |
| Maps (Overlays) | Connect Toolbar Toggle Button | viewer/src/App.tsx:1217 | ToggleButton |
| Maps (Overlays) | Sticky Note Toolbar Button | viewer/src/App.tsx:1227 | Button |
| Maps (Overlays) | Reset Layout Toolbar Button | viewer/src/App.tsx:1230 | Button |
| Maps (Overlays) | Done Edit Toolbar Button | viewer/src/App.tsx:1233 | Button |
| Maps (Overlays) | Walkthrough Step Counter | viewer/src/App.tsx:1240 | Text |
| Maps (Overlays) | Walkthrough Text | viewer/src/App.tsx:1243 | Text |
| Maps (Overlays) | Walkthrough Previous Button | viewer/src/App.tsx:1245 | Button |
| Maps (Overlays) | Walkthrough Play / Pause Button | viewer/src/App.tsx:1248 | Button |
| Maps (Overlays) | Walkthrough Next Button | viewer/src/App.tsx:1251 | Button |
| Maps (Overlays) | Walkthrough Close Button | viewer/src/App.tsx:1254 | Button |
| Maps (Overlays) | Bottom Panel Tab Switchers (Problems / Activity) | viewer/src/App.tsx:1264 | TabList, Tab |
| Maps (Overlays) | Bottom Panel Close Button | viewer/src/App.tsx:1272 | Button |
| Maps (Overlays) | Zoom In Button | viewer/src/canvas/MapCanvas.tsx:676 | Button |
| Maps (Overlays) | Zoom Percentage Label | viewer/src/canvas/MapCanvas.tsx:679 | Text |
| Maps (Overlays) | Zoom Out Button | viewer/src/canvas/MapCanvas.tsx:680 | Button |
| Maps (Overlays) | Fit To Screen Button | viewer/src/canvas/MapCanvas.tsx:683 | Button |
| Maps (Overlays) | Fit All (Unrestricted) Button | viewer/src/canvas/MapCanvas.tsx:686 | Button |
| Maps (Overlays) | Zoom Readability Hint | viewer/src/canvas/MapCanvas.tsx:691 | GAP |
| Maps (Overlays) | Node Hover Tooltip | viewer/src/canvas/MapCanvas.tsx:703 | Tooltip |
| Maps (Overlays) | Toast Notification | viewer/src/App.tsx:1361 | Toast |
| Changes | Changes List Container | viewer/src/components/Panels.tsx:31 | List |
| Changes | Change Item Card | viewer/src/components/Panels.tsx:33 | ClickableCard |
| Changes | Change Item Title & Date | viewer/src/components/Panels.tsx:35 | Text |
| Changes | Change Type Badge | viewer/src/components/Panels.tsx:39 | Badge |
| Changes | Change Phase Badge | viewer/src/components/Panels.tsx:40 | Badge |
| Changes | Change Commit Sealed Badge | viewer/src/components/Panels.tsx:41 | Badge |
| Changes | Delta Added Nodes Chip | viewer/src/components/Panels.tsx:44 | Token |
| Changes | Delta Modified Nodes Chip | viewer/src/components/Panels.tsx:45 | Token |
| Changes | Delta Removed Nodes Chip | viewer/src/components/Panels.tsx:46 | Token |
| Changes | Change Detail Header | viewer/src/components/Panels.tsx:54 | Heading |
| Changes | View Diff Button | viewer/src/components/Panels.tsx:60 | Button |
| Changes | Open Map Button | viewer/src/components/Panels.tsx:64 | Button |
| Changes | Change Author & Rev Meta | viewer/src/components/Panels.tsx:70 | Text |
| Changes | Change Section Body | viewer/src/components/Panels.tsx:76 | Section |
| Changes | Associated Map Chip Button | viewer/src/components/Panels.tsx:83 | Button |
| Timeline | Timeline Header | viewer/src/components/Panels.tsx:122 | Heading |
| Timeline | Compare With Now Button | viewer/src/components/Panels.tsx:130 | Button |
| Timeline | Back To Now Button | viewer/src/components/Panels.tsx:133 | Button |
| Timeline | Timeline Range Slider | viewer/src/components/Panels.tsx:140 | Slider |
| Timeline | Timeline History Ticks | viewer/src/components/Panels.tsx:148 | GAP |
| Timeline | Timeline List Container | viewer/src/components/Panels.tsx:161 | List |
| Timeline | Timeline Row Button | viewer/src/components/Panels.tsx:163 | ListItem |
| Timeline | Timeline Point Kind Dot | viewer/src/components/Panels.tsx:164 | StatusDot |
| Timeline | Timeline Point Summary & Date | viewer/src/components/Panels.tsx:166 | Text |
| Timeline | Viewing Active Badge | viewer/src/components/Panels.tsx:171 | Badge |
| Phases | Phases Header | viewer/src/components/Panels.tsx:201 | Heading |
| Phases | New Phase Title Input | viewer/src/components/Panels.tsx:214 | TextInput |
| Phases | Add Phase Button | viewer/src/components/Panels.tsx:215 | Button |
| Phases | Phase Card | viewer/src/components/Panels.tsx:225 | Card |
| Phases | Phase Status Badge | viewer/src/components/Panels.tsx:231 | Badge |
| Phases | Phase Completion Progress Bar | viewer/src/components/Panels.tsx:234 | ProgressBar |
| Phases | Start Phase Button | viewer/src/components/Panels.tsx:241 | Button |
| Phases | Finish Phase Button | viewer/src/components/Panels.tsx:246 | Button |
| Phases | View Snapshot Button | viewer/src/components/Panels.tsx:251 | Button |
| Phases | Show Only This Phase Button | viewer/src/components/Panels.tsx:255 | Button |
| Notes | Notes List Header & Title | viewer/src/components/Panels.tsx:432 | Heading |
| Notes | New Note Button | viewer/src/components/Panels.tsx:434 | Button |
| Notes | Note Row Button | viewer/src/components/Panels.tsx:439 | ListItem |
| Notes | Note Detail Title Header | viewer/src/components/Panels.tsx:449 | Heading |
| Notes | Edit Note Button | viewer/src/components/Panels.tsx:465 | Button |
| Notes | Save Note Button | viewer/src/components/Panels.tsx:457 | Button |
| Notes | Cancel Note Edit Button | viewer/src/components/Panels.tsx:460 | Button |
| Notes | Note Linked Map Badge | viewer/src/components/Panels.tsx:475 | Badge |
| Notes | Note Linked Node Badge | viewer/src/components/Panels.tsx:480 | Badge |
| Notes | Note Text Editor | viewer/src/components/Panels.tsx:486 | TextArea |
| Coverage | Coverage Head Summary & Stat | viewer/src/components/Panels.tsx:515 | Heading |
| Coverage | Coverage Percentage Ring | viewer/src/components/Panels.tsx:523 | GAP |
| Coverage | Directory Coverage Progress Bar | viewer/src/components/Panels.tsx:536 | ProgressBar |
| Coverage | Gap Suggestion Item | viewer/src/components/Panels.tsx:544 | ListItem |
| Coverage | Gap Copy Prompt Button | viewer/src/components/Panels.tsx:549 | Button |
| Coverage | Unverified / Declared Node Chips | viewer/src/components/Panels.tsx:564 | Token |
| Coverage | Unmapped Files List | viewer/src/components/Panels.tsx:575 | List |
| Coverage | Unmapped File Copy Prompt Button | viewer/src/components/Panels.tsx:579 | Button |
| Settings | Modal Container | viewer/src/components/Modals.tsx:279 | Dialog |
| Settings | Modal Header & Subtitle | viewer/src/components/Modals.tsx:280 | DialogHeader |
| Settings | Close Button | viewer/src/components/Modals.tsx:285 | Button |
| Settings | Save Settings Button | viewer/src/components/Modals.tsx:288 | Button |
| Settings | Tracking Mode Select | viewer/src/components/Modals.tsx:310 | Selector |
| Settings | Granularity Select | viewer/src/components/Modals.tsx:319 | Selector |
| Settings | Agent Name Badge | viewer/src/components/Modals.tsx:332 | Badge |
| Settings | Theme Section & KV Properties | viewer/src/components/Modals.tsx:340 | Section |
| Settings | Privacy Section & KV Properties | viewer/src/components/Modals.tsx:356 | Section |
| Problems panel | Problems Panel Summary Header | viewer/src/components/Panels.tsx:595 | Heading |
| Problems panel | Run Check Button | viewer/src/components/Panels.tsx:601 | Button |
| Problems panel | Copy JSON Button | viewer/src/components/Panels.tsx:604 | Button |
| Problems panel | Issue List Container | viewer/src/components/Panels.tsx:616 | List |
| Problems panel | Issue Row Button | viewer/src/components/Panels.tsx:618 | ListItem |
| First-run tour | Tour Modal Container | viewer/src/components/Modals.tsx:408 | Dialog |
| First-run tour | Tour Step Dot Indicators | viewer/src/components/Modals.tsx:422 | Stepper |
| First-run tour | Tour Back Button | viewer/src/components/Modals.tsx:429 | Button |
| First-run tour | Tour Next / Get Started Button | viewer/src/components/Modals.tsx:434 | Button |
| First-run tour | Tour Skip Button | viewer/src/components/Modals.tsx:438 | Button |
| Shortcut help | Shortcuts Modal Container | viewer/src/components/Modals.tsx:377 | Dialog |
| Shortcut help | Shortcut List | viewer/src/components/Modals.tsx:385 | Table |
| Shortcut help | Keyboard Key Badge | viewer/src/components/Modals.tsx:388 | Kbd |
| Shortcut help | Close Button | viewer/src/components/Modals.tsx:401 | Button |
| Command palette | Search Modal Container | viewer/src/components/Modals.tsx:497 | CommandPalette |
| Command palette | Search Input Field | viewer/src/components/Modals.tsx:501 | CommandPaletteInput |
| Command palette | Empty State Notification | viewer/src/components/Modals.tsx:508 | CommandPaletteEmpty |
| Command palette | Search Results List | viewer/src/components/Modals.tsx:512 | CommandPaletteList |
| Command palette | Result Row Item | viewer/src/components/Modals.tsx:514 | CommandPaletteItem |
| Command palette | Result Kind Badge | viewer/src/components/Modals.tsx:517 | Badge |
| Command palette | Keyboard Navigation Hints Footer | viewer/src/components/Modals.tsx:550 | CommandPaletteFooter |
| Lock confirmation | Lock Confirmation Dialog | not present | not present |
| Delete confirmation | Delete Node Confirmation Dialog | viewer/src/App.tsx:614 | AlertDialog |
| Inspector (nothing selected) | Map Type Eyebrow & Title | viewer/src/components/Inspector.tsx:107 | Heading |
| Inspector (nothing selected) | Map Summary Text | viewer/src/components/Inspector.tsx:111 | Text |
| Inspector (nothing selected) | Stat Cards (nodes, edges, errors, locked) | viewer/src/components/Inspector.tsx:112 | Card |
| Inspector (nothing selected) | Evidence Breakdown Section | viewer/src/components/Inspector.tsx:132 | Collapsible |
| Inspector (nothing selected) | Evidence Status Badges | viewer/src/components/Inspector.tsx:136 | Badge |
| Inspector (nothing selected) | Start Walkthrough Button | viewer/src/components/Inspector.tsx:144 | Button |
| Inspector (nothing selected) | Accessible Nodes List | viewer/src/components/Inspector.tsx:151 | List |
| Inspector (nothing selected) | Node List Row Button | viewer/src/components/Inspector.tsx:153 | ListItem |
| Inspector (nothing selected) | Details Section (Level, Phase, File, Rev) | viewer/src/components/Inspector.tsx:183 | Section |
| Inspector (nothing selected) | Open Related Notes Button | viewer/src/components/Inspector.tsx:203 | Button |
| Inspector (node selected) | Node Header & Kind Eyebrow | viewer/src/components/Inspector.tsx:277 | Heading |
| Inspector (node selected) | Clear Selection Button | viewer/src/components/Inspector.tsx:284 | Button |
| Inspector (node selected) | Evidence Status Badge | viewer/src/components/Inspector.tsx:289 | Badge |
| Inspector (node selected) | Node Locked Status Badge | viewer/src/components/Inspector.tsx:290 | Badge |
| Inspector (node selected) | Group Membership Badge | viewer/src/components/Inspector.tsx:291 | Badge |
| Inspector (node selected) | Tag Badges | viewer/src/components/Inspector.tsx:293 | Badge |
| Inspector (node selected) | Node Description Text | viewer/src/components/Inspector.tsx:371 | Text |
| Inspector (node selected) | Plain Language Note Callout | viewer/src/components/Inspector.tsx:373 | Card |
| Inspector (node selected) | Code Refs List | viewer/src/components/Inspector.tsx:379 | List |
| Inspector (node selected) | Code Ref Copy Path Button | viewer/src/components/Inspector.tsx:383 | Button |
| Inspector (node selected) | Code Ref Peek Button | viewer/src/components/Inspector.tsx:388 | Button |
| Inspector (node selected) | Code Peek Box & Dismiss Button | viewer/src/components/Inspector.tsx:398 | CodeBlock |
| Inspector (node selected) | Connections List | viewer/src/components/Inspector.tsx:409 | List |
| Inspector (node selected) | Connection Target Row Button | viewer/src/components/Inspector.tsx:413 | ListItem |
| Inspector (node selected) | Connection Kind Badge | viewer/src/components/Inspector.tsx:416 | Badge |
| Inspector (node selected) | History Section List | viewer/src/components/Inspector.tsx:427 | List |
| Inspector (node selected) | Ask Agent About This Button | viewer/src/components/Inspector.tsx:447 | Button |
| Inspector (node selected) | Lock / Unlock Node Button | viewer/src/components/Inspector.tsx:450 | Button |
| Inspector (edge selected) | Edge Inspection Panel | not present | not present |
| Inspector (edit mode) | Node Label Input | viewer/src/components/Inspector.tsx:304 | TextInput |
| Inspector (edit mode) | Node Kind Selector | viewer/src/components/Inspector.tsx:309 | Selector |
| Inspector (edit mode) | Node Status Selector | viewer/src/components/Inspector.tsx:319 | Selector |
| Inspector (edit mode) | Description Textarea | viewer/src/components/Inspector.tsx:330 | TextArea |
| Inspector (edit mode) | Plain Language Note Textarea | viewer/src/components/Inspector.tsx:334 | TextArea |
| Inspector (edit mode) | Tags Input | viewer/src/components/Inspector.tsx:338 | TextInput |
| Inspector (edit mode) | Ref Path Input | viewer/src/components/Inspector.tsx:345 | TextInput |
| Inspector (edit mode) | Ref Symbol Input | viewer/src/components/Inspector.tsx:346 | TextInput |
| Inspector (edit mode) | Remove Ref Button | viewer/src/components/Inspector.tsx:347 | Button |
| Inspector (edit mode) | Add Ref Button | viewer/src/components/Inspector.tsx:352 | Button |
| Inspector (edit mode) | Save Changes Button | viewer/src/components/Inspector.tsx:357 | Button |
| Inspector (edit mode) | Reset Draft Button | viewer/src/components/Inspector.tsx:360 | Button |
| Inspector (edit mode) | Delete Node Button | viewer/src/components/Inspector.tsx:363 | Button |
| Inspector (connect mode) | Connect Mode Toggle Button | viewer/src/App.tsx:1218 | ToggleButton |
| Inspector (connect mode) | Connect Mode Guide Hint Banner | viewer/src/canvas/MapCanvas.tsx:708 | Banner |
| Inspector (diff view) | Diff Comparison Top Banner | viewer/src/App.tsx:1169 | Banner |
| Inspector (diff view) | Exit Diff Mode Button | viewer/src/App.tsx:1173 | Button |
| Inspector (diff view) | Diff Legend Badges (added, removed, modified) | viewer/src/canvas/MapCanvas.tsx:696 | Badge |
