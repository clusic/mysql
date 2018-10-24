const MYSQL = require('mysql');

class Singleton {
  constructor(mysql) {
    this.lifes = {};
    this.conn = null;
    this.mysql = mysql;
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
  
  async _get() {
    if (this.conn) return this.conn;
    if (!this.mysql.pool) return this.conn = this.mysql.dbo;
    return this.conn = await new Promise((resolve, reject) => {
      this.mysql.dbo.getConnection((err, connection) => {
        if (err) return reject(err);
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
    if (this.mysql.pool && this.conn) {
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
}

module.exports = class MySQL {
  constructor(options, pool) {
    this.options = options;
    this.pool = pool;
    this.dbo = null;
  }
  
  async connect() {
    if (this.pool) return this.dbo = MYSQL.createPool(this.options);
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
      this.dbo.end(err => {
        if (err) {
          try{ this.dbo.destroy(); } catch(e) {}
        }
        resolve();
      });
    });
  }
  
  context() {
    return new Singleton(this);
  }
};