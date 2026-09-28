// Pins tests to the phone time zone PaceTasks is built around, so local-day and DST cases are deterministic.
module.exports = () => {
  process.env.TZ = "Europe/Rome";
};
