# Synthetic example STLs

Select all 30 `.stl` files in this folder in **Import STL models**, and use **millimetres**. They contain 28 individual crowns and upper/lower gingiva in shared coordinates. Schematic roots and braces are excluded from these STL files.

These are original procedural demonstration shapes, not patient scans or validated dental anatomy. Imported teeth intentionally require anatomical-frame calibration even when these files came from the demo; move them along world X/Y/Z to test import immediately. Reload the built-in demo from Settings for its predefined buccal/mesial/occlusal reference directions and schematic roots.

Regenerate with Node.js 22.6 or newer: `node --experimental-strip-types scripts/generate-samples.mjs` from the application folder.
