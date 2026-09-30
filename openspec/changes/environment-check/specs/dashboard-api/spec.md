# Spec Delta

## ADDED Requirements

### Requirement: Environment endpoint
`GET /api/environment` SHALL return the environment report as JSON: the time it was computed, the overall status and the
checks in their stable order, each with its identifier, label, status, what was found and, when the status is not `ok`,
its remedy. It SHALL be computed under the rules of the `environment-check` capability: no network, nothing read from or
written to a tracked repository, no credential value in the response, and `git config --get` as the only process it
starts, run with a working directory outside every tracked repository. The report MAY be reused for at most 10 seconds.
The endpoint is a `GET` and therefore adds no mutating route; no other route's behaviour changes, and `GET /api/state`
SHALL remain unchanged.

#### Scenario: Report shape
- **WHEN** `GET /api/environment` is requested
- **THEN** the response is JSON with the time it was computed, an overall status and one entry per check, each with an identifier, a label and a status

#### Scenario: No credential in the response
- **WHEN** `GH_TOKEN` is set and `GET /api/environment` is requested
- **THEN** the response body does not contain that token's value

#### Scenario: The request touches no repository
- **WHEN** `GET /api/environment` is requested while repositories are tracked
- **THEN** no file under any tracked repository, including its git config and index, is created, modified or deleted, and no network connection is opened

#### Scenario: Nothing mutates
- **WHEN** `POST /api/environment` is requested
- **THEN** the response is the same as for any unknown route and no report is computed
