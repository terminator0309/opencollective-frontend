import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// In-order to use certain functionality of dayjs, we need to import certain plugins and extend them to the dayjs object.

// adding utc plugin
dayjs.extend(utc);
// adding timezone plugin
dayjs.extend(timezone);

export default dayjs;
