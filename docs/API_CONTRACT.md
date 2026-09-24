# API Contract Sketch

## POST /events/:eventId/session
Create or resume an investor session.

## GET /events/:eventId/startups
Return the complete startup list with public fields.

## GET /events/:eventId/startups/:startupId
Return startup detail/public presentation data.

## POST /events/:eventId/responses
Body:

```json
{
  "pitch_id": "uuid",
  "response_type": "INTERESTED",
  "idempotency_key": "event:investor:pitch:attempt"
}
```

Server behavior:
- validate session
- validate event membership
- validate startup belongs to event
- verify current business window
- attempt insert
- reject duplicate unique key
- return authoritative acknowledgement

## GET /events/:eventId/me/responses
Return only the current investor's own recorded responses.

## Admin-only
- `GET /events/:eventId/admin/response-summary`
- `POST /events/:eventId/admin/stage/prepare`
- `POST /events/:eventId/admin/stage/publish`

The publish endpoint should create an immutable stage metric version; it must never mutate raw response records.
