const logger = require('./logger');

const desiredServiceLevel = Number(process.env.SERVICE_LEVEL) || 100;

const nonEssentialRobots = ['Ahrefs', 'Semrush', 'SpiderFoot', 'WebMeUp'];

const essentialRobots = ['Facebook', 'Pingdom', 'Twitter'];

let serviceLevel = 0;

// Wait 30 seconds before reaching service level 50 or desiredServiceLevel
setTimeout(() => {
  if (desiredServiceLevel > serviceLevel) {
    serviceLevel = Math.min(50, desiredServiceLevel);
  }
}, 30000);

// Wait 3 minutes before reaching desiredServiceLevel
setTimeout(() => {
  if (desiredServiceLevel > serviceLevel) {
    serviceLevel = desiredServiceLevel;
  }
}, 180000);

const onServiceLimited = (req, res) => {
  logger.info(`Service limited for '${req.ip}' '${req.headers['user-agent']}'`);
  const message = `Service Limited. Try again later. Please contact support@opencollective.com if it persists.`;
  res.status(503).send(message);
};

async function serviceLimiter(req, res, next) {
  if (!req.identity && req.hyperwatch) {
    req.identity = await req.hyperwatch.getIdentity();
  }
  if (serviceLevel < 100) {
    if (req.identity && nonEssentialRobots.include(req.identity)) {
      onServiceLimited(req, res, next);
      return;
    }
  }
  if (serviceLevel < 50) {
    if (req.identity && !essentialRobots.include(req.identity)) {
      onServiceLimited(req, res, next);
      return;
    }
  }
  next();
}

module.exports = serviceLimiter;
