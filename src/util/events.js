import moment from 'moment';
import distance from 'turf-distance';

export function computeFilteredEvents(events, filters, zipcodes) {
  // Put the meetings at the congressional offices at the top of the list
  events.sort((a, b) => {
    const aIsImportant = a.categories.indexOf('meeting') !== -1 ? 0 : 1;
    const bIsImportant = b.categories.indexOf('meeting') !== -1 ? 0 : 1;
    return aIsImportant - bIsImportant;
  });

  // Bail out early if possible. Huge array!
  if (!Object.keys(filters).length) {
    return events;
  }

  const zipcodesLength = Object.keys(zipcodes).length;
  const validZipcode = zipcodesLength && !!zipcodes[filters.zipcode];

  // A zipcode is selected but either we do not yet have valid zipcodes
  // to check it against and get its coords, or the zipcode is invalid;
  // either way there can be no valid events. Bail early.
  if (filters.zipcode && (!zipcodesLength || !validZipcode)) {
    return [];
  }

  const filteredEvents = events.filter(event => {

    if (filters.eventType) {
      const eventCategories = event.categories ?
        event.categories.split(',') :
        [];

      // The UI lumps into "event types" what are mostly "categories"
      // in ActionKit, with this one exception, the is_official
      // boolean field, so we will just pretend it is a category.
      if (event.is_official) {
        eventCategories.push('teamInternet');
      }

      if (!eventCategories.length) {
        return false;
      }

      const selectedEventTypes = filters.eventType.split(',');

      const eventMatchesNoSelectedTypes = selectedEventTypes.every(
        type => !eventCategories.includes(type)
      );

      if (eventMatchesNoSelectedTypes) {
        return false;
      }
    }

    // note: there is also a utc timestamp, this one is localized
    const localDatetime = moment(event.start_datetime);

    if (filters.startDate) {
      const startDate = moment(filters.startDate, 'YYYY-MM-DD');

      if (localDatetime.isBefore(startDate, 'day')) {
        return false;
      }
    }

    if (filters.endDate) {
      const endDate = moment(filters.endDate, 'YYYY-MM-DD');

      if (localDatetime.isAfter(endDate, 'day')) {
        return false;
      }
    }

    if (filters.zipcode) {
      const milesFromZipcode = distance(
        zipcodes[filters.zipcode],
        [event.lng, event.lat],
        'miles'
      );

      const MAX_MILES_FROM_ZIPCODE = 50;

      if (milesFromZipcode > MAX_MILES_FROM_ZIPCODE) {
        return false;
      }
    }

    return true;
  });

  // When a zipcode is selected, sort events by proximity to that zipcode.
  if (filters.zipcode) {

    filteredEvents.sort((a, b) => {
      const distanceFromA = distance(zipcodes[filters.zipcode], [a.lng, a.lat]);
      const distanceFromB = distance(zipcodes[filters.zipcode], [b.lng, b.lat]);

      return distanceFromA - distanceFromB;
    });
  }

  return filteredEvents;
}
