# @eazepay/service-notification

Multi-channel notification dispatch + in-app inbox.

## Responsibilities

- Send a notification across one or more channels (email, SMS, push,
  in-app inbox) from a single `notify(...)` call
- Resolve templates from the in-repo registry (subject, body,
  variables, locale)
- Provide an in-app inbox surface (read / unread / archive)
- Adapter port lets ops swap in SES, Twilio, APNs, FCM, etc.

## Public API

- `NotificationModule.forRoot(...)`
- `NotificationService.notify(userId, template, vars, channels?)`
- Controller: `/v1/notifications/*` (inbox endpoints)
- Adapters: `ConsoleChannelAdapter` (dev), production adapters TBD
- Templates: registered in `templates/registry.ts`
- Ports: `NotificationChannelPort`, `NotifyPort`

## Dependencies

- `@eazepay/service-auth`
- `@eazepay/shared-types`, `@eazepay/shared-utils`
- External: Postgres (Prisma)

## Notes

- Templates live in-repo for version control + review; no runtime
  CMS dependency
- A failed channel does not block others — partial failure is logged
  and inbox always succeeds (it's a DB row, not a 3rd-party call)
- Console adapter throws if `isDevelopment=false` to prevent
  accidental production use
