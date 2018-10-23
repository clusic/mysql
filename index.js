const MYSQL = require('mysql');
module.exports = class MySQL {
  constructor(options, pool) {
    this.options = options;
    this.pool = pool;
    this.dbo = null;
    this.lifes = {};
    this.conn = null;
    this.runtime = 0;
  }
  
  on(name, callback) {
    if (!this.lifes[name]) this.lifes[name] = [];
    this.lifes[name].push(callback);
    return this;
  }
  
  async emit(name, ...args) {
    if (this.lifes[name]) {
      const life = this.lifes[name];
      for (let i = 0; i < life.length; i++) {
        await life[i](...args);
      }
    }
  }
  
  async connect() {
    if (this.pool) {
      this.dbo = MYSQL.createPool(this.options);
      return await new Promise((resolve, reject) => {
        this.dbo.connect(err => {
          if (err) return reject(err);
          resolve();
        });
      });
    }
    this.dbo = MYSQL.createConnection(this.options);
    await new Promise((resolve, reject) => {
      this.dbo.connect(err => {
        if (err) return reject(err);
        resolve();
      });
    });
  }
  
  _stop(resolve) {
    this.dbo.end(err => {
      if (err) {
        try{ this.dbo.destroy(); } catch(e) {}
      }
      resolve();
    });
  }
  
  disconnect() {
    return new Promise(resolve => {
      const time = Date.now();
      const timer = setInterval(() => {
        if (Date.now() - time > 3 * 60 * 1000) {
          clearInterval(timer);
          return this._stop(resolve);
        }
        if (this.runtime) return;
        clearInterval(timer);
        this._stop(resolve);
      }, 10);
    });
  }
  
  async _get() {
    if (this.conn) return this.conn;
    if (!this.pool) return this.conn = this.dbo;
    return this.conn = await new Promise((resolve, reject) => {
      this.dbo.getConnection((err, connection) => {
        if (err) return reject(err);
        this.runtime++;
        resolve(connection);
      });
    });
  }
  
  async begin() {
    const conn = await this._get();
    await this.emit('beforeBegin');
    await new Promise((resolve, reject) => {
      conn.beginTransaction(err => {
        if (err) return reject(err);
        resolve();
      })
    });
    await this.emit('begin');
  }
  
  async commit() {
    const conn = this.conn;
    await this.emit('beforeCommit');
    await new Promise((resolve, reject) => {
      conn.commit(err => {
        if (err) return reject(err);
        resolve();
      })
    });
    this.release();
    await this.emit('commit');
  }
  
  async rollback() {
    const conn = this.conn;
    await this.emit('beforeRollback');
    await new Promise((resolve, reject) => {
      conn.rollback(err => {
        if (err) return reject(err);
        resolve();
      })
    });
    this.release();
    await this.emit('rollback');
  }
  
  release() {
    if (this.pool && this.conn) {
      this.runtime--;
      this.conn.release();
    }
    this.conn = null;
  }
  
  async exec(sql, ...args) {
    const conn = await this._get();
    await this.emit('beforeExec', sql, ...args);
    const res = await new Promise((resolve, reject) => {
      conn.query(sql, args, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
    await this.emit('exec', sql, ...args);
    return res;
  }
  
  async insert(table, data) {
    let one = false;
    if (!Array.isArray(data)) {
      data = [data];
      one = true;
    }
    const result = await Promise.all(data.map(value => this.exec(`INSERT INTO ${table} SET ?`, value)));
    if (one) return result[0];
    return result;
  }
  
  async update(table, value, where, ...wheres) {
    let fields = [], values = [];
    for ( let key in value ){
      fields.push('`' + key + '`=?');
      values.push(value[key]);
    }
    let sql = `UPDATE ${table} SET ${fields.join(',')}`;
    if ( where ){
      sql += ' WHERE ' + where;
      values = values.concat(wheres);
    }
    return (await this.exec(sql, ...values)).changedRows;
  }
  
  async ['delete'](table, where, ...wheres){
    let sql = `DELETE FROM ${table}`, values = [];
    if ( where ){
      sql += ' WHERE ' + where;
      values = values.concat(wheres);
    }
    return (await this.exec(sql, ...values)).affectedRows;
  }
  
};