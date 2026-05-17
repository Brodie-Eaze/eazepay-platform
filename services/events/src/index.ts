export { EventsModule, type EventsModuleOptions } from './events.module.js';
export { EventsService } from './events.service.js';
export { EventsSubscriber } from './events.subscriber.js';
export type { EventKind, PublishInput, PublishedEvent, SafeJsonValue } from './events.types.js';
export { PiiInEventPayloadError, assertSafePayload } from './internal/sanitiser.js';
