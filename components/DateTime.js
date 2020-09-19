import React from 'react';
import PropTypes from 'prop-types';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

import ReactDateTime from 'react-datetime';

class DateTime extends React.Component {
  static propTypes = {
    date: PropTypes.string.isRequired,
    timezone: PropTypes.string.isRequired,
  };

  render() {
    const props = this.props;
    const { date, timezone } = props;

    const value = dayjs(new Date(date)).tz(timezone);

    return <ReactDateTime value={value} utc={timezone === 'utc'} {...props} />;
  }
}

export default DateTime;
