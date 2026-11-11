# Viewer Build Size (After Astryx)

## Files in `dist/web/`

| File | Uncompressed (Bytes) | Uncompressed (KB) | Gzip (Bytes) | Gzip (KB) |
|---|---|---|---|---|
| `assets/BottomSheet-CqftpBRH.js` | 70,916 B | 69.25 KB | 23,887 B | 23.33 KB |
| `assets/focusOutline.stylex-DxSbM85t.js` | 29,255 B | 28.57 KB | 8,303 B | 8.11 KB |
| `assets/index-D8AYUatQ.css` | 334,067 B | 326.24 KB | 54,936 B | 53.65 KB |
| `assets/index-DGhvUvvB.js` | 1,181,574 B | 1,153.88 KB | 375,256 B | 366.46 KB |
| `assets/ItemSwipeLayer-ByPl12I7.js` | 9,080 B | 8.87 KB | 3,553 B | 3.47 KB |
| `assets/MenuBottomSheet-56vlcEbc.js` | 679 B | 0.66 KB | 426 B | 0.42 KB |
| `assets/ProgressBarMarkTooltip-C4ALQ1H0.js` | 250 B | 0.24 KB | 200 B | 0.20 KB |
| `assets/Tooltip-CyiuEg7w.js` | 2,088 B | 2.04 KB | 956 B | 0.93 KB |
| `index.html` | 786 B | 0.77 KB | 481 B | 0.47 KB |
| **Total** | **1,628,695 B** | **1,590.52 KB** | **467,998 B** | **457.03 KB** |

## Comparison (Before vs After)

| Metric | Before Astryx | After Astryx | Difference (KB) | Difference (%) |
|---|---|---|---|---|
| **Uncompressed** | 408.59 KB (408,586 B) | 1,590.52 KB (1,628,695 B) | **+1,181.93 KB** | +289.3% |
| **Gzip Compressed** | 122.60 KB (125,542 B) | 457.03 KB (467,998 B) | **+334.43 KB** | +272.8% |

### Analysis
The increase in bundle size is primarily due to:
1. **Astryx Component Suite & Runtime**: Pre-compiled StyleX class maps, accessible ARIA primitives (`Dialog`, `CommandPalette`, `Table`, `List`, `Collapsible`, `Popover`, `Toast`, `ProgressBar`, `SegmentedControl`, `Selector`, `Switch`, `Button`).
2. **StyleX CSS Layer**: Extracted atomic CSS class tokens and the comprehensive neutral theme token dictionary (`@astryxdesign/theme-neutral`).
3. **Chunking**: Code splitting into dynamic chunks for bottom sheets, tooltips, swipe layers, and focus outlines.
