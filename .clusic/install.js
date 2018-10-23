module.exports = () => {
  return {
    pool: true,
    contextName: 'mysql',
    options: {
      host: '127.0.0.1',
      user: 'user',
      password: 'password',
      database: 'database',
      port: 389
    }
  }
};