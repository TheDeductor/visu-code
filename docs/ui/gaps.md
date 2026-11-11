# Astryx Component Gaps

| Element | Location | Reason / Missing Capability | Component Needed |
|---|---|---|---|
| VM Brand Logo & Title | viewer/src/components/TopBar.tsx:58 | Custom brand mark with stylized text and subtitle | Brand / TopNavHeading with custom badge |
| Map Tree Folder Label | viewer/src/components/Sidebar.tsx:62 | Collapsible/labeled folder divider in file tree | TreeList / SideNavSection |
| Map Row Item | viewer/src/components/Sidebar.tsx:66 | Complex interactive tree row with icon, title, meta, status dots, and badges | TreeListItem with leading/trailing slots |
| Zoom Readability Hint | viewer/src/canvas/MapCanvas.tsx:691 | Floating notification overlay with inline button action inside canvas container | Toast / InlineBanner |
| Timeline History Ticks | viewer/src/components/Panels.tsx:148 | Scrubber ticks positioned over a timeline slider showing commit vs journal | SliderTicks / Scrubber |
| Coverage Percentage Ring | viewer/src/components/Panels.tsx:523 | Circular conic-gradient progress indicator with center percentage label | ProgressRing / RadialGauge |
