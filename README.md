# HA Cards

Custom Home Assistant dashboard cards: a Dreame vacuum, ESPHome cat feeders, a scale-based water fountain and a Litter-Robot. Install through the Marketplace (HACS) as a custom **Dashboard** repository. All cards are in one bundle.

Each card takes one `entity` and finds the rest from that entity's device (by translation key, or by the end of the entity id for ESPHome devices).

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

## Feeder card

For an ESPHome gravity feeder (built for a Petkit Fresh Element Solo running custom ESPHome firmware) that exposes `sensor.*_last_fed`, `sensor.*_dispensed_food_scoops`, `binary_sensor.*_food_low` / `_food_empty` / `_jammed`, `button.*_dispense_food`, `button.*_reset_food_level_refilled`, `number.*_manual_dispense_scoops` and `time.*_meal_N_time` / `number.*_meal_N_scoops`.

- A drawing of the feeder with the **estimated food left** in the hopper window: the scoops dispensed since **I refilled it** was last pressed, times `grams_per_scoop`, taken off `hopper_grams`. Days left use the last 7 days' rate. Until the button has been pressed once there is no estimate.
- Status (Food OK / Food low / Out of food / Jammed / Offline), the last feed (and whether it was a scheduled meal or manual), and the next meal.
- Scoops per day for the last week.
- **Feed now** with a scoop count (second tap to confirm), **I refilled it** (second tap), mute.
- The gear opens the settings: four meals (time and scoops; 0 skips a meal), low-food threshold, hourly chime.

```yaml
type: custom:brinstar-feeder-card
entity: sensor.cat_feeder_last_fed   # any entity of the feeder
name: Feeder            # optional
hopper_grams: 1300      # optional, what a full hopper holds
grams_per_scoop: 10     # optional, weigh a few scoops and divide
```

## Fountain card

For an ESPHome water fountain with a scale (built for a Petlibro PLWF116 running [petlibro-plwf116-esphome](https://github.com/GoliathLabs/petlibro-plwf116-esphome)): `sensor.*_water_weight`, `binary_sensor.*_water_low` / `_water_empty` / `_pump_running` / `_power_adapter` / `_cat_detected` / `_filter_due`, `switch.*_pump`, `select.*_pump_mode`, `number.*_water_empty_threshold` / `_water_low_threshold`, `sensor.*_filter_days_left`, `button.*_filter_changed`.

- A drawing of the fountain with the water level in the tank, ticks at the low and empty thresholds, and water running over the top while the pump runs.
- Status (Water OK / Water low / Refill now / Offline), litres, and why the pump is or isn't running (off, stopped because the tank is too low, or waiting for a cat on battery). Dry-run protection being off is called out.
- Water level for the last 24 hours, water used per day for the last week (the drop between refills: drinking plus evaporation), visits today from the radar.
- Pump on/off, **New filter** (second tap). The gear opens pump mode, boost, radar run time, dry-run protection (turning it off needs a second tap), thresholds and filter life.

```yaml
type: custom:brinstar-fountain-card
entity: sensor.cat_fountain_water_weight
name: Fountain          # optional
capacity_grams: 3000    # optional, water in a full tank
```

## Litter card

For a Litter-Robot from the core Litter-Robot integration.

- A drawing of the robot with the litter level in the globe and the waste drawer level, and the status light.
- Status (Ready / Cycling / Cat inside / Drawer almost full / Drawer full / a named fault / Offline), last cycle, litter and drawer levels, laser sensor and LitterHopper warnings.
- Each cat's daily average weight and visits per cat per day, telling the cats apart by weight.
- **Clean now** (second tap). The gear opens cycle wait time, globe light and brightness, panel brightness, night light, panel lockout and reset (second tap).

```yaml
type: custom:brinstar-litter-card
entity: vacuum.litter_robot_litter_box
name: Litter box                           # optional
last_cycle: input_datetime.last_cycle      # optional; defaults to the vacuum's last change
cats:                                      # optional, lightest first; no max_lb on the heaviest
  - { name: Cat 1, max_lb: 9 }
  - { name: Cat 2, max_lb: 12.5 }
  - { name: Cat 3 }
```

## Development

```sh
npm install
npm test         # vitest
npm run build    # dist/brinstar-cards.js
```

`dev/harness.html` renders every card in its main states from a fixture recorded from a real Home Assistant (`dev/fixture.json`, git-ignored). Serve the repo root (`python3 -m http.server`) and open `/dev/harness.html?theme=light&w=358`.

Tagging `vX.Y.Z` builds the bundle and attaches it to a GitHub release, which the Marketplace installs.
