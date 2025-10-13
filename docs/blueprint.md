# **App Name**: City Pulse - Chennai Live

## Core Features:

- Map Display: Display a full-bleed interactive map of Chennai using Mapbox GL JS, with custom dark base style and neon overlays.
- Location Search: Implement a compact pill search that expands into a full-width overlay with recent queries and tags.
- Layer Controls: Provide circular icon buttons to toggle map layers (Traffic, Incidents, Civic Issues, Events, Sentiment).
- Filter Panel: Implement a filter panel to refine map data based on severity, freshness, distance, and category.
- Context Switching: Floating segmented control to switch context mode between Live, Predict, and Mood.
- Quick Actions FAB: Floating action button stack for reporting issues, saving areas, and sharing snapshots of the current map view.
- CrowdSense Lane Preview: Users long-press on any road segment and opens a mini lane preview overlay that simulates the next 30 minutes of congestion.

## Style Guidelines:

- Primary color: Marina Teal (#1AC6C6) for the primary accent color, inspired by Chennai's coastline.
- Background color: Deep Kaatu Blue (#0A1428) to set the base, reminiscent of Chennai's night skies.
- Accent color: Napier Neon (#FF4D6D) for alerts and severity indicators, capturing the vibrant lights of Napier Bridge.
- Body and headline font: 'Inter' (sans-serif) for UI elements, providing a modern and readable interface. Note: currently only Google Fonts are supported.
- Use custom icons representing different categories such as traffic, civic issues, and events, with a Chennai-specific flair.
- Map-first layout: Focus on a full-bleed map with overlays and bottom sheets for details, maintaining a clean and uncluttered interface.
- Smooth spring-based animations for sheets and overlays (200-400ms) and haptic-like feedback through visual micro-ripples on taps.