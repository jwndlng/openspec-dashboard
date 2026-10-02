# Spec Delta

## ADDED Requirements

### Requirement: Label colour endpoint

`POST /api/labels/color` with `{ label, hue }` SHALL set the colour the dashboard shows for that label on every
repository, persist the configuration atomically and return the saved config, under the same validation as
`PUT /api/config` and applied one at a time with every other configuration write against the configuration as the
previous write left it. `label` SHALL be trimmed and SHALL follow the label rules of the `project-labels` capability; it
SHALL be stored in lower case, so labels that differ only in case share one colour. A whole-number `hue` from 0 to 359
SHALL set the label's entry in `labelColors`; `hue: null` SHALL remove the entry, and removing the last entry SHALL
remove the `labelColors` key, so a configuration never gains an empty map. A `label` that is not a string or breaks the
label rules, a `hue` that is neither `null` nor a whole number from 0 to 359, a body missing either field, and a request
that would give `labelColors` more than 200 entries MUST be refused with `400` and leave the configuration unchanged.
The label need not be displayed on any repository. The endpoint does not change the set of enabled repositories, so it
SHALL NOT trigger a scan. It is a mutating request under the same-origin protection, and it reads or writes nothing
inside a repository.

#### Scenario: Setting a colour
- **WHEN** `POST /api/labels/color` is sent with `{ "label": " Client ", "hue": 290 }`
- **THEN** the saved config's `labelColors` maps `client` to `290`, every repository's labels are unchanged and no scan
  was triggered

#### Scenario: Clearing the last colour
- **WHEN** `labelColors` holds only `client` and `POST /api/labels/color` is sent with `{ "label": "client", "hue": null }`
- **THEN** the saved config has no `labelColors` key

#### Scenario: Invalid hue
- **WHEN** `POST /api/labels/color` is sent with `{ "label": "client", "hue": 12.5 }` or `{ "label": "client", "hue": 360 }`
- **THEN** the response is `400` and the config is unchanged

#### Scenario: Invalid label
- **WHEN** `POST /api/labels/color` is sent with `{ "label": "a,b", "hue": 290 }`
- **THEN** the response is `400` and the config is unchanged

#### Scenario: Cross-site
- **WHEN** a page from another origin sends `POST /api/labels/color`
- **THEN** the response is `403` and the config is unchanged
