# Production Architecture

## Frontend
- Mobile-first web application.
- Investor route: `/investor`.
- Admin route: `/admin`.
- Stage route: `/stage`.

## Data plane
- PostgreSQL / Supabase for investors, pitches, immutable responses, audit events, stage metric versions.
- Production response insertion must be server-authoritative.
- Use a unique constraint on `(event_id, investor_id, pitch_id)`.
- Use an idempotency key for retry safety.

## Realtime
Investor clients may receive event-state changes and their own acknowledgements.

The stage should receive only public stage-state messages such as:
- `STAGE_LOADING`
- `STAGE_RESULTS_PUBLISHED`

Do not broadcast raw investor responses to the public stage.

## Venue resilience
Recommended live-event topology:

`Phones → Venue Wi-Fi → Local Event Gateway → Durable Store → Cloud Sync`

The event gateway can continue the critical local path if internet connectivity is lost, then synchronize accepted response records to the cloud when connectivity returns.
