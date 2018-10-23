const MySQL = require('./index');
module.exports = async (app, plugin) => {
  let config = plugin.config;
  if (!config) throw new Error('@clusic/mysql need configs');
  if (!Array.isArray(config)) config = [config];
  
  const result = [];
  for (let i = 0; i < config.length; i++) {
    const item = config[i];
    result.push(item.contextName);
    const Mysql = app.context[item.contextName] = new MySQL(item.options, item.pool);
    await Mysql.connect();
    app.bind('beforeStop', async () => await Mysql.disconnect());
  }
  
  app.use(async (ctx, next) => {
    for (let i = 0; i < result.length; i++) {
      ctx[result[i]].on('begin', async () => await ctx[result[i]].rollback());
    }
    await next();
    for (let j = 0; j < result.length; j++) {
      await ctx[result[j]].commit();
    }
  });
};