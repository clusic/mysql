const MySQL = require('./index');
module.exports = async (app, plugin) => {
  let config = plugin.config;
  if (!config) throw new Error('@clusic/mysql need configs');
  if (!Array.isArray(config)) config = [config];
  
  for (let i = 0; i < config.length; i++) {
    const item = config[i];
    const Mysql = app[item.contextName] = new MySQL(item.options, false);
    await Mysql.connect();
    app.bind('stop', async () => await Mysql.disconnect());
  }
};