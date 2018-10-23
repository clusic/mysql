# @clusic / mysql

mysql数据库操作类

## Install

```shell
npm i @clusic/mysql
```

## Usage

```javascript
const MySQL = require('@clusic/mysql');
const mysql = new MySQL(options, isPool);
await mysql.begin();
await mysql.insert(table, data);
await mysql.update(table, data, ...conditions);
await mysql.delete(table, ...conditions);
await mysql.commit();
await mysql.rollback();
mysql.release();
```

## Events

- beforeBegin 事务开启前
- begin 事务开启后
- beforeCommit 提交前
- commit 提交后
- beforeRollback 回滚前
- rollback 回滚后
- beforeExec 执行SQL语句前
- exec 执行SQL语句后

```javascript
mysql.on('begin', () => console.log('事务开始了'));
mysql.on('exec', (sql, ...args) => console.log(sql, ...args));
```

## In Clusic Plugin

在worker中，ctx上会存在一个你在配置[contextName]属性名的对象，指向当前mysql操作对象。

```javascript
await ctx.mysql.begin();
await ctx.mysql.insert(...);
await ctx.mysql.commit();
```

在agent中，全局app[contextName]指向对应的操作对象。

```javascript
app.feed(name, async () => {
  await app.mysql.begin();
  await app.mysql.insert(...);
  await app.mysql.commit();
})
```