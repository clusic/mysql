const MySQL = require('./index');
module.exports = async (app, plugin) => {
  let config = plugin.config;
  if (!config) throw new Error('@clusic/mysql need configs');
  if (!Array.isArray(config)) config = [config];
  
  const result = {};
  for (let i = 0; i < config.length; i++) {
    const item = config[i];
    const Mysql = new MySQL(item.options, item.pool);
    await Mysql.connect();
    result[item.contextName] = Mysql;
    app.bind('beforeStop', async () => await Mysql.disconnect());
  }
  
  app.use(async (ctx, next) => {
    await each((name, mysql) => {
      const context = mysql.context();
      Object.defineProperty(ctx, name, {
        get() { return context }
      });
      context.on('begin', () => ctx.onErrorCatch(async () => await context.rollback()));
    });
    await next();
    await each(async name =>  await ctx[name].commit());
  });
  
  async function each(callback) {
    for (const name in result) {
      await callback(name, result[name]);
    }
  }
};