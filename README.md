# HA Dreame Card

Custom Home Assistant dashboard cards. Install through the Marketplace (HACS) as a custom **Dashboard** repository.

## Vacuum card

A control card for vacuums from the [Dreame Vacuum](https://github.com/Tasshack/dreame-vacuum) integration.

- Live map. Tap a room on the map, or its chip, to select it.
- **Clean N rooms** cleans the selected rooms; with none selected, **Clean all**.
- Pause and resume, dock (asks for a second tap while a clean is running), locate.
- CleanGenius, suction and mode, showing whichever the robot currently allows.

```yaml
type: custom:brinstar-vacuum-card
entity: vacuum.my_robot
name: Robot              # optional
map_entity: camera.my_robot_map  # optional; found from the device by default
```

The map and settings entities are found from the vacuum's device, so `entity` is usually all you need.

## Vacuum status card

Maintenance for the same vacuum, meant to sit beside the vacuum card.

- **Consumables:** level and time left for each brush, filter and sensor. Amber under 20%, red under 10%. **Reset** (after replacing or cleaning a part) needs a second tap.
- **Last clean:** when, how long, and how much area.
- **Dock & tanks:** base, auto-empty, water tanks, dust bag, detergent, hot water and drainage. Anything not in a normal state is highlighted.

```yaml
type: custom:brinstar-vacuum-status-card
entity: vacuum.my_robot
title: Maintenance   # optional
```

## Development

```sh
npm install
npm test         # vitest
npm run build    # dist/brinstar-cards.js
```

Tagging `vX.Y.Z` builds the bundle and attaches it to a GitHub release, which the Marketplace installs.
