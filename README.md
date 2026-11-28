# HA Cards

Custom Home Assistant dashboard cards: a Dreame vacuum, ESPHome cat feeders, a scale-based water fountain, a Litter-Robot, and Home-screen cards for rooms, lights, pets, security, a weather station and a CT energy monitor. Install through the Marketplace (HACS) as a custom **Dashboard** repository. All cards are in one bundle.

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

## Vacuum compact card

A Dreame vacuum at a glance, for a home screen. Tapping it opens the page with the full vacuum card.

- **Headline:** what it's doing ("Docked", "Cleaning Kitchen", "Paused in Kitchen", "Heading home") or its worst problem (the robot's error, offline, a tank, dust bag or detergent that needs you, or a part under 10%). Battery sits on the right.
- **Icon:** pauses a clean, and sends it home while it's paused or stopped off the dock. Docked, it's just the robot.
- **While it runs:** the run's progress, time and area so far. Problems are listed under the headline.
- **Docked and fine:** the last clean (when, how long, how much), the next scheduled clean and its rooms, and parts between 10% and 20%. The next clean has a day only for every-day and one-off schedules, since the integration doesn't say which weekdays the others use.

Everything besides the vacuum is found on its device, like the status card.

```yaml
type: custom:brinstar-vacuum-compact-card
entity: vacuum.my_robot
name: Robot                          # optional
navigation_path: /dashboard/vacuum   # optional; where tapping it goes
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

## Room card

One room at a glance, sized for a two-column grid on a phone.

- The room's icon is its one action: it toggles the main light and glows while it's on.
- Temperature, humidity and how many of the room's lights are on.
- What Frigate sees right now (person, cat or dog) from any of the room's cameras. Nothing shows when nothing is there.
- The air, when the room has the sensors: "Air good", or the worst reading in amber or red. PM2.5 uses the 2024 EPA AQI breakpoints and VOC the Sensirion index.
- Anywhere else on the card opens `navigation_path`.

```yaml
type: custom:brinstar-room-card
name: Kitchen
icon: mdi:fridge-outline
light: light.kitchen                 # the one action
lights: [light.kitchen, light.dining]  # optional, for "2 on"
temperature: sensor.kitchen_temperature  # optional
humidity: sensor.kitchen_humidity        # optional
pm25: sensor.kitchen_pm25                # optional
voc: sensor.kitchen_voc_index            # optional
frigate: [kitchen]                       # optional, Frigate camera names
navigation_path: /dashboard-home/kitchen # optional
```

## Pets card

The litter box, feeders and fountain on one card, problems first. Each row has the device's drawing, its status and one fact: the drawer level, when it was fed and the next meal, or the water left and the pump. It has no buttons; it opens `navigation_path`, where the full cards live.

```yaml
type: custom:brinstar-pets-card
litter: vacuum.litter_robot_litter_box   # optional
feeders:                                 # optional, any entity of each feeder
  - { entity: sensor.feeder_1_last_fed, name: Feeder 1 }
fountain: sensor.cat_fountain_water_weight  # optional
capacity_grams: 3000                     # optional
navigation_path: /dashboard-home/pets    # optional
```

## Lights card

The lights that are on, and the favourites that aren't.

- **Headline:** "2 lights on" or "All lights off". **All off** switches off every light on the card, plus any `all_off_extra` entities, in one tap.
- **Each light that's on:** its area's icon, a switch to turn it off, and for dimmers a brightness slider with the level shown as a fill.
- **Turn on:** favourites that are off, as one-tap buttons with their area's icon.

```yaml
type: custom:brinstar-lights-card
lights:                                  # every light, in the order to list them
  - { entity: light.living_room, name: Living Room, icon: mdi:sofa }
  - { entity: light.kitchen, name: Kitchen, icon: mdi:fridge-outline }
favourites: [light.living_room, light.kitchen]   # optional
all_off_extra: [switch.display_lights]           # optional
```

## Security card

The alarm, the locks, garage doors and every door and window on one card.

- **Headline:** "All secure", or the worst problem and how many more there are (triggered, unlocked or jammed, open, offline, open doors and windows). With `name` set, the name leads and the verdict sits beside it.
- **Alarm:** its state and how long it's been that way. Disarmed offers **Arm home** and **Arm away**; armed offers **Disarm**.
- **Each lock and garage door:** its state and how long, and only its next action.
- **Taps:** the safe direction (lock, close, arm home) takes one tap. Unlock, open, arm away and disarm take a second tap within 4 seconds; the button reads "Tap again to unlock" in between.
- **Offline:** an offline device is a problem, never secure. A garage door can name a door sensor to report while its opener is offline ("Offline · exterior door closed").
- **Doors and windows:** one line, "All 16 doors and windows closed", or the open ones by name.

```yaml
type: custom:brinstar-security-card
name: Security                           # optional; without it the verdict is the headline
alarm: alarm_control_panel.home          # optional
locks:                                   # optional
  - { entity: lock.front_door, name: Front door }
covers:                                  # optional, garage doors
  - { entity: cover.garage_door, name: Garage door, fallback: binary_sensor.garage_side_door, fallback_name: side door }
contacts:                                # optional, every door and window
  - { entity: binary_sensor.patio_door, name: Patio door }
```

## Climate card

A thermostat and the fans on one card.

- **Headline:** what it's doing now ("Cooling to 75°", "Heating to 68°"), or when it will start ("Idle · cools above 75°", "Idle · keeps 68–75°"). While it runs, the `power` sensors' total shows beside it. The icon is teal while cooling and amber while heating.
- **Now:** the inside temperature and humidity from the thermostat, and the `outside` temperature.
- **Target:** − and + step by the thermostat's `target_temp_step` (1° in °F, 0.5° in °C), within its range. Taps collect for a moment and go out as one `climate.set_temperature`. In heat/cool there's a stepper for each end, and the range can't cross itself.
- **Mode:** Off · Cool · Heat · Auto (heat/cool), from the thermostat's modes.
- **Fans:** each fan with its room's temperature and **Off · Low · Med · High** buttons, from the fan's `percentage_step`. A fan without speeds gets Off · On. The icon spins while the fan is on, faster at higher speeds, and holds still with reduced motion.
- **Show details:** the last 24 hours (inside temperature, the target and when it cooled or heated, from the thermostat's history) and **Circulate fan** and **Eco** switches when the thermostat has them.

```yaml
type: custom:brinstar-climate-card
entity: climate.thermostat
outside: sensor.outdoor_temperature        # optional
power: [sensor.ac_power, sensor.furnace_power]   # optional
fans:                                      # optional
  - { entity: fan.living_room, name: Living Room, temperature: sensor.living_room_temperature }
  - { entity: fan.bedroom, name: Bedroom, temperature: sensor.bedroom_temperature }
expanded: false                            # optional; start with the details open
```

## Weather card

Conditions from your own weather station, with a forecast entity for the condition and the hours ahead. It starts folded: the condition, temperature, feels-like and today's high, low and chance of rain. **Show details** opens the rest, and the history and hourly forecast load only then.

- Temperature and feels-like, with today's high, low and chance of rain.
- Humidity, wind (speed, direction arrow, gust and today's max gust), rain today and this week, pressure and whether it's rising or falling over 3 hours, UV and sunlight, dew point.
- The last 24 hours of temperature with rain per hour underneath, from long-term statistics.
- The next six hours from `weather.get_forecasts`.

`entity` is the station's outdoor temperature. The other readings are found on the same device by the end of their entity ids: `feelslike`, `humidity`, `dewpoint`, `windspeed`, `windgust`, `maxdailygust`, `winddir`, `dailyrain`, `weeklyrain`, `baromrel`, `uv`, `solarradiation`. Readings the station doesn't have show as a dash.

```yaml
type: custom:brinstar-weather-card
entity: sensor.station_temp
weather: weather.home                    # optional, condition and forecast
navigation_path: /dashboard-weather      # optional
expanded: false                          # optional, start with the details open
```

## Energy card

Whole-house power from a CT energy monitor such as a CircuitSetup meter on ESPHome. It starts folded: watts, amps and volts now and energy and cost today, plus a warning line if a leg passes 80% of the main breaker. **Show details** opens the rest, and the 24-hour chart loads only then.

- Watts, amps and volts now; energy and cost so far today.
- Each leg's current against the main breaker; amber from 80% and red from 95%.
- The last 24 hours of power (5-minute statistics) and its peak.
- The circuits using it now, largest first, then "Rest of the house": what the main clamps see that no circuit clamp does.

```yaml
type: custom:brinstar-energy-card
power: sensor.main_watts
current: sensor.main_amps                # optional
voltage: sensor.voltage                  # optional
energy_today: sensor.main_kwh_today      # optional, resets at midnight
cost_today: sensor.main_cost_today       # optional
max_current: 150                         # optional, main breaker size
legs:                                    # optional
  - { name: Leg A, current: sensor.main_a_amps }
  - { name: Leg B, current: sensor.main_b_amps }
circuits:                                # optional
  - { name: Kitchen, power: sensor.kitchen_watts }
  - { name: Dryer, power: sensor.dryer_watts }
top: 6                                   # optional, circuits listed before the rest fold into one row
navigation_path: /energy                 # optional
expanded: false                          # optional, start with the details open
```

## Credit cards card

Credit card payments from a `credit_cards` custom integration, installed separately. It makes one `date` sensor per card (state: the current due date; attributes `status`, `days_until`, `due_day`, `autopay`, `amount_due`, `payment_url`, `paid_on`, `card_id`), provides the `credit_cards.*` services the card calls, and sends the phone reminders. The card finds every card the integration made, so its config needs nothing else.

- The most urgent card up top: overdue in red, due today or within 3 days in amber, otherwise the next one due or "All paid".
- Each card, earliest due date first: when it's due, the amount if one is set, and a one-tap **Paid**. On the day it was marked paid it shows **Undo** instead. A card with a payment link opens it in a new tab.
- **Manage cards** adds, edits and removes cards (name, due day, amount due, payment link, autopay). Delete takes a second tap. Card numbers are never asked for or stored.
- **Bank-linked cards** (when the integration syncs a card from its bank; attributes `bank`, `bank_status`, `awaiting_bank`): Manage shows the bank's name, and the due day and amount are locked ("Set by …") because the bank sets them. A Paid tap the bank hasn't seen yet reads "waiting on bank". A bank that needs signing in again adds "Re-link … in Settings" under the card.

```yaml
type: custom:brinstar-credit-cards-card
title: Credit cards                      # optional
```

## Laundry card

Washer and dryer state from a "running" entity per machine: a smart plug's binary sensor, or a helper turned on and off from a power reading. Each machine can add its power sensor and an LG ThinQ appliance sensor (`smartthinq_sensors`).

- The headline is the most notable state: an LG error, a washer waiting to be unloaded, a run ("Washer · 23 min left", or "Washer running · 42 min" without LG), a finished run ("Dryer done 12 min ago"), or "Both idle".
- Each machine says Running and for how long, with its watts. When LG reports a cycle, it adds the course and phase, the time left and a progress meter. When the machine runs but LG reports nothing (e.g. offline in ThinQ), it says so.
- After a run, "Done … ago" lasts `done_hours` (4 by default). With an LG washer that has updated since the run ended and reports its door shut, it says "Waiting to be unloaded" until the door opens.
- Run times come from the recorder's history of the running entity, skipping `unavailable` blips, so an HA restart doesn't reset them. Tapping a machine opens its LG entity, or its running entity.

```yaml
type: custom:brinstar-laundry-card
title: Laundry                           # optional
done_hours: 4                            # optional
machines:
  - name: Washer
    icon: mdi:washing-machine
    running: binary_sensor.washer_running
    power: sensor.washer_power           # optional
    appliance: sensor.washer             # optional, LG ThinQ
  - name: Dryer
    icon: mdi:tumble-dryer
    running: input_boolean.dryer_running
    power: sensor.dryer_power
    appliance: sensor.dryer
```

## Development

```sh
npm install
npm test         # vitest
npm run build    # dist/brinstar-cards.js
```

`dev/harness.html` renders every card in its main states from a fixture recorded from a real Home Assistant (`dev/fixture.json`, git-ignored). The room, pets, weather and energy suites also need `dev/fixture-home.json` (git-ignored), which carries that house's card configs alongside its states, registry entries and replies. Serve the repo root (`python3 -m http.server`) and open `/dev/harness.html?theme=light&w=358`, or add `&only=rooms` (or `pets`, `weather`, `energy`) for one suite.

Tagging `vX.Y.Z` builds the bundle and attaches it to a GitHub release, which the Marketplace installs.
