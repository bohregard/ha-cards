# HA Dreame Card

Custom Home Assistant dashboard cards. Install through the Marketplace (HACS) as a custom **Dashboard** repository.

## Vacuum card

A control card for vacuums from the [Dreame Vacuum](https://github.com/Tasshack/dreame-vacuum) integration.

- Live map. Tap a room on the map, or its chip, to select it.
- **Clean N rooms** cleans the selected rooms; with none selected, **Clean all**.
- Pause and resume, dock (asks for a second tap while a clean is running), locate.
- CleanGenius, suction and mode, showing whichever the robot currently allows.
- Dock status and consumable levels; anything under 10% is flagged.

```yaml
type: custom:brinstar-vacuum-card
entity: vacuum.my_robot
name: Robot              # optional
map_entity: camera.my_robot_map  # optional; found from the device by default
```

The map, settings, dock and maintenance entities are found from the vacuum's device, so `entity` is usually all you need.

## Development

```sh
npm install
npm test         # vitest
npm run build    # dist/brinstar-cards.js
```

Tagging `vX.Y.Z` builds the bundle and attaches it to a GitHub release, which the Marketplace installs.
